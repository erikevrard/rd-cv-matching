// backend/services/cv-service.js - FIXED VERSION
const PARSING_THROTTLE_CONFIG = {
  INITIAL: 10000,   // 10 seconds for initial parsing
  DETAILED: 20000   // 20 seconds for detailed parsing
};

const fs = require("fs").promises;
const fscb = require("fs"); // streams
const path = require("path");
const { randomUUID, createHash } = require("crypto");

const llmService = require('./llm-service');
const promptService = require('./prompt-service');
const llmCaller = require('./llm-caller');
const presetParser = require('./preset-parser');

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

    // Initialize preset parser
    this.initPresetParser();
  }

  async initPresetParser() {
    try {
      await presetParser.init();
    } catch (error) {
      console.error('Failed to initialize preset parser:', error);
    }
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

      // Remove duplicates by ID (keep first occurrence)
      const seen = new Set();
      const unique = arr.filter(cv => {
        if (seen.has(cv.id)) {
          console.log(`⚠️ Removing duplicate CV: ${cv.id}`);
          return false;
        }
        seen.add(cv.id);
        return true;
      });

      // If we removed duplicates, save the cleaned data
      if (unique.length < arr.length) {
        await this.saveCVs(userId, unique);
      }

      return Array.isArray(unique) ? unique : [];
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
      summary: this.calculateSummary(all),
      limit: lim,
      offset: off,
    };
  }

  // Calculate summary statistics
  calculateSummary(cvs) {
    return {
      total: cvs.length,
      uploaded: cvs.filter(cv => cv.status === 'uploaded').length,
      processing: cvs.filter(cv => ['processing', 'parsing_initial', 'parsing_detailed'].includes(cv.status)).length,
      parsed: cvs.filter(cv => cv.status === 'processed').length,
      failed: cvs.filter(cv => cv.status === 'error').length
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
      parsingState: "unparsed",      // unparsed | initial | detailed
      processing: false,
      uploadedAt: now,
      processedAt: null,
      initialParsingData: null,
      detailedParsingData: null,
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

  /**
   * Get parsing statistics before starting
   * Used by frontend to show confirmation dialog
   */
  async getParsingStats(userId, parsingType) {
    const cvs = await this.loadUserCVs(userId);
    const activeLLM = await llmService.getActive(userId);

    let cvsToProcess = 0;
    let cvsToSkip = 0;

    for (const cv of cvs) {
      if (this.shouldParseCV(cv, parsingType)) {
        cvsToProcess++;
      } else {
        cvsToSkip++;
      }
    }

    const isInitial = parsingType.startsWith('initial');
    const throttleMs = isInitial ? PARSING_THROTTLE_CONFIG.INITIAL : PARSING_THROTTLE_CONFIG.DETAILED;

    const estimatedDuration = Math.ceil((cvsToProcess * throttleMs) / 1000);

    return {
      cvsToProcess,
      cvsToSkip,
      estimatedDuration,
      throttleMs: throttleMs,
      hasActiveLLM: !!activeLLM,
      llmProvider: activeLLM ? activeLLM.name : null,
      llmModel: activeLLM ? activeLLM.model : null
    };
  }

  /**
   * Determine if a CV should be parsed based on parsing type
   */
  shouldParseCV(cv, parsingType) {
    const state = cv.parsingState || 'unparsed';

    switch (parsingType) {
      case 'initial-all':
        // Parse all CVs (re-parse even if already parsed)
        return true;

      case 'initial-onlynew':
        // Only parse CVs that haven't been initially parsed
        return state === 'unparsed';

      case 'detailed-all':
        // Parse all CVs that have at least initial parsing
        // (will do detailed parsing)
        return state === 'initial' || state === 'detailed';

      case 'detailed-onlynew':
        // Only parse CVs that have initial but not detailed parsing
        return state === 'initial';

      default:
        return false;
    }
  }

  /**
   * Main batch parsing orchestration
   * Loops through CVs with throttle and parses them
   */
  async parseCVsBatch(userId, parsingType) {
    console.log(`\n========================================`);
    console.log(`Starting batch parsing: ${parsingType} for user ${userId}`);
    console.log(`========================================\n`);

    // Get active LLM (may be null)
    const activeLLM = await llmService.getActive(userId);
    console.log(`Active LLM: ${activeLLM ? activeLLM.mnemonic : 'None (will use presets or mock)'}`);

    // Determine which prompt to use
    const promptMnemonic = parsingType.startsWith('initial')
      ? 'INITIAL_PARSING'
      : 'DETAILED_PARSING';

    // Determine throttle delay based on parsing type
    const isInitial = parsingType.startsWith('initial');
    const throttleMs = isInitial ? PARSING_THROTTLE_CONFIG.INITIAL : PARSING_THROTTLE_CONFIG.DETAILED;
    console.log(`Using throttle delay: ${throttleMs}ms (${throttleMs / 1000}s)`);

    // Get prompt template (only needed for LLM parsing)
    let prompt = null;
    if (activeLLM) {
      prompt = await promptService.getPrompt(userId, promptMnemonic);
      if (!prompt) {
        console.error(`Prompt ${promptMnemonic} not found for user ${userId}`);
        throw new Error(`Prompt template "${promptMnemonic}" not found. Please create it first.`);
      }
      console.log(`Using prompt: ${promptMnemonic}`);
    }

    // Load all CVs
    const cvs = await this.loadUserCVs(userId);

    // Filter CVs to parse
    const cvsToProcess = cvs.filter(cv => this.shouldParseCV(cv, parsingType));
    console.log(`Found ${cvsToProcess.length} CVs to parse (${cvs.length - cvsToProcess.length} will be skipped)\n`);

    if (cvsToProcess.length === 0) {
      return {
        success: true,
        processed: 0,
        failed: 0,
        skipped: cvs.length,
        message: 'No CVs to parse'
      };
    }

    // Process CVs with throttle (async, don't await)
    (async () => {
      let processed = 0;
      let failed = 0;
      let usedPreset = 0;
      let usedLLM = 0;
      let usedMock = 0;

      for (const cv of cvsToProcess) {
        const cvName = cv.originalName || cv.filename;

        try {
          console.log(`\n----------------------------------------`);
          console.log(`Parsing CV ${processed + failed + 1}/${cvsToProcess.length}`);
          console.log(`File: ${cvName}`);
          console.log(`----------------------------------------`);

          // Update status to parsing
          cv.status = isInitial ? 'parsing_initial' : 'parsing_detailed';
          await this.saveCVRecord(userId, cv);

          // Determine parsing type (initial or detailed)
          const presetType = promptMnemonic === 'INITIAL_PARSING' ? 'initial' : 'detailed';

          // Check for preset data first
          console.log(`Checking for preset data (type: ${presetType})...`);
          const hasPreset = await presetParser.hasPreset(cvName, presetType);

          if (hasPreset) {
            console.log(`✅ Found preset data, using it`);
            await this.parseWithPreset(cv, promptMnemonic, userId, parsingType);
            usedPreset++;
          } else if (activeLLM) {
            console.log(`📡 No preset found, using LLM: ${activeLLM.mnemonic}`);
            await this.parseWithLLM(cv, activeLLM, prompt, userId, parsingType);
            usedLLM++;
          } else {
            console.log(`🎲 No preset or LLM available, using mock data`);
            await this.parseWithMockData(cv, promptMnemonic, userId, parsingType);
            usedMock++;
          }

          processed++;
          console.log(`✅ Successfully parsed: ${cvName}`);

        } catch (error) {
          failed++;
          console.error(`\n❌ Failed to parse CV: ${cvName}`);
          console.error(`Error: ${error.message}`);
          console.error(`Stack: ${error.stack}\n`);

          // Update CV with clear error message
          cv.status = 'error';
          cv.errorMessage = this.formatUserFriendlyError(error);
          await this.saveCVRecord(userId, cv);
        }

        // Wait before next CV
        if (processed + failed < cvsToProcess.length) {
          console.log(`⏳ Waiting ${throttleMs / 1000}s before next CV...`);
          await this.delay(throttleMs);
        }
      }

      console.log(`\n========================================`);
      console.log(`✅ Batch parsing complete!`);
      console.log(`  Processed: ${processed}`);
      console.log(`  Failed: ${failed}`);
      console.log(`  Used Preset: ${usedPreset}`);
      console.log(`  Used LLM: ${usedLLM}`);
      console.log(`  Used Mock: ${usedMock}`);
      console.log(`========================================\n`);
    })();

    // Return immediately (parsing continues in background)
    return {
      success: true,
      totalCVs: cvsToProcess.length,
      message: `Started parsing ${cvsToProcess.length} CVs`
    };
  }

  /**
   * Format error messages to be user-friendly
   */
  formatUserFriendlyError(error) {
    const msg = error.message || String(error);

    // HTML response error
    if (msg.includes('<!DOCTYPE') || msg.includes('Unexpected token \'<\'')) {
      return 'LLM API returned an error page instead of JSON. The API might be down, or the request was invalid. Check backend logs for details.';
    }

    // JSON parsing error
    if (msg.includes('JSON.parse') || msg.includes('not valid JSON')) {
      return 'Failed to parse LLM response as JSON. The AI model might have returned invalid data. Check backend logs for the raw response.';
    }

    // Network errors
    if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT')) {
      return 'Could not connect to LLM API. Check your network connection and API configuration.';
    }

    // Auth errors
    if (msg.includes('401') || msg.includes('403') || msg.includes('Unauthorized')) {
      return 'LLM API authentication failed. Check your API key configuration.';
    }

    // Rate limit errors
    if (msg.includes('429') || msg.includes('rate limit')) {
      return 'LLM API rate limit exceeded. Please wait before trying again.';
    }

    // Preset errors
    if (msg.includes('preset')) {
      return `Preset loading failed: ${msg}`;
    }

    // Default: return original message
    return `Parsing failed: ${msg}`;
  }

  /**
   * Parse a CV using preset data
   */
  async parseWithPreset(cv, promptMnemonic, userId, parsingType) {
    const cvName = cv.originalName || cv.filename;
    console.log(`📦 Loading preset data for: ${cvName}`);

    // Determine parsing type
    const presetType = promptMnemonic === 'INITIAL_PARSING' ? 'initial' : 'detailed';

    // Check if detailed parsing requires initial first
    if (presetType === 'detailed' && cv.parsingState !== 'initial') {
      throw new Error('Detailed parsing requires initial parsing first. Please run initial parsing before detailed parsing.');
    }

    // Load preset data
    const presetResult = await presetParser.loadPreset(cvName, presetType);

    if (!presetResult || !presetResult.success) {
      throw new Error(`Failed to load preset: ${presetResult?.error || 'Unknown error'}`);
    }

    console.log(`✅ Preset data loaded successfully`);
    console.log(`  Preset file: ${presetResult.presetFile}`);

    // Update CV record
    const isInitial = presetType === 'initial';
    const now = new Date().toISOString();

    if (isInitial) {
      cv.parsingState = 'initial';
      cv.initialParsingData = {
        parsedAt: now,
        llmMnemonic: 'PRESET',
        promptMnemonic: promptMnemonic,
        rawResponse: JSON.stringify(presetResult.data, null, 2),
        extractedData: presetResult.data,
        usage: null,
        presetFile: presetResult.presetFile
      };
    } else {
      cv.parsingState = 'detailed';
      cv.detailedParsingData = {
        parsedAt: now,
        llmMnemonic: 'PRESET',
        promptMnemonic: promptMnemonic,
        rawResponse: JSON.stringify(presetResult.data, null, 2),
        extractedData: presetResult.data,
        usage: null,
        presetFile: presetResult.presetFile
      };
    }

    cv.status = 'processed';
    cv.processedAt = now;
    cv.errorMessage = null; // Clear any previous errors

    await this.saveCVRecord(userId, cv);
    return cv;
  }

  /**
   * Parse a CV using LLM
   */
  async parseWithLLM(cv, llmConfig, prompt, userId, parsingType) {
    console.log(`🤖 Parsing with LLM: ${llmConfig.mnemonic}`);

    // Check if detailed parsing requires initial first
    const isInitial = parsingType.startsWith('initial');
    if (!isInitial && cv.parsingState !== 'initial') {
      throw new Error('Detailed parsing requires initial parsing first. Please run initial parsing before detailed parsing.');
    }

    // Extract text from CV file
    const abs = path.isAbsolute(cv.filePath)
      ? cv.filePath
      : path.join(__dirname, "..", cv.filePath);

    console.log(`📄 Extracting text from CV file...`);
    const cvText = await this.extractTextFromFile(abs, cv.fileType);
    console.log(`  Extracted text length: ${cvText.length} characters`);

    // Substitute CV text into prompt
    const fullPrompt = prompt.text.replace(/{CV_TEXT}/g, cvText);

    // Call LLM
    console.log(`📡 Calling LLM API...`);
    console.log(`  Provider: ${llmConfig.provider || 'unknown'}`);
    console.log(`  Model: ${llmConfig.model || 'unknown'}`);
    console.log(`  Timeout: ${llmConfig.timeoutMs || 30000}ms`);

    const llmResponse = await llmCaller.call(llmConfig, fullPrompt, llmConfig.timeoutMs);

    if (!llmResponse.success) {
      console.error(`❌ LLM call failed:`, llmResponse.error);
      throw new Error(llmResponse.error || 'LLM call failed without error message');
    }

    console.log(`✅ LLM responded successfully`);
    console.log(`  Response length: ${llmResponse.data?.text?.length || 0} characters`);

    // Parse LLM response (should be JSON)
    let extractedData;
    try {
      // Try to extract JSON from response (LLM might wrap it in markdown)
      const text = llmResponse.data.text;
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
        text.match(/```\s*([\s\S]*?)\s*```/) ||
        [null, text];

      const jsonText = jsonMatch[1].trim();
      console.log(`📝 Parsing JSON response (${jsonText.length} characters)...`);

      extractedData = JSON.parse(jsonText);
      console.log(`✅ JSON parsed successfully`);
    } catch (e) {
      console.error(`❌ Failed to parse LLM response as JSON:`, e.message);
      console.error(`Raw response (first 500 chars):`, llmResponse.data?.text?.substring(0, 500));
      throw new Error(`Failed to parse LLM response as JSON: ${e.message}. Check backend logs for raw response.`);
    }

    // Update CV record
    const now = new Date().toISOString();

    if (isInitial) {
      cv.parsingState = 'initial';
      cv.initialParsingData = {
        parsedAt: now,
        llmMnemonic: llmConfig.mnemonic,
        promptMnemonic: prompt.mnemonic,
        rawResponse: llmResponse.data.text,
        extractedData: extractedData,
        usage: llmResponse.data.usage
      };
    } else {
      cv.parsingState = 'detailed';
      cv.detailedParsingData = {
        parsedAt: now,
        llmMnemonic: llmConfig.mnemonic,
        promptMnemonic: prompt.mnemonic,
        rawResponse: llmResponse.data.text,
        extractedData: extractedData,
        usage: llmResponse.data.usage
      };
    }

    cv.status = 'processed';
    cv.processedAt = now;
    cv.errorMessage = null; // Clear any previous errors

    await this.saveCVRecord(userId, cv);
    return cv;
  }

  /**
   * Generate mock parsing data when no LLM is active
   * Creates realistic random CV data for testing
   */
  async parseWithMockData(cv, promptMnemonic, userId, parsingType) {
    console.log(`🎲 Generating mock data (no active LLM or preset)`);

    const mockData = this.generateMockParsingData(promptMnemonic);

    console.log(`✅ Mock data generated`);
    console.log(`  Fields: ${Object.keys(mockData).join(', ')}`);

    // Update CV record
    const isInitial = parsingType.startsWith('initial');
    const now = new Date().toISOString();

    if (isInitial) {
      cv.parsingState = 'initial';
      cv.initialParsingData = {
        parsedAt: now,
        llmMnemonic: 'MOCK',
        promptMnemonic: promptMnemonic,
        rawResponse: JSON.stringify(mockData, null, 2),
        extractedData: mockData,
        usage: null
      };
    } else {
      cv.parsingState = 'detailed';
      cv.detailedParsingData = {
        parsedAt: now,
        llmMnemonic: 'MOCK',
        promptMnemonic: promptMnemonic,
        rawResponse: JSON.stringify(mockData, null, 2),
        extractedData: mockData,
        usage: null
      };
    }

    cv.status = 'processed';
    cv.processedAt = now;
    cv.errorMessage = null; // Clear any previous errors

    await this.saveCVRecord(userId, cv);
    return cv;
  }

  /**
   * Generate realistic mock parsing data for testing
   * Returns different random data each time
   */
  generateMockParsingData(promptMnemonic) {
    const firstNames = [
      'John', 'Jane', 'Michael', 'Sarah', 'David', 'Emma', 'James', 'Emily',
      'Robert', 'Olivia', 'William', 'Sophia', 'Richard', 'Isabella', 'Thomas',
      'Mia', 'Charles', 'Charlotte', 'Daniel', 'Amelia'
    ];

    const lastNames = [
      'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
      'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
      'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'
    ];

    const profiles = [
      'Software Engineer', 'Data Scientist', 'Product Manager', 'UX Designer',
      'DevOps Engineer', 'Full Stack Developer', 'Frontend Developer',
      'Backend Developer', 'Project Manager', 'Business Analyst',
      'Marketing Manager', 'Sales Representative', 'Account Manager',
      'Financial Analyst', 'HR Manager', 'Operations Manager'
    ];

    const nationalities = [
      'American', 'British', 'Canadian', 'Australian', 'German', 'French',
      'Spanish', 'Italian', 'Dutch', 'Belgian', 'Swedish', 'Norwegian',
      'Danish', 'Finnish', 'Irish', 'Polish', 'Portuguese', 'Austrian'
    ];

    const countries = [
      'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France',
      'Spain', 'Italy', 'Netherlands', 'Belgium', 'Sweden', 'Norway',
      'Denmark', 'Finland', 'Ireland', 'Poland', 'Portugal', 'Austria'
    ];

    const companies = [
      'Accenture', 'Deloitte', 'IBM', 'Microsoft', 'Google', 'Amazon',
      'Capgemini', 'Cognizant', 'Infosys', 'TCS', 'Wipro', 'Tech Mahindra'
    ];

    const seniorities = ['Junior', 'Mid-level', 'Proficient', 'Senior', 'Lead', 'Principal'];

    const skills = [
      'JavaScript', 'Python', 'Java', 'TypeScript', 'React', 'Node.js',
      'AWS', 'Docker', 'Kubernetes', 'SQL', 'MongoDB', 'PostgreSQL',
      'Git', 'CI/CD', 'Agile', 'Scrum', 'REST API', 'GraphQL'
    ];

    // Random selection helpers
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const pickMultiple = (arr, count) => {
      const shuffled = [...arr].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, count);
    };

    const firstName = pick(firstNames);
    const lastName = pick(lastNames);
    const nationality = pick(nationalities);
    const residenceCountry = pick(countries);
    const isEU = ['German', 'French', 'Spanish', 'Italian', 'Dutch', 'Belgian', 'Swedish', 'Danish', 'Finnish', 'Irish', 'Polish', 'Portuguese', 'Austrian'].includes(nationality);

    // Generate different data based on prompt type
    if (promptMnemonic === 'INITIAL_PARSING') {
      const nationalityCode = pick(['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'SE', 'NO', 'DK', 'FI', 'IE', 'PL', 'PT', 'AT']);

      return {
        is_cv: "Yes",
        confidence_level: Math.floor(85 + Math.random() * 15),
        classification_reasoning: "Mock data generated for testing (no active LLM or preset available)",
        cv_language_code: pick(['eng', 'fra', 'deu', 'spa', 'nld', 'por']),
        candidate_full_name: `${firstName} ${lastName}`,
        candidate_id: `CAND-${Math.floor(100000 + Math.random() * 900000)}`,
        candidate_main_profile: pick(profiles),
        current_employer: pick(companies),
        candidate_nationality: nationalityCode,
        country_of_residence: nationalityCode,
        cv_format: pick(['EUROPASS', 'STANDARD', 'MODERN', 'CREATIVE'])
      };
    } else {
      // DETAILED_PARSING - more comprehensive data
      return {
        candidateId: `CAND-${Math.floor(100000 + Math.random() * 900000)}`,
        firstName: firstName,
        lastName: lastName,
        fullName: `${firstName} ${lastName}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.com`,
        phone: `+32 ${Math.floor(100 + Math.random() * 900)} ${Math.floor(100 + Math.random() * 900)} ${Math.floor(100 + Math.random() * 900)}`,
        profile: pick(profiles),
        preferredProfile: pick(profiles),
        seniority: pick(seniorities),
        nationality: nationality,
        isEUCitizen: isEU,
        residenceCountry: residenceCountry,
        affiliatedCompany: pick(companies),
        yearsOfExperience: Math.floor(Math.random() * 15) + 1,
        skills: pickMultiple(skills, 5 + Math.floor(Math.random() * 5)),
        languages: [
          { language: 'English', level: 'Native' },
          { language: pick(['French', 'German', 'Spanish', 'Dutch']), level: 'Fluent' }
        ],
        education: [
          {
            degree: pick(['Bachelor', 'Master', 'PhD']),
            field: pick(['Computer Science', 'Engineering', 'Business', 'Mathematics']),
            institution: 'University',
            year: 2015 + Math.floor(Math.random() * 8)
          }
        ],
        workExperience: [
          {
            title: pick(profiles),
            company: pick(companies),
            duration: `${2 + Math.floor(Math.random() * 5)} years`,
            responsibilities: ['Led development team', 'Implemented new features', 'Improved performance']
          }
        ],
        certifications: pickMultiple(['AWS Certified', 'Google Cloud', 'Kubernetes', 'PMP'], 2),
        extractionNotes: 'Detailed mock data generated for testing (no active LLM or preset available)'
      };
    }
  }

  /**
   * Delay helper for throttling
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

}

// Export a single instance (routes call methods directly)
module.exports = new CVService();