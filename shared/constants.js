module.exports = {
  TOPICS: {
    RAW_EVENTS: "raw_events",
    REPLY_COMMANDS: "reply_commands",
    SEND_FAILED: "send_failed",
    SEND_RETRY: "send_retry",
    DEAD_LETTER: "dead_letter",
  },
  GROUPS: {
    WEBHOOK: "webhook-service-group",
    CORE: "core-service-group",
    BACKEND: "backend-api-consumer-group",
    RETRY: "retry-service-group",
  },
};
