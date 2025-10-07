// backend/services/tender-search-service.js
const fs = require("fs").promises;
const path = require("path");

class TenderSearchService {
  constructor() {
    this.dataPath = path.join(__dirname, "../data/tender-searches");
    this.locks = new Map(); // per-user in-memory lock
  }

  // Return the active tender search (or null)
  async getActive(userId) {
    const list = await this.loadAll(userId);
    return list.find(r => r.active) || null;
  }

  // Remove all searches for a user (returns count deleted)
  async clearAll(userId) {
    const current = await this.loadAll(userId);
    await this.saveAll(userId, []); // atomic + locked
    return { success: true, deleted: current.length };
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
    return path.join(this.dataPath, `${userId}_tender_searches.json`);
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

  // ---------- normalize helpers ----------
  normalizeStr(s) {
    return (s == null ? "" : String(s)).trim();
  }
  onlyLettersUpper(s) {
    return this.normalizeStr(s).replace(/[^A-Za-z]/g, "").toUpperCase();
  }
  /** Accepts string or string[]; splits string on newlines or bullet chars to array */
  normalizeBulletish(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
    const s = String(v);
    return s
      .split(/\r?\n|•/g)           // split on newlines or bullets
      .map(x => x.replace(/^[\s*-•]+/, "").trim()) // trim leading list chars
      .filter(Boolean);
  }

  // Seniority → 3-letter code
  getSeniorityCode(seniority) {
    const s = this.normalizeStr(seniority).toLowerCase();
    const map = {
      intern: "INT",
      trainee: "INT",
      junior: "JUN",
      medior: "MED",
      intermediate: "MED",
      mid: "MED",
      proficient: "PRO",
      professional: "PRO",
      senior: "SEN",
      lead: "LEA",
      principal: "PRI",
      staff: "STF",
      manager: "MGR",
      director: "DIR",
      executive: "EXE",
      head: "HED",
      associate: "ASC",
      consultant: "CON",
    };
    if (map[s]) return map[s];
    if (/intern|trainee/.test(s)) return "INT";
    if (/jun/.test(s)) return "JUN";
    if (/med|intermediate|mid/.test(s)) return "MED";
    if (/profici|profes/.test(s)) return "PRO";
    if (/sen/.test(s)) return "SEN";
    if (/lead/.test(s)) return "LEA";
    if (/princi|staff/.test(s)) return "PRI";
    if (/manag/.test(s)) return "MGR";
    if (/director/.test(s)) return "DIR";
    if (/exec/.test(s)) return "EXE";
    const letters = this.onlyLettersUpper(seniority);
    return (letters + "XXX").slice(0, 3);
  }

  // Profile title → 4-letter code
  getProfileCode(profileTitle) {
    const p = this.normalizeStr(profileTitle).toLowerCase();
    const map = {
      "backend developer": "BACK",
      backend: "BACK",
      "frontend developer": "FRON",
      frontend: "FRON",
      "full stack developer": "FULL",
      "fullstack developer": "FULL",
      "mobile developer": "MOBI",
      devops: "DVOP",
      "devops engineer": "DVOP",
      "data analyst": "DATA",
      "data scientist": "DSCI",
      "machine learning engineer": "MLEN",
      "ml engineer": "MLEN",
      "ai specialist": "AISP",
      "ux designer": "UXDE",
      "ui designer": "UIDE",
      "graphic designer": "GRDE",
      copywriter: "COPY",
      "content strategist": "CONT",
      "product manager": "PRDM",
      "project manager": "PROJ",
      "program manager": "PROG",
      "qa engineer": "QENG",
      tester: "TEST",
      "software architect": "ARCH",
      "solution architect": "SOLU",
      "security analyst": "SECU",
      "system administrator": "SYAD",
      "systems administrator": "SYAD",
      "digital marketer": "DMAR",
      "communications officer": "COMM",
      "communications manager": "COMM",
      "operations manager": "OPER",
      "general manager": "GENM",
      architect: "ARCH",
      "ux/ui designer": "UXDE",
      "frontend engineer": "FRON",
      "backend engineer": "BACK",
      "ai engineer": "AISP",
      webmaster: "WEBM",
      "digital technical expert": "DIGT",
      "portfolio manager": "PORT",
    };
    if (map[p]) return map[p];
    if (/back/.test(p)) return "BACK";
    if (/front/.test(p)) return "FRON";
    if (/full.?stack/.test(p)) return "FULL";
    if (/devops/.test(p)) return "DVOP";
    if (/data scientist/.test(p)) return "DSCI";
    if (/data/.test(p)) return "DATA";
    if (/(ml|machine learning)/.test(p)) return "MLEN";
    if (/\bai\b/.test(p)) return "AISP";
    if (/\bux\b/.test(p)) return "UXDE";
    if (/\bui\b/.test(p)) return "UIDE";
    if (/graphic/.test(p)) return "GRDE";
    if (/copy/.test(p)) return "COPY";
    if (/content/.test(p)) return "CONT";
    if (/product manager/.test(p)) return "PRDM";
    if (/project manager/.test(p)) return "PROJ";
    if (/program manager/.test(p)) return "PROG";
    if (/\bqa\b|quality/.test(p)) return "QENG";
    if (/test/.test(p)) return "TEST";
    if (/architect/.test(p)) return "ARCH";
    if (/solution/.test(p)) return "SOLU";
    if (/security/.test(p)) return "SECU";
    if (/system/.test(p)) return "SYAD";
    if (/digital.*market/.test(p)) return "DMAR";
    if (/communi/.test(p)) return "COMM";
    if (/oper/.test(p)) return "OPER";
    if (/general manag/.test(p)) return "GENM";
    if (/mobile/.test(p)) return "MOBI";
    if (/webmaster/.test(p)) return "WEBM";
    if (/digital.*technical.*expert/.test(p)) return "DIGT";
    if (/portfolio.*manager/.test(p)) return "PORT";
    const letters = this.onlyLettersUpper(profileTitle);
    return (letters + "XXXX").slice(0, 4);
  }

  normalizeProfiles(input) {
    const { profiles, profileTitle, profileDescription, natureOfTasks, knowledgeAndSkills } = input || {};

    // Preferred: profiles: [{ title, description?, natureOfTasks?, knowledgeAndSkills? }, ...]
    if (Array.isArray(profiles) && profiles.length > 0) {
      return profiles
        .map(p => ({
          title: this.normalizeStr(p.title || ""),
          description: this.normalizeStr(p.description || ""),
          natureOfTasks: this.normalizeBulletish(p.natureOfTasks),
          knowledgeAndSkills: this.normalizeBulletish(p.knowledgeAndSkills),
        }))
        .filter(p => p.title);
    }

    // Back-compat: single profile fields (requestedProfile is intentionally ignored)
    const title = this.normalizeStr(profileTitle);
    const desc = this.normalizeStr(profileDescription);
    const tasks = this.normalizeBulletish(natureOfTasks);
    const skills = this.normalizeBulletish(knowledgeAndSkills);

    return title ? [{ title, description: desc, natureOfTasks: tasks, knowledgeAndSkills: skills }] : [];
  }

  createBaseMnemonic(seniority, firstProfileTitle) {
    const s3 = this.getSeniorityCode(seniority);
    const p4 = this.getProfileCode(firstProfileTitle);
    return `${s3}_${p4}`; // 3 + '_' + 4
  }

  async generateUniqueMnemonic(userId, seniority, firstProfileTitle) {
    const list = await this.loadAll(userId);
    const existing = new Set(list.map((r) => r.mnemonic));
    const base = this.createBaseMnemonic(seniority, firstProfileTitle);
    if (!existing.has(base)) return base;
    for (let i = 2; i < 1000; i++) {
      const cand = `${base}${i}`;
      if (!existing.has(cand)) return cand;
    }
    return `${base}_${Date.now() % 10000}`;
  }

  // ---------- core logic ----------
  /**
   * Create a Tender Search
   * Required:
   *  - userId (string)
   *  - seniority (string)
   *  - requestedServices (string[])
   *  - profiles: [{ title, description?, natureOfTasks?, knowledgeAndSkills? }, ...]   (preferred)
   *
   * Back-compat:
   *  - profileTitle, profileDescription, natureOfTasks, knowledgeAndSkills (single-profile form)
   *  - NOTE: requestedProfile is removed and ignored if provided
   *
   * Optional:
   *  - tenderId (string|number)  // tender reference id
   */
  async createTenderSearch(
    userId,
    {
      seniority,
      requestedServices,
      tenderId,
      profiles,
      // legacy (supported but requestedProfile is ignored):
      profileTitle,
      profileDescription,
      natureOfTasks,
      knowledgeAndSkills,
      requestedProfile, // intentionally ignored
    }
  ) {
    if (!userId) throw new Error("userId required");
    if (!seniority) throw new Error("seniority required");
    if (!Array.isArray(requestedServices)) throw new Error("requestedServices (array) required");

    const normalizedProfiles = this.normalizeProfiles({
      profiles, profileTitle, profileDescription, natureOfTasks, knowledgeAndSkills,
    });
    if (normalizedProfiles.length === 0) {
      throw new Error("At least one profile with a title is required");
    }

    const firstTitle = normalizedProfiles[0].title;
    const list = await this.loadAll(userId);
    const mnemonic = await this.generateUniqueMnemonic(userId, seniority, firstTitle);
    const now = new Date().toISOString();

    const record = {
      mnemonic,                // e.g., SEN_BACK
      userId,
      tenderId: tenderId ?? null,
      seniority,               // e.g., "Senior"
      profiles: normalizedProfiles, // [{title, description, natureOfTasks[], knowledgeAndSkills[]}]
      requestedServices,       // array of strings
      active: false,
      createdAt: now,
      updatedAt: now,
    };

    list.unshift(record);
    await this.saveAll(userId, list);
    return record;
  }

  async listTenderSearches(userId) {
    return await this.loadAll(userId);
  }

  async deleteTenderSearch(userId, mnemonic) {
    const list = await this.loadAll(userId);
    const idx = list.findIndex((r) => r.mnemonic === mnemonic);
    if (idx === -1) return { success: false, error: "Not found" };
    list.splice(idx, 1);
    await this.saveAll(userId, list);
    return { success: true };
  }

  // Activate/Deactivate. If activating one, deactivate all others.
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
}

module.exports = new TenderSearchService();