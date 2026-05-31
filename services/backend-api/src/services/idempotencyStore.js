const fs = require("fs");
const path = require("path");

class IdempotencyStore {
  constructor() {
    this.filePath = path.join(process.cwd(), "data", "idempotency.json");
    this.ensureDirectoryExistence();
  }

  ensureDirectoryExistence() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify({}), "utf8");
    }
  }

  readStore() {
    try {
      this.ensureDirectoryExistence();
      const content = fs.readFileSync(this.filePath, "utf8");
      return JSON.parse(content);
    } catch (error) {
      console.error("Error reading idempotency store:", error.message);
      return {};
    }
  }

  writeStore(data) {
    try {
      this.ensureDirectoryExistence();
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf8");
      return true;
    } catch (error) {
      console.error("Error writing to idempotency store:", error.message);
      return false;
    }
  }

  has(key) {
    if (!key) return false;
    const store = this.readStore();
    return store[key] === "SUCCESS" || store[key] === "PROCESSING";
  }

  set(key, status) {
    if (!key) return;
    const store = this.readStore();
    store[key] = status;
    this.writeStore(store);
  }

  get(key) {
    if (!key) return null;
    const store = this.readStore();
    return store[key] || null;
  }
}

module.exports = new IdempotencyStore();
