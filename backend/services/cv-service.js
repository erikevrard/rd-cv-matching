// backend/services/cv-service.js - REWRITTEN for scalability
const PARSING_THROTTLE_CONFIG = {
  INITIAL: 10000,
  DETAILED: 20000
};

const fs = require("fs").promises;
const fscb = require("fs");
const path = require("path");
const { randomUUID, createHash } = require("crypto");

const llmService = require('./llm-service');
const promptService = require('./prompt-service');
const llmCaller = require('./llm-caller');
const presetParser = require('./preset-parser');

// AI service resolution (same as before)
const aiRaw = require("./ai-service");
function resolveAIProcess(mod) {
  const candidates = [];
  if (typeof mod === "function") candidates.push(mod);
  if (mod && typeof mod === "object") {
    const names = ["processCVText", "processText", "process", "run", "handle"];
    for (const n of names) {
      if (typeof mod[n] === "function") candidates.push(mod[n].bind(mod));
    }
  }
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
  const picked = candidates.find((fn) => typeof fn === "function");
  if (picked) {
    return async (text, userId) => {
      try {
        const out = await picked(text, userId);
        if (out && typeof out === "object" && "success" in out) return out;
        return { success: true, data: out || null };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    };
  }
  return async (text) => {
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

class CVService {
  constructor() {
    this.cvsDataPath = path.join(__dirname, "../data/cvs");
    this.uploadsPath = path.join(__dirname, "../data/uploads");
    this.initPresetParser();
  }

  async initPresetParser() {
    try {
      await presetParser.init();
    } catch (error) {
      console.error('Failed to initialize preset parser:', error);
    }
  }

  // ============================================================================
  // FILE PATHS - NEW STRUCTURE
  // ============================================================================

  getUserCVDirectory(userId) {
    return path.join(this.cvsDataPath, userId);
  }

  getCVFilePath(userId, cvId) {
    return path.join(this.getUserCVDirectory(userId), `${cvId}.json`);
  }

  getIndexFilePath(userId) {
    return path.join(this.getUserCVDirectory(userId), 'index.json');
  }

  async ensureUserDirectory(userId) {
    const dir = this.getUserCVDirectory(userId);
    await fs.mkdir(dir, { recursive: true });
  }

  // ============================================================================
  // CORE CV OPERATIONS - ONE FILE PER CV
  // ============================================================================

  async loadCV(userId, cvId) {
    try {
      const filePath = this.getCVFilePath(userId, cvId);
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async saveCV(userId, cv) {
    await this.ensureUserDirectory(userId);
    
    const filePath = this.getCVFilePath(userId, cv.id);
    const tmpFile = `${filePath}.tmp`;
    
    // Atomic write
    await fs.writeFile(tmpFile, JSON.stringify(cv, null, 2), 'utf8');
    await fs.rename(tmpFile, filePath);
    
    // Update index
    await this.updateIndex(userId);
    
    return cv;
  }

  async saveCVRecord(userId, cv) {
    return await this.saveCV(userId, cv);
  }

  // ============================================================================
  // INDEX OPERATIONS (for fast listing)
  // ============================================================================

  async loadIndex(userId) {
    try {
      const indexPath = this.getIndexFilePath(userId);
      const data = await fs.readFile(indexPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { userId, total: 0, cvs: [], lastUpdated: null };
      }
      throw error;
    }
  }

  async updateIndex(userId) {
    const dir = this.getUserCVDirectory(userId);
    
    try {
      const files = await fs.readdir(dir);
      const cvFiles = files.filter(f => f.endsWith('.json') && f !== 'index.json');
      
      const cvMetadata = [];
      
      for (const file of cvFiles) {
        const cvId = file.replace('.json', '');
        const cv = await this.loadCV(userId, cvId);
        
        if (cv) {
          cvMetadata.push({
            id: cv.id,
            filename: cv.originalName || cv.filename,
            status: cv.status,
            parsingState: cv.parsingState,
            uploadedAt: cv.uploadedAt,
            processedAt: cv.processedAt,
            candidateName: cv.detailedParsingData?.extractedData?.fullName || 
                          cv.initialParsingData?.extractedData?.candidate_full_name || null,
            profile: cv.detailedParsingData?.extractedData?.profile ||
                    cv.initialParsingData?.extractedData?.candidate_main_profile || null
          });
        }
      }
      
      const index = {
        userId,
        total: cvMetadata.length,
        lastUpdated: new Date().toISOString(),
        cvs: cvMetadata
      };
      
      const indexPath = this.getIndexFilePath(userId);
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8');
      
      return index;
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        await this.ensureUserDirectory(userId);
        return { userId, total: 0, cvs: [], lastUpdated: new Date().toISOString() };
      }
      throw error;
    }
  }

  async loadUserCVs(userId) {
    const index = await this.loadIndex(userId);
    
    // Load all CV files
    const cvs = await Promise.all(
      index.cvs.map(meta => this.loadCV(userId, meta.id))
    );
    
    return cvs.filter(Boolean);
  }

  async saveCVs(userId, cvs) {
    // Save each CV individually
    for (const cv of cvs) {
      await this.saveCV(userId, cv);
    }
  }

  // ============================================================================
  // HASHING / DEDUPE
  // ============================================================================

  async computeFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = createHash("sha256");
      const stream = fscb.createReadStream(filePath);
      stream.on("error", reject);
      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("end", () => resolve(hash.digest("hex")));
    });
  }

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
            await this.saveCV(userId, cv);
            changed = true;
          }
        } catch {
          cv.status = cv.status || "error";
          cv.errorMessage = cv.errorMessage || "File missing during hash fill";
          await this.saveCV(userId, cv);
        }
      }
    }

    return cvs;
  }

  async isDuplicateForUser(userId, contentHash) {
    const cvs = await this.loadUserCVs(userId);
    const needle = String(contentHash || "").toLowerCase();
    return cvs.some((cv) => (cv.contentHash || "").toLowerCase() === needle);
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  async getUserCVs(userId, opts = {}) {
    const { status, limit, offset } = opts;
    
    const index = await this.loadIndex(userId);
    let cvList = index.cvs;

    if (status) {
      const s = String(status).toLowerCase();
      cvList = cvList.filter(
        (cv) => (cv.status || "uploaded").toLowerCase() === s
      );
    }

    const off = Number.isFinite(offset) ? offset : 0;
    const lim = Number.isFinite(limit) ? limit : cvList.length;
    const paginated = cvList.slice(off, off + lim);

    // Load full CV data for paginated results
    const fullCVs = await Promise.all(
      paginated.map(meta => this.loadCV(userId, meta.id))
    );

    return {
      cvs: fullCVs.filter(Boolean),
      total: cvList.length,
      summary: this.calculateSummary(index.cvs),
      limit: lim,
      offset: off,
    };
  }

  calculateSummary(cvs) {
    return {
      total: cvs.length,
      uploaded: cvs.filter(cv => cv.status === 'uploaded').length,
      processing: cvs.filter(cv => ['processing', 'parsing_initial', 'parsing_detailed'].includes(cv.status)).length,
      parsed: cvs.filter(cv => cv.status === 'processed').length,
      failed: cvs.filter(cv => cv.status === 'error').length
    };
  }

  async getCVById(cvId, userId) {
    return await this.loadCV(userId, cvId);
  }

  async createCVRecord({
    userId,
    originalName,
    filename,
    filePath,
    fileSize,
    fileType,
    contentHash
  }) {
    const now = new Date().toISOString();

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
      } catch {}
    }

    const cvRecord = {
      id: randomUUID(),
      userId,
      originalName,
      filename,
      filePath,
      fileSize: fileSize ?? null,
      fileType: (fileType || "").toLowerCase().replace(/^\./, ""),
      contentHash: hash,

      status: "uploaded",
      parsingState: "unparsed",
      processing: false,
      uploadedAt: now,
      processedAt: null,
      initialParsingData: null,
      detailedParsingData: null,
      confidence: null,
      errorMessage: null,
    };

    await this.saveCV(userId, cvRecord);
    return cvRecord;
  }

  async processAllPendingCVs(userId) {
    const cvs = await this.loadUserCVs(userId);
    const alreadyProcessed = cvs.filter((c) => c.status === "processed").length;

    const toProcess = cvs.filter((c) => (c.status || "uploaded") === "uploaded");
    const queued = toProcess.length;

    if (queued === 0) {
      return { queued: 0, alreadyProcessed };
    }

    (async () => {
      for (const cv of toProcess) {
        try {
          await this.processCV(userId, cv);
        } catch (err) {
          console.error(`ERROR processing CV ${cv.id}: ${err.message}`);
          cv.status = "error";
          cv.processing = false;
          cv.errorMessage = String(err.message || err);
          await this.saveCV(userId, cv);
        }
      }
    })();

    return { queued, alreadyProcessed };
  }

  async reprocessCV(cvId, userId) {
    const cv = await this.loadCV(userId, cvId);
    if (!cv) return { success: false, error: `CV ${cvId} not found` };

    cv.status = "uploaded";
    cv.processing = false;
    cv.processedAt = null;
    cv.extractionData = null;
    cv.confidence = null;
    cv.errorMessage = null;
    await this.saveCV(userId, cv);

    (async () => {
      try {
        await this.processCV(userId, cv);
      } catch (err) {
        console.error(`ERROR reprocessing CV ${cv.id}: ${err.message}`);
        cv.status = "error";
        cv.processing = false;
        cv.errorMessage = String(err.message || err);
        await this.saveCV(userId, cv);
      }
    })();

    return { success: true };
  }

  async deleteCV(cvId, userId) {
    const cv = await this.loadCV(userId, cvId);
    if (!cv) {
      return { success: false, error: "CV not found" };
    }

    // Delete file
    const filePath = this.getCVFilePath(userId, cvId);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    // Delete uploaded file
    if (cv.filePath) {
      try {
        const abs = path.isAbsolute(cv.filePath)
          ? cv.filePath
          : path.join(__dirname, "..", cv.filePath);
        await fs.unlink(abs);
      } catch {}
    }

    // Update index
    await this.updateIndex(userId);

    return { success: true };
  }

  async queueForProcessing(cvId, userId) {
    const cv = await this.loadCV(userId, cvId);
    if (!cv) return { success: false, error: "CV not found" };

    if (cv.status === "processed" || cv.status === "error") {
      cv.status = "uploaded";
      cv.processing = false;
      await this.saveCV(userId, cv);
    }
    return { success: true };
  }

  // ============================================================================
  // PROCESSING (same as before, but uses saveCV instead of saveCVRecord)
  // ============================================================================

  async processCV(userId, cv) {
    const displayName =
      cv.filename ||
      (cv.filePath && path.basename(cv.filePath)) ||
      cv.originalName ||
      cv.id;

    console.log(`Starting to process CV: ${cv.id}`);

    cv.status = "processing";
    cv.processing = true;
    await this.saveCV(userId, cv);

    if (!cv.filePath || !cv.fileType) {
      throw new Error(
        `CV ${cv.id} missing filePath/fileType (filename: ${displayName})`
      );
    }

    const abs = path.isAbsolute(cv.filePath)
      ? cv.filePath
      : path.join(__dirname, "..", cv.filePath);
    const st = await fs.stat(abs).catch(() => null);
    if (!st || !st.isFile()) {
      throw new Error(`File missing: ${cv.filePath}`);
    }

    console.log(`Extracting text from: ${abs}`);
    const text = await this.extractTextFromFile(abs, cv.fileType);

    console.log(`Calling AI service for CV: ${cv.id}`);
    const aiResult = await aiProcess(text, userId);

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

    await this.saveCV(userId, cv);
    return cv;
  }

  async extractTextFromFile(absPath, fileType) {
    if (!absPath) throw new Error("No filePath provided to extract text");
    if (!fileType) throw new Error("No fileType provided to extract text");

    const ft = String(fileType).toLowerCase();

    if (ft === "txt") {
      return await fs.readFile(absPath, "utf8");
    }

    if (ft === "pdf") {
      const buf = await fs.readFile(absPath);
      return `Binary PDF (${Math.max(1, Math.round(buf.length / 1024))}KB)`;
    }

    if (ft === "docx" || ft === "doc") {
      const buf = await fs.readFile(absPath);
      return `Binary ${ft.toUpperCase()} (${Math.max(1, Math.round(buf.length / 1024))}KB)`;
    }

    throw new Error(`Unsupported file type: ${fileType}`);
  }

  // ============================================================================
  // PARSING (same as before, uses saveCV)
  // ============================================================================

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

  shouldParseCV(cv, parsingType) {
    const state = cv.parsingState || 'unparsed';

    switch (parsingType) {
      case 'initial-all':
        return true;
      case 'initial-onlynew':
        return state === 'unparsed';
      case 'detailed-all':
        return state === 'initial' || state === 'detailed';
      case 'detailed-onlynew':
        return state === 'initial';
      default:
        return false;
    }
  }

  async parseCVsBatch(userId, parsingType) {
    console.log(`\n========================================`);
    console.log(`Starting batch parsing: ${parsingType} for user ${userId}`);
    console.log(`========================================\n`);

    const activeLLM = await llmService.getActive(userId);
    console.log(`Active LLM: ${activeLLM ? activeLLM.mnemonic : 'None (will use presets or mock)'}`);

    const promptMnemonic = parsingType.startsWith('initial')
      ? 'INITIAL_PARSING'
      : 'DETAILED_PARSING';

    const isInitial = parsingType.startsWith('initial');
    const throttleMs = isInitial ? PARSING_THROTTLE_CONFIG.INITIAL : PARSING_THROTTLE_CONFIG.DETAILED;
    console.log(`Using throttle delay: ${throttleMs}ms (${throttleMs / 1000}s)`);

    let prompt = null;
    if (activeLLM) {
      prompt = await promptService.getPrompt(userId, promptMnemonic);
      if (!prompt) {
        console.error(`Prompt ${promptMnemonic} not found for user ${userId}`);
        throw new Error(`Prompt template "${promptMnemonic}" not found. Please create it first.`);
      }
      console.log(`Using prompt: ${promptMnemonic}`);
    }

    const cvs = await this.loadUserCVs(userId);
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

          cv.status = isInitial ? 'parsing_initial' : 'parsing_detailed';
          await this.saveCV(userId, cv);

          const presetType = promptMnemonic === 'INITIAL_PARSING' ? 'initial' : 'detailed';

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

          cv.status = 'error';
          cv.errorMessage = this.formatUserFriendlyError(error);
          await this.saveCV(userId, cv);
        }

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

    return {
      success: true,
      totalCVs: cvsToProcess.length,
      message: `Started parsing ${cvsToProcess.length} CVs`
    };
  }

  formatUserFriendlyError(error) {
    const msg = error.message || String(error);

    if (msg.includes('<!DOCTYPE') || msg.includes('Unexpected token \'<\'')) {
      return 'LLM API returned an error page instead of JSON. The API might be down, or the request was invalid. Check backend logs for details.';
    }

    if (msg.includes('JSON.parse') || msg.includes('not valid JSON')) {
      return 'Failed to parse LLM response as JSON. The AI model might have returned invalid data. Check backend logs for the raw response.';
    }

    if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT')) {
      return 'Could not connect to LLM API. Check your network connection and API configuration.';
    }

    if (msg.includes('401') || msg.includes('403') || msg.includes('Unauthorized')) {
      return 'LLM API authentication failed. Check your API key configuration.';
    }

    if (msg.includes('429') || msg.includes('rate limit')) {
      return 'LLM API rate limit exceeded. Please wait before trying again.';
    }

    if (msg.includes('preset')) {
      return `Preset loading failed: ${msg}`;
    }

    return `Parsing failed: ${msg}`;
  }

  async parseWithPreset(cv, promptMnemonic, userId, parsingType) {
    const cvName = cv.originalName || cv.filename;
    console.log(`📦 Loading preset data for: ${cvName}`);

    const presetType = promptMnemonic === 'INITIAL_PARSING' ? 'initial' : 'detailed';

    if (presetType === 'detailed' && cv.parsingState !== 'initial') {
      throw new Error('Detailed parsing requires initial parsing first. Please run initial parsing before detailed parsing.');
    }

    const presetResult = await presetParser.loadPreset(cvName, presetType);

    if (!presetResult || !presetResult.success) {
      throw new Error(`Failed to load preset: ${presetResult?.error || 'Unknown error'}`);
    }

    console.log(`✅ Preset data loaded successfully`);
    console.log(`  Preset file: ${presetResult.presetFile}`);

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
    cv.errorMessage = null;

    await this.saveCV(userId, cv);
    return cv;
  }

  async parseWithLLM(cv, llmConfig, prompt, userId, parsingType) {
    console.log(`🤖 Parsing with LLM: ${llmConfig.mnemonic}`);

    const isInitial = parsingType.startsWith('initial');
    if (!isInitial && cv.parsingState !== 'initial') {
      throw new Error('Detailed parsing requires initial parsing first. Please run initial parsing before detailed parsing.');
    }

    const abs = path.isAbsolute(cv.filePath)
      ? cv.filePath
      : path.join(__dirname, "..", cv.filePath);

    console.log(`📄 Extracting text from CV file...`);
    const cvText = await this.extractTextFromFile(abs, cv.fileType);
    console.log(`  Extracted text length: ${cvText.length} characters`);

    const fullPrompt = prompt.text.replace(/{CV_TEXT}/g, cvText);

    console.log(`📡 Calling LLM API...`);
    const llmResponse = await llmCaller.call(llmConfig, fullPrompt, llmConfig.timeoutMs);

    if (!llmResponse.success) {
      console.error(`❌ LLM call failed:`, llmResponse.error);
      throw new Error(llmResponse.error || 'LLM call failed without error message');
    }

    console.log(`✅ LLM responded successfully`);

    let extractedData;
    try {
      const text = llmResponse.data.text;
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
        text.match(/```\s*([\s\S]*?)\s*```/) ||
        [null, text];

      const jsonText = jsonMatch[1].trim();
      extractedData = JSON.parse(jsonText);
      console.log(`✅ JSON parsed successfully`);
    } catch (e) {
      console.error(`❌ Failed to parse LLM response as JSON:`, e.message);
      throw new Error(`Failed to parse LLM response as JSON: ${e.message}. Check backend logs for raw response.`);
    }

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
    cv.errorMessage = null;

    await this.saveCV(userId, cv);
    return cv;
  }

  async parseWithMockData(cv, promptMnemonic, userId, parsingType) {
    console.log(`🎲 Generating mock data (no active LLM or preset)`);

    const mockData = this.generateMockParsingData(promptMnemonic);

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
    cv.errorMessage = null;

    await this.saveCV(userId, cv);
    return cv;
  }

  generateMockParsingData(promptMnemonic) {
    // ... (keep existing mock data generation code)
    const firstNames = [
      'John', 'Jane', 'Michael', 'Sarah', 'David', 'Emma'
    ];
    const lastNames = [
      'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia'
    ];
    const profiles = [
      'Software Engineer', 'Data Scientist', 'Product Manager'
    ];
    
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    
    const firstName = pick(firstNames);
    const lastName = pick(lastNames);
    
    if (promptMnemonic === 'INITIAL_PARSING') {
      return {
        is_cv: "Yes",
        confidence_level: Math.floor(85 + Math.random() * 15),
        classification_reasoning: "Mock data generated for testing",
        cv_language_code: pick(['eng', 'fra', 'deu']),
        candidate_full_name: `${firstName} ${lastName}`,
        candidate_id: `CAND-${Math.floor(100000 + Math.random() * 900000)}`,
        candidate_main_profile: pick(profiles),
        current_employer: 'Tech Company',
        candidate_nationality: pick(['US', 'GB', 'FR']),
        country_of_residence: pick(['US', 'GB', 'FR']),
        cv_format: pick(['EUROPASS', 'STANDARD'])
      };
    } else {
      return {
        candidateId: `CAND-${Math.floor(100000 + Math.random() * 900000)}`,
        firstName: firstName,
        lastName: lastName,
        fullName: `${firstName} ${lastName}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.com`,
        profile: pick(profiles),
        seniority: pick(['Junior', 'Mid-level', 'Senior']),
        yearsOfExperience: Math.floor(Math.random() * 15) + 1,
        extractionNotes: 'Mock data generated for testing'
      };
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new CVService();