const crypto = require("crypto");
const express = require("express");
const config = require("./config");
const logger = require("../../../shared/logger")("webhook-service");
const { TOPICS } = require("../../../shared/constants");
const KafkaProducer = require("./services/kafkaProducer");
const { normalizeFacebookPayload } = require("./services/webhookEventNormalizer");

const app = express();
const port = config.port;
const producer = new KafkaProducer();

app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString("utf8");
    },
  })
);

app.get("/", (req, res) => {
  return res.send(`
    <div style="font-family: sans-serif; padding: 2rem; line-height: 1.6;">
      <h1 style="color: #1877f2;">Facebook Webhook Service</h1>
      <p>Status: <strong>Running</strong> (Monorepo Microservice)</p>
      <p>Available endpoints:</p>
      <ul>
        <li><code>GET /health</code> - Service health check</li>
        <li><code>GET /webhook</code> - Facebook verification endpoint</li>
        <li><code>POST /webhook</code> - Event reception endpoint</li>
      </ul>
    </div>
  `);
});

app.get("/health", (req, res) => {
  return res.json({ status: "ok", service: "webhook-service" });
});

app.get("/webhook", (req, res) => {
  logger.info("Received verification request from Facebook");
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === config.facebook.verifyToken) {
    logger.success("Verification successful!");
    return res.status(200).send(challenge);
  }

  logger.error("Verification failed: Token mismatch");
  return res.status(403).json({ message: "Forbidden: verify token mismatch" });
});

app.post("/webhook", async (req, res) => {
  logger.info("Received a new webhook event payload from Facebook");
  try {
    const { skipSignature, appSecret } = config.facebook;

    if (!skipSignature) {
      if (!appSecret) {
        logger.error("Missing FACEBOOK_APP_SECRET in environment configs!");
        return res.status(500).json({ message: "Missing FACEBOOK_APP_SECRET" });
      }

      const signature = req.headers["x-hub-signature-256"];
      if (!isValidFacebookSignature(req.rawBody || "", signature, appSecret)) {
        logger.error("Invalid webhook signature header!");
        return res.status(401).json({ message: "Invalid webhook signature" });
      }
      logger.success("Webhook signature verified successfully.");
    }

    const events = normalizeFacebookPayload(req.body);
    logger.info(`Payload normalized into ${events.length} event(s)`);

    if (events.length === 0) {
      return res.status(202).json({ status: "accepted", published: 0 });
    }

    await Promise.all(events.map((event) => producer.sendRawEvent(event)));
    logger.success(`Published ${events.length} event(s) to Kafka topic: ${TOPICS.RAW_EVENTS}`);

    return res.status(202).json({
      status: "accepted",
      topic: TOPICS.RAW_EVENTS,
      published: events.length,
    });
  } catch (error) {
    logger.error("Error processing webhook payload", error);
    return res.status(500).json({ message: "Webhook processing failed", detail: error.message });
  }
});

function isValidFacebookSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || typeof signatureHeader !== "string") {
    return false;
  }

  const expected = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const signatureBuffer = Buffer.from(signatureHeader);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

async function start() {
  try {
    await producer.connect();
    app.listen(port, () => {
      logger.success(`Webhook microservice is running at http://localhost:${port}`);
    });
  } catch (error) {
    logger.error("Unable to start webhook service", error);
    process.exit(1);
  }
}

start();

async function shutdown() {
  logger.info("Gracefully shutting down webhook service...");
  await producer.disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
