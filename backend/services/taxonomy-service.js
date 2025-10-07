// backend/services/taxonomy-service.js
const fs = require("fs").promises;
const path = require("path");

class TaxonomyService {
  constructor() {
    this.file = path.join(__dirname, "../data/taxonomy/canon.json");
    this.lock = false;
  }

  async _acquire() { while (this.lock) await new Promise(r => setTimeout(r, 8)); this.lock = true; }
  _release() { this.lock = false; }

  async _read() {
    try {
      const raw = await fs.readFile(this.file, "utf8");
      const data = JSON.parse(raw || "{}");
      if (!data.entries) data.entries = [];
      return data;
    } catch {
      return { version: 1, updatedAt: new Date().toISOString(), entries: [] };
    }
  }

  async _write(data) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = this.file + ".tmp";
    data.version = (data.version || 1);
    data.updatedAt = new Date().toISOString();
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
    await fs.rename(tmp, this.file);
  }

  // ---- helpers ----
  _normalizeKey(s) {
    return String(s || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  _normalizeEntry(e) {
    return {
      key: this._normalizeKey(e.key || e.label),
      label: String(e.label || e.key || "").trim(),
      category: String(e.category || "").trim().toLowerCase(),
      synonyms: Array.isArray(e.synonyms) ? e.synonyms.map(s => String(s).trim()).filter(Boolean) : [],
      implies: Array.isArray(e.implies) ? e.implies.map(k => this._normalizeKey(k)).filter(Boolean) : [],
      tags: Array.isArray(e.tags) ? e.tags.map(t => String(t).trim()).filter(Boolean) : [],
      vendor: e.vendor ?? null,
      deprecated: !!e.deprecated,
      notes: String(e.notes || "").trim()
    };
  }

  // ---- CRUD ----
  async list() {
    const data = await this._read();
    return data.entries;
  }

  async get(key) {
    key = this._normalizeKey(key);
    const data = await this._read();
    return data.entries.find(e => e.key === key) || null;
  }

  async create(entry) {
    const e = this._normalizeEntry(entry);
    if (!e.key || !e.label || !e.category) throw new Error("key/label/category required");
    await this._acquire();
    try {
      const data = await this._read();
      if (data.entries.some(x => x.key === e.key)) throw new Error("Key already exists");
      data.entries.push(e);
      await this._write(data);
      return e;
    } finally { this._release(); }
  }

  async update(key, patch) {
    key = this._normalizeKey(key);
    await this._acquire();
    try {
      const data = await this._read();
      const idx = data.entries.findIndex(e => e.key === key);
      if (idx === -1) throw new Error("Not found");
      const current = data.entries[idx];
      const next = this._normalizeEntry({ ...current, ...patch, key: current.key });
      data.entries[idx] = next;
      await this._write(data);
      return next;
    } finally { this._release(); }
  }

  async remove(key) {
    key = this._normalizeKey(key);
    await this._acquire();
    try {
      const data = await this._read();
      const idx = data.entries.findIndex(e => e.key === key);
      if (idx === -1) return { success: false, error: "Not found" };
      data.entries.splice(idx, 1);
      await this._write(data);
      return { success: true };
    } finally { this._release(); }
  }

  // ---- search & resolve ----
  async search(q = "", { category } = {}) {
    const needle = String(q || "").toLowerCase();
    const data = await this._read();
    const hit = (e) =>
      e.key.includes(needle) ||
      e.label.toLowerCase().includes(needle) ||
      e.synonyms.some(s => s.toLowerCase().includes(needle)) ||
      e.tags.some(t => t.toLowerCase().includes(needle));
    return data.entries.filter(e => hit(e) && (!category || e.category === String(category).toLowerCase()));
  }

  /**
   * Resolve free-text tokens to canonical keys:
   * 1) direct match on key/label/synonyms (case/spacing/periods insensitive)
   * 2) expand via "implies"
   */
  async resolve(tokens = []) {
    const data = await this._read();
    const norm = (s) => String(s || "").toLowerCase().replace(/[\s._-]+/g, "").trim();
    const byKey = new Map(data.entries.map(e => [e.key, e]));
    const index = [];
    for (const e of data.entries) {
      index.push([norm(e.key), e.key]);
      index.push([norm(e.label), e.key]);
      for (const syn of e.synonyms) index.push([norm(syn), e.key]);
    }
    const direct = new Set();
    for (const t of tokens) {
      const n = norm(t);
      const match = index.find(([n2]) => n2 === n);
      if (match) direct.add(match[1]);
    }
    // implication expansion (BFS)
    const result = new Set(direct);
    const queue = [...direct];
    while (queue.length) {
      const k = queue.shift();
      const e = byKey.get(k);
      if (!e) continue;
      for (const implied of e.implies || []) {
        if (!result.has(implied)) {
          result.add(implied);
          queue.push(implied);
        }
      }
    }
    return Array.from(result);
  }

  // ---- bulk ----
  async replaceAll(entries) {
    await this._acquire();
    try {
      const data = { version: 1, updatedAt: new Date().toISOString(), entries: [] };
      data.entries = (Array.isArray(entries) ? entries : []).map(e => this._normalizeEntry(e));
      await this._write(data);
      return { success: true, count: data.entries.length };
    } finally { this._release(); }
  }

  async exportAll() {
    return await this._read();
  }
}

module.exports = new TaxonomyService();