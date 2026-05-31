require("dotenv").config();
const { Kafka, logLevel } = require("kafkajs");
const FacebookService = require("./facebook/facebookService");
const idempotencyStore = require("./services/idempotencyStore");
const circuitBreaker = require("./services/circuitBreaker");
const logger = require("../../../shared/logger")("backend-consumer");
const { TOPICS, GROUPS } = require("../../../shared/constants");

const kafkaBrokers = (process.env.KAFKA_BROKERS || "localhost:9092")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const kafka = new Kafka({
  clientId: "backend-api-consumer",
  brokers: kafkaBrokers,
  logLevel: logLevel.NOTHING,
});

const consumer = kafka.consumer({ groupId: GROUPS.BACKEND });
const producer = kafka.producer();

let facebookService;
try {
  facebookService = new FacebookService();
} catch (err) {
  logger.warn(`Facebook Service initialization warning: ${err.message}. Mock mode will be active.`);
}

async function handleCommand(command) {
  const { idempotency_key, event_type, comment_id, recipient_id, reply_message } = command;
  const eventId = command.command_id?.replace("cmd_", "") || "unknown";

  logger.info(`Received command request: ${command.command_id || "unknown"}`);
  logger.info(`Idempotency Key: ${idempotency_key}`);

  // 1. Circuit Breaker protection check
  if (!circuitBreaker.allowRequest()) {
    logger.warn(`Rejecting request due to OPEN Circuit Breaker. Routing directly to retry queue.`);
    
    // Fail immediately and route to send_failed
    const failPayload = {
      command: command,
      retry_count: command.retry_count || 0,
      error_message: "Circuit Breaker is OPEN (Downstream Meta API unavailable)",
      failed_at: new Date().toISOString(),
    };
    
    await producer.send({
      topic: TOPICS.SEND_FAILED,
      messages: [{ key: idempotency_key, value: JSON.stringify(failPayload) }],
    });
    return;
  }

  // 2. Check Idempotency Store
  if (idempotencyStore.has(idempotency_key)) {
    const currentStatus = idempotencyStore.get(idempotency_key);
    if (currentStatus === "SUCCESS") {
      logger.info(`[IDEMPOTENCY] Key ${idempotency_key} already processed successfully. Skipping execution.`);
      return;
    }
    if (currentStatus === "PROCESSING") {
      logger.info(`[IDEMPOTENCY] Key ${idempotency_key} is currently being processed. Skipping duplicate execution.`);
      return;
    }
  }

  // Mark as processing
  idempotencyStore.set(idempotency_key, "PROCESSING");

  try {
    logger.info(`Executing command for event ${eventId}. Type: ${event_type}`);

    if (!facebookService) {
      throw new Error("FacebookService not initialized (missing PAGE_ACCESS_TOKEN)");
    }

    let result;
    
    // 3. Check for special automated actions (hide spam comment)
    if (reply_message === "[PRIVATE_HIDE_ACTION]") {
      logger.warn(`🚨 AUTOMATION ACTION: Automatically hiding spam comment ID ${comment_id}`);
      result = await facebookService.hideComment(comment_id);
    } 
    // Standard auto replies
    else if (event_type === "reply_to_comment") {
      if (!comment_id) throw new Error("Missing comment_id for comment reply");
      result = await facebookService.createCommentReply(comment_id, reply_message);
    } else if (event_type === "reply_to_message") {
      if (!recipient_id) throw new Error("Missing recipient_id for message reply");
      result = await facebookService.sendPrivateMessage(recipient_id, reply_message);
    } else {
      throw new Error(`Unsupported event type: ${event_type}`);
    }

    logger.success(`Facebook API call completed successfully! Response: ${JSON.stringify(result)}`);
    
    // [STATE TRACKING] STATE: replied
    console.log(`📍 [STATE TRACKING] Event ${eventId}: replied`);
    
    // Reset circuit breaker success
    circuitBreaker.recordSuccess();

    // Save success status
    idempotencyStore.set(idempotency_key, "SUCCESS");
  } catch (err) {
    const errMsg = err.response?.data?.error?.message || err.message;
    logger.error(`Failed to execute command: ${errMsg}`);
    
    // [STATE TRACKING] STATE: failed
    console.log(`📍 [STATE TRACKING] Event ${eventId}: failed (Reason: ${errMsg})`);

    // Record failure in circuit breaker
    circuitBreaker.recordFailure();

    // Mark as failed in idempotency to allow retry
    idempotencyStore.set(idempotency_key, "FAILED");

    // Publish failure details to send_failed topic
    const failPayload = {
      command: command,
      retry_count: command.retry_count || 0,
      error_message: errMsg,
      failed_at: new Date().toISOString(),
    };

    logger.warn(`Publishing failure event for key ${idempotency_key} to topic '${TOPICS.SEND_FAILED}'`);
    try {
      await producer.send({
        topic: TOPICS.SEND_FAILED,
        messages: [
          {
            key: idempotency_key,
            value: JSON.stringify(failPayload),
          },
        ],
      });
      logger.success("Failure event published successfully.");
    } catch (pubErr) {
      logger.error("Failed to publish failure event to send_failed:", pubErr);
    }
  }
}

async function start() {
  try {
    const maxRetries = 10;
    const retryDelayMs = 2000;
    let connected = false;

    // Connect producer & consumer
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
      throw new Error("Unable to connect Backend Consumer to Kafka after max retries.");
    }

    // Subscribe to reply_commands and send_retry
    await consumer.subscribe({ topic: TOPICS.REPLY_COMMANDS, fromBeginning: true });
    await consumer.subscribe({ topic: TOPICS.SEND_RETRY, fromBeginning: true });

    logger.info(`Subscribed to Kafka topics: ${TOPICS.REPLY_COMMANDS}, ${TOPICS.SEND_RETRY}`);

    // Start polling consumer loops
    consumer.run({
      eachMessage: async ({ topic, message }) => {
        try {
          const rawValue = message.value.toString("utf8");
          const payload = JSON.parse(rawValue);

          if (topic === TOPICS.REPLY_COMMANDS) {
            await handleCommand(payload);
          } else if (topic === TOPICS.SEND_RETRY) {
            logger.info(`Picked up retry command payload (Attempt: ${payload.retry_count})`);
            await handleCommand(payload.command);
          }
        } catch (err) {
          logger.error("Error in message consumer logic:", err);
        }
      },
    });
  } catch (err) {
    logger.error("Failed to initialize consumer client", err);
  }
}

module.exports = { start };
