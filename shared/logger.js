class Logger {
  constructor(serviceName) {
    this.serviceName = serviceName.toUpperCase();
  }

  getTimestamp() {
    return new Date().toISOString();
  }

  info(message, ...args) {
    console.log(`[${this.getTimestamp()}] ℹ️  [${this.serviceName}] ${message}`, ...args);
  }

  success(message, ...args) {
    console.log(`[${this.getTimestamp()}] ✅ [${this.serviceName}] ${message}`, ...args);
  }

  warn(message, ...args) {
    console.warn(`[${this.getTimestamp()}] ⚠️  [${this.serviceName}] ${message}`, ...args);
  }

  error(message, error, ...args) {
    const errorDetails = error ? ` | Details: ${error.stack || error.message || error}` : "";
    console.error(`[${this.getTimestamp()}] ❌ [${this.serviceName}] ${message}${errorDetails}`, ...args);
  }

  debug(message, ...args) {
    if (process.env.DEBUG === "true") {
      console.log(`[${this.getTimestamp()}] 🔍 [${this.serviceName}] ${message}`, ...args);
    }
  }
}

module.exports = (serviceName) => new Logger(serviceName);
