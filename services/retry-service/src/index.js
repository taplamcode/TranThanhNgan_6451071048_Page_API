require("dotenv").config();
const express = require("express");
const { Kafka, logLevel } = require("kafkajs");
const logger = require("../../../shared/logger")("retry-service");
const { TOPICS, GROUPS } = require("../../../shared/constants");

const app = express();
const port = Number.parseInt(process.env.RETRY_PORT || "3003", 10);

const kafkaBrokers = (process.env.KAFKA_BROKERS || "localhost:9092")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const kafka = new Kafka({
  clientId: "retry-service",
  brokers: kafkaBrokers,
  logLevel: logLevel.NOTHING,
});

const consumer = kafka.consumer({ groupId: GROUPS.RETRY });
const producer = kafka.producer();

const MAX_RETRIES = 3;

app.get("/", (req, res) => {
  res.send(`
    <div style="font-family: sans-serif; padding: 2rem; line-height: 1.6;">
      <h1 style="color: #ff9800;">Retry & Reliability Service</h1>
      <p>Status: <strong>Running</strong> (Monorepo Microservice)</p>
      <p>Role: Implements Exponential Backoff retry strategies and routes dead events to DLQ</p>
    </div>
  `);
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "retry-service" });
});

async function handleFailedEvent(failEvent) {
  const { command, error_message } = failEvent;
  const currentAttempts = Number.parseInt(failEvent.retry_count || "0", 10);
  const nextAttempts = currentAttempts + 1;
  const key = command.idempotency_key;

  logger.info(`Received failed event notification for key: ${key}`);
  logger.info(`Last Error: "${error_message}"`);
  logger.info(`Current Retry Count: ${currentAttempts}/${MAX_RETRIES}`);

  // Distinct unrecoverable errors (e.g. invalid tokens, permissions)
  const unrecoverableKeywords = ["token", "unauthorized", "oauth", "expired", "permission", "401", "403", "forbidden"];
  const lowerError = String(error_message || "").toLowerCase();
  const isUnrecoverable = unrecoverableKeywords.some((keyword) => lowerError.includes(keyword));

  if (isUnrecoverable) {
    logger.error(`[UNRECOVERABLE ERROR DETECTED] Error: "${error_message}". Bypassing retry loop and routing directly to DLQ.`);

    const dlqPayload = {
      key,
      command,
      attempts: currentAttempts,
      final_error: `${error_message} (Unrecoverable Error: Skipped Retries)`,
      terminated_at: new Date().toISOString(),
    };

    await producer.send({
      topic: TOPICS.DEAD_LETTER,
      messages: [
        {
          key,
          value: JSON.stringify(dlqPayload),
        },
      ],
    });

    logger.success(`Routed unrecoverable error directly to dead_letter topic.`);
    sendSlackAlertMock(dlqPayload);
    return;
  }

  if (nextAttempts <= MAX_RETRIES) {
    // Calculate exponential backoff delay (2^attempt seconds)
    const backoffSeconds = Math.pow(2, nextAttempts);
    const delayMs = backoffSeconds * 1000;

    logger.info(`Backoff Strategy active: Waiting ${backoffSeconds} seconds (delay: ${delayMs}ms) before retry...`);

    // Wait
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    // Prepare retry payload
    const retryPayload = {
      command: {
        ...command,
        retry_count: nextAttempts,
      },
      retry_count: nextAttempts,
      last_error: error_message,
      retried_at: new Date().toISOString(),
    };

    logger.info(`Publishing retry command to topic '${TOPICS.SEND_RETRY}' (Attempt #${nextAttempts})`);
    
    await producer.send({
      topic: TOPICS.SEND_RETRY,
      messages: [
        {
          key,
          value: JSON.stringify(retryPayload),
        },
      ],
    });

    logger.success("Retry command published successfully.");
  } else {
    // Max retries exceeded -> Route to Dead Letter Queue (DLQ)
    logger.warn(`🚨 MAX RETRIES EXCEEDED (${MAX_RETRIES}/${MAX_RETRIES}) for key: ${key}!`);
    logger.warn(`Routing event to Dead Letter Queue topic '${TOPICS.DEAD_LETTER}'`);

    const dlqPayload = {
      key,
      command,
      attempts: currentAttempts,
      final_error: error_message,
      terminated_at: new Date().toISOString(),
    };

    await producer.send({
      topic: TOPICS.DEAD_LETTER,
      messages: [
        {
          key,
          value: JSON.stringify(dlqPayload),
        },
      ],
    });

    logger.success("Published event to dead_letter topic successfully.");

    // Simulate Slack Alert Notification
    sendSlackAlertMock(dlqPayload);
  }
}

function sendSlackAlertMock(payload) {
  console.log("\n=======================================================");
  console.log("📢 [MOCK SLACK ALERT] - MICROSERVICE INCIDENT DETECTED");
  console.log(`Channel: #ops-incidents`);
  console.log(`Alert Title: Facebook API Delivery Failure`);
  console.log(`Severity: CRITICAL 🔴`);
  console.log(`Command ID: ${payload.command?.command_id}`);
  console.log(`Idempotency Key: ${payload.key}`);
  console.log(`Total Attempts: ${payload.attempts}`);
  console.log(`Final Error Message: "${payload.final_error}"`);
  console.log("=======================================================\n");
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
      throw new Error("Unable to connect Retry Service to Kafka after max retries.");
    }

    // Subscribe to send_failed topic
    await consumer.subscribe({ topic: TOPICS.SEND_FAILED, fromBeginning: true });

    // Start polling consumer loops
    consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const rawValue = message.value.toString("utf8");
          const failEvent = JSON.parse(rawValue);
          await handleFailedEvent(failEvent);
        } catch (err) {
          logger.error("Error processing consumed message in retryServer", err);
        }
      },
    });

    app.listen(port, () => {
      logger.success(`Retry microservice running health check on http://localhost:${port}`);
    });
  } catch (err) {
    logger.error("Failed to start Retry service", err);
    process.exit(1);
  }
}

start();

async function shutdown() {
  logger.info("Gracefully shutting down Retry service...");
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
