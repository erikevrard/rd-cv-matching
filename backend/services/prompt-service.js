// backend/services/prompt-service.js
const fs = require("fs").promises;
const path = require("path");

class PromptService {
  constructor() {
    this.dataPath = path.join(__dirname, "../data/prompts");
    this.locks = new Map(); // per-user lock
  }

  // ----- locking -----
  async _acquire(userId) {
    while (this.locks.get(userId)) {
      await new Promise(r => setTimeout(r, 10));
    }
    this.locks.set(userId, true);
  }
  _release(userId) {
    this.locks.delete(userId);
  }

  // ----- file helpers -----
  _file(userId) {
    return path.join(this.dataPath, `${userId}_prompts.json`);
  }
  async _atomicWrite(filePath, data) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp`;
    await fs.writeFile(tmp, data, "utf8");
    await fs.rename(tmp, filePath);
  }
  async _load(userId) {
    const file = this._file(userId);
    try {
      const raw = await fs.readFile(file, "utf8");
      const arr = JSON.parse(raw || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }
  async _save(userId, list) {
    await this._acquire(userId);
    try {
      const file = this._file(userId);
      await this._atomicWrite(file, JSON.stringify(list, null, 2));
    } finally {
      this._release(userId);
    }
  }

  // ----- normalization & validation -----
  _normStr(s) {
    return (s == null ? "" : String(s)).trim();
  }
  _normMnemonic(m) {
    // Uppercase, keep A-Z 0-9 and underscores, collapse spaces/dashes to underscore
    const s = this._normStr(m).replace(/[\s\-]+/g, "_").toUpperCase();
    return s.replace(/[^A-Z0-9_]/g, "").slice(0, 40);
  }

  // ----- CRUD -----
  async listPrompts(userId) {
    return await this._load(userId);
  }

  async getPrompt(userId, mnemonic) {
    const list = await this._load(userId);
    const m = this._normMnemonic(mnemonic);
    return list.find(p => p.mnemonic === m) || null;
  }

  /**
   * Create prompt
   * Required: userId, mnemonic, text
   * Optional: title, tags (string[])
   */
  async createPrompt(userId, { mnemonic, text, title, tags }) {
    if (!userId) throw new Error("userId required");
    const m = this._normMnemonic(mnemonic);
    if (!m) throw new Error("mnemonic required");
    const t = this._normStr(text);
    if (!t) throw new Error("text required");

    const list = await this._load(userId);
    if (list.some(p => p.mnemonic === m)) {
      throw new Error("mnemonic already exists");
    }
    const now = new Date().toISOString();
    const record = {
      mnemonic: m,
      title: this._normStr(title),
      text: t,
      tags: Array.isArray(tags) ? tags.map(x => this._normStr(x)).filter(Boolean) : [],
      createdAt: now,
      updatedAt: now
    };
    list.unshift(record);
    await this._save(userId, list);
    return record;
  }

  /**
   * Update prompt (by mnemonic).
   * patch: { text?, title?, tags?, newMnemonic? }
   */
  async updatePrompt(userId, mnemonic, patch = {}) {
    const list = await this._load(userId);
    const m = this._normMnemonic(mnemonic);
    const idx = list.findIndex(p => p.mnemonic === m);
    if (idx === -1) throw new Error("not found");

    // Handle optional mnemonic rename
    let newMnemonic = this._normMnemonic(patch.newMnemonic || m);
    if (newMnemonic !== m && list.some(p => p.mnemonic === newMnemonic)) {
      throw new Error("new mnemonic already exists");
    }

    const current = list[idx];
    const next = {
      ...current,
      mnemonic: newMnemonic,
      title: patch.title != null ? this._normStr(patch.title) : current.title,
      text: patch.text != null ? this._normStr(patch.text) : current.text,
      tags: Array.isArray(patch.tags)
        ? patch.tags.map(x => this._normStr(x)).filter(Boolean)
        : current.tags,
      updatedAt: new Date().toISOString()
    };

    // If mnemonic changed, ensure unique & move record
    if (newMnemonic !== m) {
      list.splice(idx, 1);
      list.unshift(next);
    } else {
      list[idx] = next;
    }
    await this._save(userId, list);
    return next;
  }

  async deletePrompt(userId, mnemonic) {
    const list = await this._load(userId);
    const m = this._normMnemonic(mnemonic);
    const idx = list.findIndex(p => p.mnemonic === m);
    if (idx === -1) return { success: false, error: "not found" };
    list.splice(idx, 1);
    await this._save(userId, list);
    return { success: true };
  }
}

module.exports = new PromptService();