require("dotenv").config();

module.exports = {
  port: Number.parseInt(process.env.WEBHOOK_PORT || "3001", 10),
  facebook: {
    verifyToken: process.env.FACEBOOK_VERIFY_TOKEN || "thanhngan",
    appSecret: process.env.FACEBOOK_APP_SECRET || "",
    skipSignature: String(process.env.WEBHOOK_SKIP_SIGNATURE || "false").toLowerCase() === "true",
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || "localhost:9092")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    connectRetries: Number.parseInt(process.env.KAFKA_CONNECT_RETRIES || "10", 10),
    connectRetryDelayMs: Number.parseInt(process.env.KAFKA_CONNECT_RETRY_DELAY_MS || "2000", 10),
  },
};
