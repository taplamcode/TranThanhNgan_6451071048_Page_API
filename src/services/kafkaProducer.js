const { Kafka, logLevel } = require("kafkajs");

class KafkaProducer {
  constructor() {
    const brokerList = process.env.KAFKA_BROKERS || "localhost:9092";

    this.topic = process.env.KAFKA_TOPIC || "raw_events";
    this.maxRetries = Number.parseInt(process.env.KAFKA_CONNECT_RETRIES || "10", 10);
    this.retryDelayMs = Number.parseInt(process.env.KAFKA_CONNECT_RETRY_DELAY_MS || "2000", 10);

    const kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID || "webhook-service",
      brokers: brokerList
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      logLevel: logLevel.NOTHING,
    });

    this.producer = kafka.producer();
    this.connected = false;
  }

  async connect() {
    if (this.connected) {
      return;
    }

    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt += 1) {
      try {
        await this.producer.connect();
        this.connected = true;
        console.log(`Kafka producer connected (attempt ${attempt})`);
        return;
      } catch (error) {
        lastError = error;
        console.warn(`Kafka connect failed (attempt ${attempt}/${this.maxRetries}): ${error.message}`);

        if (attempt < this.maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
        }
      }
    }

    throw new Error(`Cannot connect to Kafka after ${this.maxRetries} attempts: ${lastError?.message || "Unknown error"}`);
  }

  async sendRawEvent(event) {
    if (!this.connected) {
      await this.connect();
    }

    const key = event?.page_id || event?.event_id || null;

    await this.producer.send({
      topic: this.topic,
      messages: [
        {
          key,
          value: JSON.stringify(event),
        },
      ],
    });
  }

  async disconnect() {
    if (!this.connected) {
      return;
    }

    await this.producer.disconnect();
    this.connected = false;
  }
}

module.exports = KafkaProducer;
