const logger = require("../../../../shared/logger")("circuit-breaker");

class CircuitBreaker {
  constructor() {
    this.state = "CLOSED"; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.failureThreshold = 5;
    this.cooldownPeriodMs = 30000; // 30 seconds
    this.lastStateTransitionTime = Date.now();
  }

  /**
   * Evaluates if requests are permitted.
   * If OPEN and cooldown over, transitions to HALF_OPEN.
   * @returns {boolean} true if call is allowed, false if blocked
   */
  allowRequest() {
    const now = Date.now();

    if (this.state === "OPEN") {
      if (now - this.lastStateTransitionTime > this.cooldownPeriodMs) {
        logger.info(`Circuit cooldown period over. Transitioning from OPEN -> HALF_OPEN. Testing connectivity...`);
        this.state = "HALF_OPEN";
        this.lastStateTransitionTime = now;
        return true;
      }
      logger.warn(`Circuit is OPEN. Fast-failing downstream request. (Time remaining: ${Math.ceil((this.cooldownPeriodMs - (now - this.lastStateTransitionTime)) / 1000)}s)`);
      return false;
    }

    return true;
  }

  /**
   * Registers a successful downstream API call.
   */
  recordSuccess() {
    this.failureCount = 0;
    if (this.state !== "CLOSED") {
      logger.success(`Downstream call succeeded! Transitioning from ${this.state} -> CLOSED. Circuit reset.`);
      this.state = "CLOSED";
      this.lastStateTransitionTime = Date.now();
    }
  }

  /**
   * Registers a failed downstream API call.
   */
  recordFailure() {
    this.failureCount++;
    logger.warn(`Downstream call failed. Consecutive failure count: ${this.failureCount}/${this.failureThreshold}`);

    if (this.state === "CLOSED" && this.failureCount >= this.failureThreshold) {
      this.state = "OPEN";
      this.lastStateTransitionTime = Date.now();
      logger.error(`🚨 CIRCUIT BREAKER TRIPPED! 10 consecutive failures detected. State transitioning CLOSED -> OPEN. Downstream calls blocked for 30s.`);
    } else if (this.state === "HALF_OPEN") {
      // Any failure in HALF_OPEN trips it right back to OPEN
      this.state = "OPEN";
      this.lastStateTransitionTime = Date.now();
      logger.error(`🚨 Downstream call failed during HALF_OPEN probe! State transitioning back to OPEN. Blocked for 30s.`);
    }
  }

  getState() {
    return this.state;
  }
}

module.exports = new CircuitBreaker();
