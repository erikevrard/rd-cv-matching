// backend/services/llm-service.js
const fs = require("fs").promises;
const path = require("path");

class LLMService {
  constructor() {
    this.dataPath = path.join(__dirname, "../data/llms");
    this.locks = new Map(); // per-user lock
  }

  // ---------- locking ----------
  async acquireLock(userId) {
    while (this.locks.get(userId)) {
      await new Promise((r) => setTimeout(r, 10));
    }
    this.locks.set(userId, true);
  }
  releaseLock(userId) {
    this.locks.delete(userId);
  }

  // ---------- file helpers ----------
  getUserFile(userId) {
    return path.join(this.dataPath, `${userId}_llms.json`);
  }

  async atomicWrite(filePath, data) {
    const tmp = `${filePath}.tmp`;
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(tmp, data, "utf8");
    await fs.rename(tmp, filePath);
  }

  async loadAll(userId) {
    const file = this.getUserFile(userId);
    try {
      const raw = await fs.readFile(file, "utf8");
      const arr = JSON.parse(raw || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  async saveAll(userId, list) {
    await this.acquireLock(userId);
    try {
      const file = this.getUserFile(userId);
      await this.atomicWrite(file, JSON.stringify(list, null, 2));
    } finally {
      this.releaseLock(userId);
    }
  }

  // ---------- helpers ----------
  normalize(s) {
    return (s == null ? "" : String(s)).trim();
  }

  code4(s) {
    return this
      .normalize(s)
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase()
      .slice(0, 4)
      .padEnd(4, "X");
  }

  version3(v) {
    const norm = this.normalize(v).toUpperCase();
    // keep digits and letters; drop separators
    const compact = norm.replace(/[^A-Z0-9]/g, "");
    return (compact || "V10").slice(0, 3).padEnd(3, "0");
  }

  buildMnemonic(providerOrModel, version) {
    return `${this.code4(providerOrModel)}_${this.version3(version)}`; // e.g., GPT4_251
  }

  maskKey(key) {
    if (!key) return null;
    const s = String(key);
    if (s.length <= 8) return "****";
    return `${s.slice(0, 3)}…${s.slice(-4)}`;
    // UI safe: show first 3 + last 4
  }

  // ---------- public API ----------
  async createConfig(userId, payload) {
    const {
      name,            // free text (e.g. "OpenAI", "Anthropic", "Local Ollama")
      model,           // e.g. "gpt-4o-mini", "claude-3.5-sonnet"
      version,         // e.g. "2025-06-01" or "v1"
      apiUrl,          // base URL endpoint
      apiKey,          // secret
      headers = {},    // optional extra headers
      temperature = 0, // defaults
      maxTokens = 1024,
      timeoutMs = 30000,
    } = payload || {};

    if (!userId) throw new Error("userId required");
    if (!model) throw new Error("model required");
    if (!version) throw new Error("version required");
    if (!apiUrl) throw new Error("apiUrl required");

    const list = await this.loadAll(userId);
    const base = this.buildMnemonic(model || name, version);
    const existing = new Set(list.map(x => x.mnemonic));
    let mnemonic = base;
    if (existing.has(mnemonic)) {
      for (let i = 2; i < 1000; i++) {
        const cand = `${base}${i}`;
        if (!existing.has(cand)) { mnemonic = cand; break; }
      }
    }

    const now = new Date().toISOString();
    const record = {
      mnemonic,
      userId,
      name: this.normalize(name) || null,
      model: this.normalize(model),
      version: this.normalize(version),
      apiUrl: this.normalize(apiUrl),
      apiKey: apiKey || null,
      headers: headers && typeof headers === "object" ? headers : {},
      temperature: Number(temperature) || 0,
      maxTokens: Number(maxTokens) || 1024,
      timeoutMs: Number(timeoutMs) || 30000,
      active: false,
      createdAt: now,
      updatedAt: now,
    };

    list.unshift(record);
    await this.saveAll(userId, list);
    return record;
  }

  async list(userId) {
    return await this.loadAll(userId);
  }

  async getActive(userId) {
    const list = await this.loadAll(userId);
    return list.find(x => x.active) || null;
  }

  async setActive(userId, mnemonic, active) {
    const list = await this.loadAll(userId);
    let found = false;

    if (active) {
      for (const r of list) {
        if (r.mnemonic === mnemonic) {
          r.active = true; found = true;
        } else {
          r.active = false;
        }
        r.updatedAt = new Date().toISOString();
      }
    } else {
      for (const r of list) {
        if (r.mnemonic === mnemonic) {
          r.active = false; found = true;
          r.updatedAt = new Date().toISOString();
        }
      }
    }

    if (!found) return { success: false, error: "Not found" };
    await this.saveAll(userId, list);
    return { success: true };
  }

  async delete(userId, mnemonic) {
    const list = await this.loadAll(userId);
    const idx = list.findIndex(r => r.mnemonic === mnemonic);
    if (idx === -1) return { success: false, error: "Not found" };
    list.splice(idx, 1);
    await this.saveAll(userId, list);
    return { success: true };
  }

  // Masked view for API responses
  toPublic(record) {
    return {
      ...record,
      apiKey: record.apiKey ? this.maskKey(record.apiKey) : null,
    };
  }
}

module.exports = new LLMService();