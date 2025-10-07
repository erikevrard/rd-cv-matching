// backend/services/cv-service.js
const fs = require("fs").promises;
const fscb = require("fs"); // streams
const path = require("path");
const { randomUUID, createHash } = require("crypto");

// -------------- AI SERVICE (robust resolver, no throws) --------------
const aiRaw = require("./ai-service");

// Try to find a "process text" function in whatever shape was exported.
// Returns an async function (text, userId) => { success, data? }
function resolveAIProcess(mod) {
  const candidates = [];

  // Direct function export
  if (typeof mod === "function") candidates.push(mod);

  // Object instance with various method names
  if (mod && typeof mod === "object") {
    const names = ["processCVText", "processText", "process", "run", "handle"];
    for (const n of names) {
      if (typeof mod[n] === "function") candidates.push(mod[n].bind(mod));
    }
  }

  // default export variations
  if (mod && typeof mod.default !== "undefined") {
    if (typeof mod.default === "function") candidates.push(mod.default);
    if (mod.default && typeof mod.default === "object") {
      const names = ["processCVText", "processText", "process", "run", "handle"];
      for (const n of names) {
        if (typeof mod.default[n] === "function")
          candidates.push(mod.default[n].bind(mod.default));
      }
    }
  }

  // Pick the first viable candidate
  const picked = candidates.find((fn) => typeof fn === "function");
  if (picked) {
    return async (text, userId) => {
      try {
        const out = await picked(text, userId);
        // Normalize to { success, data }
        if (out && typeof out === "object" && "success" in out) return out;
        return { success: true, data: out || null };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    };
  }

  // Fallback: no-op AI that produces a minimal structured payload
  return async (text /*, userId */) => {
    return {
      success: true,
      data: {
        extractedAt: new Date().toISOString(),
        profile: "Unknown",
        seniority: "Unknown",
        confidence: { overall: "low" },
        extractionNotes: "Fallback AI: shape of ai-service not detected.",
        preview: typeof text === "string" ? text.slice(0, 200) : null,
      },
    };
  };
}

const aiProcess = resolveAIProcess(aiRaw);

// -------------- CV SERVICE --------------
class CVService {
  constructor() {
    this.cvsDataPath = path.join(__dirname, "../data/cvs");
    this.uploadsPath = path.join(__dirname, "../data/uploads");
    this.locks = new Map(); // per-user in-memory lock to serialize writes
  }

  // ---------------- LOCKING ----------------
  async acquireLock(userId) {
    while (this.locks.get(userId)) {
      await new Promise((r) => setTimeout(r, 10));
    }
    this.locks.set(userId, true);
  }
  releaseLock(userId) {
    this.locks.delete(userId);
  }

  // ---------------- IO HELPERS ----------------
  getUserCVsFilePath(userId) {
    return path.join(this.cvsDataPath, `${userId}_cvs.json`);
  }

  async atomicWrite(filePath, data) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp`;
    await fs.writeFile(tmp, data, "utf8");
    await fs.rename(tmp, filePath);
  }

  async loadUserCVs(userId) {
    const filePath = this.getUserCVsFilePath(userId);
    try {
      const data = await fs.readFile(filePath, "utf8");
      const arr = JSON.parse(data || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  async saveCVs(userId, cvs) {
    await this.acquireLock(userId);
    try {
      const filePath = this.getUserCVsFilePath(userId);
      await this.atomicWrite(filePath, JSON.stringify(cvs, null, 2));
    } finally {
      this.releaseLock(userId);
    }
  }

  async saveCVRecord(userId, cvRecord) {
    await this.acquireLock(userId);
    try {
      const filePath = this.getUserCVsFilePath(userId);
      let cvs = [];
      try {
        const data = await fs.readFile(filePath, "utf8");
        cvs = JSON.parse(data || "[]");
      } catch {
        cvs = [];
      }

      const idx = cvs.findIndex((cv) => cv.id === cvRecord.id);
      if (idx >= 0) cvs[idx] = cvRecord;
      else cvs.unshift(cvRecord);

      await this.atomicWrite(filePath, JSON.stringify(cvs, null, 2));
    } finally {
      this.releaseLock(userId);
    }
  }

  // ---------------- HASHING / DEDUPE HELPERS ----------------

  // Streaming SHA-256 for a file
  async computeFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = createHash("sha256");
      const stream = fscb.createReadStream(filePath);
      stream.on("error", reject);
      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("end", () => resolve(hash.digest("hex")));
    });
  }

  // Fill contentHash on historical records (if their files still exist)
  async ensureHashesForUser(userId) {
    const cvs = await this.loadUserCVs(userId);
    let changed = false;

    for (const cv of cvs) {
      if (!cv.contentHash && cv.filePath) {
        const abs = path.isAbsolute(cv.filePath)
          ? cv.filePath
          : path.join(__dirname, "..", cv.filePath);
        try {
          const st = await fs.stat(abs);
          if (st.isFile()) {
            cv.contentHash = await this.computeFileHash(abs);
            changed = true;
          } else {
            cv.status = cv.status || "error";
            cv.errorMessage = cv.errorMessage || "File path is not a file";
          }
        } catch {
          cv.status = cv.status || "error";
          cv.errorMessage = cv.errorMessage || "File missing during hash fill";
        }
      }
    }

    if (changed) await this.saveCVs(userId, cvs);
    return cvs;
  }

  async isDuplicateForUser(userId, contentHash) {
    const cvs = await this.loadUserCVs(userId);
    const needle = String(contentHash || "").toLowerCase();
    return cvs.some((cv) => (cv.contentHash || "").toLowerCase() === needle);
  }

  // ---------------- PUBLIC API (routes expect these) ----------------

  // GET /api/cvs/:userId
  async getUserCVs(userId, opts = {}) {
    const { status, limit, offset } = opts;
    const all = await this.loadUserCVs(userId);

    let filtered = all;
    if (status) {
      const s = String(status).toLowerCase();
      filtered = all.filter(
        (cv) => (cv.status || "uploaded").toLowerCase() === s
      );
    }

    const off = Number.isFinite(offset) ? offset : 0;
    const lim = Number.isFinite(limit) ? limit : filtered.length;

    return {
      cvs: filtered.slice(off, off + lim),
      total: filtered.length,
      limit: lim,
      offset: off,
    };
  }

  // GET /api/cvs/detail/:cvId
  async getCVById(cvId, userId) {
    const all = await this.loadUserCVs(userId);
    return all.find((cv) => cv.id === cvId) || null;
  }

  // POST /api/cvs/upload (called per file)
  async createCVRecord({
    userId,
    originalName,
    filename,   // stored filename on disk (multer)
    filePath,   // absolute (or project-relative) path from multer
    fileSize,
    fileType,   // 'pdf' | 'txt' | 'docx' | 'doc'
    contentHash // optional, route can provide
  }) {
    const now = new Date().toISOString();

    // compute hash if not provided
    let hash = contentHash || null;
    if (!hash && filePath) {
      try {
        const abs = path.isAbsolute(filePath)
          ? filePath
          : path.join(__dirname, "..", filePath);
        const st = await fs.stat(abs);
        if (st.isFile()) {
          hash = await this.computeFileHash(abs);
        }
      } catch {
        // ignore; will leave null
      }
    }

    const cvRecord = {
      id: randomUUID(),              // keep original behavior (not file-based)
      userId,
      originalName,
      filename,
      filePath,
      fileSize: fileSize ?? null,
      fileType: (fileType || "").toLowerCase().replace(/^\./, ""),
      contentHash: hash,

      status: "uploaded",            // uploaded | processing | processed | error
      processing: false,
      uploadedAt: now,
      processedAt: null,
      extractionData: null,
      confidence: null,
      errorMessage: null,
    };

    await this.saveCVRecord(userId, cvRecord);
    return cvRecord;
  }

  // POST /api/cvs/process-all
  async processAllPendingCVs(userId) {
    const cvs = await this.loadUserCVs(userId);
    const alreadyProcessed = cvs.filter((c) => c.status === "processed").length;

    const toProcess = cvs.filter((c) => (c.status || "uploaded") === "uploaded");
    const queued = toProcess.length;

    if (queued === 0) {
      return { queued: 0, alreadyProcessed };
    }

    // Process asynchronously so the route can return immediately
    (async () => {
      for (const cv of toProcess) {
        try {
          await this.processCV(userId, cv);
        } catch (err) {
          console.error(`ERROR processing CV ${cv.id}: ${err.message}`);
          cv.status = "error";
          cv.processing = false;
          cv.errorMessage = String(err.message || err);
          await this.saveCVRecord(userId, cv);
        }
      }
    })();

    return { queued, alreadyProcessed };
  }

  // POST /api/cvs/:cvId/reprocess
  async reprocessCV(cvId, userId) {
    const cvs = await this.loadUserCVs(userId);
    const cv = cvs.find((c) => c.id === cvId);
    if (!cv) return { success: false, error: `CV ${cvId} not found` };

    // Reset flags
    cv.status = "uploaded";
    cv.processing = false;
    cv.processedAt = null;
    cv.extractionData = null;
    cv.confidence = null;
    cv.errorMessage = null;
    await this.saveCVRecord(userId, cv);

    // Async reprocess
    (async () => {
      try {
        await this.processCV(userId, cv);
      } catch (err) {
        console.error(`ERROR reprocessing CV ${cv.id}: ${err.message}`);
        cv.status = "error";
        cv.processing = false;
        cv.errorMessage = String(err.message || err);
        await this.saveCVRecord(userId, cv);
      }
    })();

    return { success: true };
  }

  // DELETE /api/cvs/:cvId
  async deleteCV(cvId, userId) {
    await this.acquireLock(userId);
    try {
      const filePath = this.getUserCVsFilePath(userId);
      let cvs = [];
      try {
        const data = await fs.readFile(filePath, "utf8");
        cvs = JSON.parse(data || "[]");
      } catch {
        cvs = [];
      }

      const idx = cvs.findIndex((cv) => cv.id === cvId);
      if (idx === -1) {
        return { success: false, error: "CV not found" };
      }

      const [removed] = cvs.splice(idx, 1);
      await this.atomicWrite(filePath, JSON.stringify(cvs, null, 2));

      // Best-effort remove the file on disk
      if (removed && removed.filePath) {
        try {
          const abs = path.isAbsolute(removed.filePath)
            ? removed.filePath
            : path.join(__dirname, "..", removed.filePath);
          await fs.unlink(abs);
        } catch {
          // ignore (file may already be gone)
        }
      }

      return { success: true };
    } finally {
      this.releaseLock(userId);
    }
  }

  // Called by upload route
  async queueForProcessing(cvId, userId) {
    const cvs = await this.loadUserCVs(userId);
    const cv = cvs.find((c) => c.id === cvId);
    if (!cv) return { success: false, error: "CV not found" };

    if (cv.status === "processed" || cv.status === "error") {
      cv.status = "uploaded";
      cv.processing = false;
      await this.saveCVRecord(userId, cv);
    }
    return { success: true };
  }

  // ---------------- CORE PROCESSING ----------------
  async processCV(userId, cv) {
    const displayName =
      cv.filename ||
      (cv.filePath && path.basename(cv.filePath)) ||
      cv.originalName ||
      cv.id;

    console.log(`Starting to process CV: ${cv.id}`);

    // Mark as processing and persist
    cv.status = "processing";
    cv.processing = true;
    await this.saveCVRecord(userId, cv);

    // Validate required fields
    if (!cv.filePath || !cv.fileType) {
      throw new Error(
        `CV ${cv.id} missing filePath/fileType (filename: ${displayName})`
      );
    }

    // Verify file exists and is a file
    const abs = path.isAbsolute(cv.filePath)
      ? cv.filePath
      : path.join(__dirname, "..", cv.filePath);
    const st = await fs.stat(abs).catch(() => null);
    if (!st || !st.isFile()) {
      throw new Error(`File missing: ${cv.filePath}`);
    }

    console.log(`CV marked as processing: ${displayName}`);
    console.log(`Extracting text from: ${abs}`);

    const text = await this.extractTextFromFile(abs, cv.fileType);
    console.log(`Text extracted, length: ${text ? text.length : 0} characters`);

    console.log(`Calling AI service for CV: ${cv.id}`);
    const aiResult = await aiProcess(text, userId);
    console.log(`AI processing result for ${displayName}:`, aiResult);

    // Persist processed result
    cv.status = aiResult && aiResult.success === false ? "error" : "processed";
    cv.processing = false;
    cv.processedAt = new Date().toISOString();
    cv.extractionData = aiResult && aiResult.data ? aiResult.data : null;
    cv.confidence =
      aiResult && aiResult.data && aiResult.data.confidence
        ? aiResult.data.confidence
        : null;
    cv.errorMessage =
      aiResult && aiResult.success === false
        ? aiResult.error || "AI processing failed"
        : null;

    await this.saveCVRecord(userId, cv);

    if (cv.status === "processed") {
      console.log(`CV successfully parsed: ${displayName}`);
    } else {
      console.log(`CV processing failed: ${displayName}`);
    }
    return cv;
  }

  // ---------------- EXTRACTION ----------------
  async extractTextFromFile(absPath, fileType) {
    if (!absPath) throw new Error("No filePath provided to extract text");
    if (!fileType) throw new Error("No fileType provided to extract text");

    const ft = String(fileType).toLowerCase();

    if (ft === "txt") {
      return await fs.readFile(absPath, "utf8");
    }

    if (ft === "pdf") {
      // TODO: replace with real PDF extraction (e.g., pdf-parse)
      const buf = await fs.readFile(absPath);
      // keep placeholder; avoid decoding garbage binary to UTF-8
      return `Binary PDF (${Math.max(1, Math.round(buf.length / 1024))}KB)`;
    }

    if (ft === "docx" || ft === "doc") {
      // TODO: replace with real DOCX/DOC extraction (e.g., mammoth)
      const buf = await fs.readFile(absPath);
      return `Binary ${ft.toUpperCase()} (${Math.max(1, Math.round(buf.length / 1024))}KB)`;
    }

    throw new Error(`Unsupported file type: ${fileType}`);
  }
}

// Export a single instance (routes call methods directly)
module.exports = new CVService();