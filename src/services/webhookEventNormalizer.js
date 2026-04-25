function buildBaseEvent({ eventType, pageId, entryTime, payload, raw }) {
  const now = new Date();
  const occurredAt = Number.isFinite(entryTime)
    ? new Date(entryTime * 1000)
    : now;

  return {
    event_id: `${pageId || "unknown"}-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    source: "facebook",
    event_type: eventType,
    page_id: pageId || null,
    occurred_at: occurredAt.toISOString(),
    received_at: now.toISOString(),
    payload,
    raw,
  };
}

function normalizeFacebookPayload(body) {
  const normalizedEvents = [];

  if (!body || !Array.isArray(body.entry)) {
    return normalizedEvents;
  }

  for (const entry of body.entry) {
    const pageId = entry?.id || null;
    const entryTime = Number(entry?.time);

    if (Array.isArray(entry.messaging)) {
      for (const messageEvent of entry.messaging) {
        normalizedEvents.push(
          buildBaseEvent({
            eventType: "message",
            pageId,
            entryTime,
            payload: {
              sender_id: messageEvent?.sender?.id || null,
              recipient_id: messageEvent?.recipient?.id || null,
              message_id: messageEvent?.message?.mid || null,
              message_text: messageEvent?.message?.text || null,
              is_echo: Boolean(messageEvent?.message?.is_echo),
            },
            raw: messageEvent,
          })
        );
      }
    }

    if (Array.isArray(entry.changes)) {
      for (const change of entry.changes) {
        const value = change?.value || {};
        const field = change?.field || "unknown";

        let eventType = `change:${field}`;

        if (field === "feed" && value.item === "comment") {
          eventType = "comment";
        }

        normalizedEvents.push(
          buildBaseEvent({
            eventType,
            pageId,
            entryTime,
            payload: {
              field,
              item: value.item || null,
              verb: value.verb || null,
              post_id: value.post_id || null,
              comment_id: value.comment_id || null,
              parent_id: value.parent_id || null,
              message: value.message || null,
              from: value.from || null,
              created_time: value.created_time || null,
            },
            raw: change,
          })
        );
      }
    }
  }

  return normalizedEvents;
}

module.exports = {
  normalizeFacebookPayload,
};
