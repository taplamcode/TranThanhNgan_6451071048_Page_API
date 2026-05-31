const { Kafka, logLevel } = require("kafkajs");
const config = require("../config");
const logger = require("../../../../shared/logger")("webhook-producer");
const { TOPICS } = require("../../../../shared/constants");

class KafkaProducer {
  constructor() {
    const kafka = new Kafka({
      clientId: "webhook-service",
      brokers: config.kafka.brokers,
      logLevel: logLevel.NOTHING,
    });

    this.producer = kafka.producer();
    this.connected = false;
  }

  async connect() {
    if (this.connected) return;

    let lastError;
    const { connectRetries, connectRetryDelayMs } = config.kafka;

    for (let attempt = 1; attempt <= connectRetries; attempt += 1) {
      try {
        await this.producer.connect();
        this.connected = true;
        logger.success(`Kafka producer connected (attempt ${attempt})`);
        return;
      } catch (error) {
        lastError = error;
        logger.warn(`Kafka connect failed (attempt ${attempt}/${connectRetries}): ${error.message}`);

        if (attempt < connectRetries) {
          await new Promise((resolve) => setTimeout(resolve, connectRetryDelayMs));
        }
      }
    }

    logger.error("Failed to connect to Kafka", lastError);
    throw new Error(`Cannot connect to Kafka after ${connectRetries} attempts.`);
  }

  async sendRawEvent(event) {
    if (!this.connected) {
      await this.connect();
    }

    const key = event?.page_id || event?.event_id || null;

    await this.producer.send({
      topic: TOPICS.RAW_EVENTS,
      messages: [
        {
          key,
          value: JSON.stringify(event),
        },
      ],
    });
  }

  async disconnect() {
    if (!this.connected) return;
    await this.producer.disconnect();
    this.connected = false;
    logger.info("Kafka producer disconnected successfully");
  }
}

module.exports = KafkaProducer;
