require("dotenv").config();
const express = require("express");
const { Kafka, logLevel } = require("kafkajs");
const logger = require("../../../shared/logger")("core-service");
const { TOPICS, GROUPS } = require("../../../shared/constants");
const { isSpam, containsLink, isRateLimited } = require("./rules/checkSpam");
const { classifyAndDraftReply } = require("./ai/gemini");

const app = express();
const port = Number.parseInt(process.env.CORE_PORT || "3002", 10);

const kafkaBrokers = (process.env.KAFKA_BROKERS || "localhost:9092")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const kafka = new Kafka({
  clientId: "core-service",
  brokers: kafkaBrokers,
  logLevel: logLevel.NOTHING,
});

const consumer = kafka.consumer({ groupId: GROUPS.CORE });
const producer = kafka.producer();

app.get("/", (req, res) => {
  res.send(`
    <div style="font-family: sans-serif; padding: 2rem; line-height: 1.6;">
      <h1 style="color: #6200ee;">Core AI & Automation Service</h1>
      <p>Status: <strong>Running</strong> (Upgraded Pipeline)</p>
      <p>Role: Consumes <code>${TOPICS.RAW_EVENTS}</code>, checks user rate limits, filters spam, performs Gemini intent/sentiment, and commands reply executions.</p>
    </div>
  `);
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "core-service" });
});

async function handleRawEvent(event) {
  const eventId = event.event_id || "unknown";
  
  // 1. [STATE TRACKING] STATE: received
  console.log(`\n📍 [STATE TRACKING] Event ${eventId}: received`);
  logger.info(`Processing raw activity event: ${eventId}`);
  console.log("FULL EVENT DETAILS:", JSON.stringify(event, null, 2));

  const payload = event.payload || {};
  const messageText = payload.message || payload.message_text || "";
  const commenterName = payload.from?.name || "Khách hàng";
  const userId = payload.sender_id || payload.from?.id || "unknown";

  // Prevent replying to echo events (messages sent by the page itself)
  if (event.event_type === "message" && payload.is_echo) {
    logger.info("Skipping echo message sent by the Page itself.");
    return;
  }

  // Prevent replying to comments created by the Page itself
  const pageIdFromPost = payload.post_id ? payload.post_id.split("_")[0] : null;
  const isAuthorSelf = (payload.from?.id && event.page_id && String(payload.from.id) === String(event.page_id)) ||
                       (payload.from?.id && pageIdFromPost && String(payload.from.id) === String(pageIdFromPost)) ||
                       (payload.from?.id && process.env.PAGE_ID && String(payload.from.id) === String(process.env.PAGE_ID));

  if (event.event_type === "comment" && isAuthorSelf) {
    logger.info(`Skipping comment created by the Page itself. Author: ${payload.from?.id}, Page ID: ${event.page_id || pageIdFromPost}`);
    return;
  }

  // 2. User Rate Limiting Check
  if (isRateLimited(userId)) {
    // [STATE TRACKING] STATE: pending_review
    console.log(`📍 [STATE TRACKING] Event ${eventId}: pending_review (Reason: Abnormal user rate limit)`);
    logger.warn(`Abnormal frequency detected for user ${userId}. Flow blocked, pending manual review.`);
    return;
  }

  // 3. Spam & URL Link Protection Check
  if (containsLink(messageText)) {
    // Link spam -> Automatically hide comment immediately
    logger.warn(`Malicious link detected on event ${eventId}. Issuing 'hide_comment' command.`);
    
    // [STATE TRACKING] STATE: processed (Spam link -> hidden)
    console.log(`📍 [STATE TRACKING] Event ${eventId}: processed (Spam link -> hidden)`);
    await publishHideCommand(event, payload, "Spam link detected");
    return;
  }

  if (isSpam(messageText)) {
    // Banned keyword spam -> Automatically hide comment immediately
    logger.warn(`Banned spam keywords matched on event ${eventId}. Issuing 'hide_comment' command.`);
    
    // [STATE TRACKING] STATE: processed (Keyword spam -> hidden)
    console.log(`📍 [STATE TRACKING] Event ${eventId}: processed (Keyword spam -> hidden)`);
    await publishHideCommand(event, payload, "Banned keyword spam detected");
    return;
  }

  // 4. Intent & Sentiment AI Classification Pipeline
  try {
    const classification = await classifyAndDraftReply(messageText, commenterName, event.event_type);
    const { intent, sentiment, reply_message } = classification;

    logger.info(`AI Pipeline Result -> Intent: "${intent}" | Sentiment: "${sentiment}"`);

    // [STATE TRACKING] STATE: processed
    console.log(`📍 [STATE TRACKING] Event ${eventId}: processed (Intent: ${intent}, Sentiment: ${sentiment})`);

    // Negative sentiment / complaint → send apology reply (do NOT hide - per assignment requirement)
    // Only SPAM comments are hidden (handled above)

    // 5. Positive/Neutral Action -> Generate Reply Command
    const command = {
      command_id: `cmd_${eventId}`,
      idempotency_key: `idemp_${payload.comment_id || payload.message_id || eventId}`,
      event_type: event.event_type === "comment" ? "reply_to_comment" : "reply_to_message",
      page_id: event.page_id,
      post_id: payload.post_id || null,
      comment_id: payload.comment_id || null,
      recipient_id: payload.sender_id || payload.from?.id || null,
      reply_message: reply_message,
      created_at: new Date().toISOString(),
    };

    // [STATE TRACKING] STATE: processed (Intent: intent, Sentiment: sentiment)
    console.log(`📍 [STATE TRACKING] Event ${eventId}: processed (Intent: ${intent}, Sentiment: ${sentiment})`);
    
    logger.info(`Publishing reply command ${command.command_id} to '${TOPICS.REPLY_COMMANDS}'`);
    await producer.send({
      topic: TOPICS.REPLY_COMMANDS,
      messages: [
        {
          key: command.idempotency_key,
          value: JSON.stringify(command),
        },
      ],
    });
    logger.success("Reply command published successfully.");

  } catch (aiErr) {
    logger.error(`Error in AI processing pipeline for event ${eventId}`, aiErr);
  }
}

async function publishHideCommand(event, payload, reason) {
  if (event.event_type !== "comment" || !payload.comment_id) return;

  const hideCommand = {
    command_id: `cmd_hide_${event.event_id || Math.random().toString(36).slice(2, 9)}`,
    idempotency_key: `idemp_hide_${payload.comment_id}`,
    event_type: "reply_to_comment", // reuse route or hide endpoint
    page_id: event.page_id,
    comment_id: payload.comment_id,
    reply_message: "[PRIVATE_HIDE_ACTION]", // Flag backend to call delete or hide
    reason: reason,
    created_at: new Date().toISOString(),
  };

  logger.info(`Publishing private hide comment command to '${TOPICS.REPLY_COMMANDS}'`);
  await producer.send({
    topic: TOPICS.REPLY_COMMANDS,
    messages: [
      {
        key: hideCommand.idempotency_key,
        value: JSON.stringify(hideCommand),
      },
    ],
  });
}

async function start() {
  try {
    const maxRetries = 10;
    const retryDelayMs = 2000;
    let connected = false;

    // Retry connection for producer & consumer
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await producer.connect();
        await consumer.connect();
        connected = true;
        logger.success(`Kafka Producer & Consumer connected successfully on attempt ${attempt}`);
        break;
      } catch (err) {
        logger.warn(`Kafka connection attempt ${attempt}/${maxRetries} failed: ${err.message}`);
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
      }
    }

    if (!connected) {
      throw new Error("Unable to connect Core Service to Kafka after max retries.");
    }

    // Subscribe to raw_events
    await consumer.subscribe({ topic: TOPICS.RAW_EVENTS, fromBeginning: true });
    
    consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const rawValue = message.value.toString("utf8");
          const event = JSON.parse(rawValue);
          await handleRawEvent(event);
        } catch (err) {
          logger.error("Error processing consumed message in coreServer", err);
        }
      },
    });

    app.listen(port, () => {
      logger.success(`Core AI service running health check on http://localhost:${port}`);
    });
  } catch (err) {
    logger.error("Failed to start Core AI service", err);
    process.exit(1);
  }
}

start();

async function shutdown() {
  logger.info("Gracefully shutting down Core service...");
  try {
    await consumer.disconnect();
    await producer.disconnect();
  } catch (err) {
    logger.error("Error disconnecting Kafka connections", err);
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
