const logger = require("../../../../shared/logger")("spam-rate-rule");

const BANNED_KEYWORDS = [
  "mua bán",
  "tiền số",
  "crypto",
  "bitcoin",
  "lừa đảo",
  "spam",
  "rác",
  "xổ số",
  "cá độ",
  "cờ bạc",
  "coin",
  "nhận quà",
  "nhận tiền",
  "free coin",
  "kiếm tiền",
  "đầu tư",
  "scam",
  "hack",
  "miễn phí",
  "click ngay",
  "bấm vào",
];

const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/i;

// In-memory rate limiting store: userId -> Array of timestamps (ms)
const userAccessRecords = new Map();
const WINDOW_MS = 60000; // 1 minute
const MAX_LIMIT = 5; // max 5 comments/messages per minute

/**
 * Validates text against spam keywords.
 * @param {string} text 
 * @returns {boolean} true if spam, false otherwise
 */
function isSpam(text) {
  if (!text || typeof text !== "string") return false;
  
  const lowerText = text.toLowerCase();
  for (const word of BANNED_KEYWORDS) {
    if (lowerText.includes(word)) {
      logger.warn(`Spam keyword matched: "${word}" in text: "${text.slice(0, 30)}..."`);
      return true;
    }
  }

  return false;
}

/**
 * Checks if the text contains any URLs or external links.
 * @param {string} text 
 * @returns {boolean} true if contains link, false otherwise
 */
function containsLink(text) {
  if (!text || typeof text !== "string") return false;
  const match = URL_REGEX.test(text);
  if (match) {
    logger.warn(`Potential malicious link or URL found in text: "${text}"`);
  }
  return match;
}

/**
 * User rate limiting check in a rolling window of 1 minute.
 * If user sends > 5 events within 1 minute, flags as abnormal.
 * @param {string} userId 
 * @returns {boolean} true if limit exceeded, false otherwise
 */
function isRateLimited(userId) {
  if (!userId) return false;
  
  const now = Date.now();
  if (!userAccessRecords.has(userId)) {
    userAccessRecords.set(userId, [now]);
    return false;
  }

  // Filter timestamps within the 1-minute window
  const timestamps = userAccessRecords.get(userId);
  const validTimestamps = timestamps.filter((time) => now - time < WINDOW_MS);
  
  validTimestamps.push(now);
  userAccessRecords.set(userId, validTimestamps);

  if (validTimestamps.length > MAX_LIMIT) {
    logger.warn(`Rate limit triggered for user ${userId}: ${validTimestamps.length} events in last 60 seconds.`);
    return true;
  }

  return false;
}

module.exports = {
  isSpam,
  containsLink,
  isRateLimited,
};
