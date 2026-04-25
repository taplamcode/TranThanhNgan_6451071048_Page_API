require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const KafkaProducer = require("./services/kafkaProducer");
const { normalizeFacebookPayload } = require("./services/webhookEventNormalizer");

const app = express();
const port = Number.parseInt(process.env.WEBHOOK_PORT || "3001", 10);

const producer = new KafkaProducer();
const verifyToken = process.env.FACEBOOK_VERIFY_TOKEN || "my_verify_token";
const appSecret = process.env.FACEBOOK_APP_SECRET || "";
const skipSignature = String(process.env.WEBHOOK_SKIP_SIGNATURE || "false").toLowerCase() === "true";

app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString("utf8");
    },
  })
);

app.get("/health", (req, res) => {
  return res.json({ status: "ok", service: "webhook-service" });
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  // Xác thực endpoint theo flow chuẩn khi Facebook subscribe webhook.
  if (mode === "subscribe" && token === verifyToken) {
    return res.status(200).send(challenge);
  }

  return res.status(403).json({ message: "Forbidden: verify token mismatch" });
});

app.post("/webhook", async (req, res) => {
  console.log("\n--- [POST /webhook] RECEIVED NEW EVENT ---");
  try {
    if (!skipSignature) {
      if (!appSecret) {
        console.error("-> ERROR: Missing FACEBOOK_APP_SECRET");
        return res.status(500).json({ message: "Missing FACEBOOK_APP_SECRET" });
      }

      const signature = req.headers["x-hub-signature-256"];

      if (!isValidFacebookSignature(req.rawBody || "", signature, appSecret)) {
        console.error("-> ERROR: Invalid webhook signature!");
        console.error("-> Facebook sent signature:", signature);
        return res.status(401).json({ message: "Invalid webhook signature" });
      }
      
      console.log("-> Signature validated successfully!");
    }

    const events = normalizeFacebookPayload(req.body);

    if (events.length === 0) {
      return res.status(202).json({ status: "accepted", published: 0 });
    }

    await Promise.all(events.map((event) => producer.sendRawEvent(event)));

    return res.status(202).json({
      status: "accepted",
      topic: producer.topic,
      published: events.length,
    });
  } catch (error) {
    console.error("Webhook processing failed:", error.message);
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
      console.log(`Webhook service is running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Cannot start webhook service:", error.message);
    process.exit(1);
  }
}

start();

async function shutdown() {
  await producer.disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
