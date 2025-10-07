// Backend routes/cvs.js - CV management endpoints (with SHA-256 dedupe)
const express = require('express');
const multer = require('multer');
const path = require('path');
const fsp = require('fs').promises;
const fscb = require('fs'); // for createReadStream
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const cvService = require('../services/cv-service');
const aiService = require('../services/ai-service');
const router = express.Router();

console.log('cvService keys:', Object.keys(cvService));

/* ---------------------- helpers: hashing & duplication ---------------------- */

// Streaming SHA-256 (memory-safe for big PDFs)
async function computeFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fscb.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

// Fallback: load all CVs for a user straight from JSON file (if service helper missing)
async function loadUserCVsFromDisk(userId) {
  const file = path.join(__dirname, '../data/cvs', `${userId}_cvs.json`);
  try {
    const raw = await fsp.readFile(file, 'utf8');
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// Check duplicate by hash with graceful fallback
async function isDuplicateForUser(userId, sha256) {
  // Prefer service method if present
  if (typeof cvService.isDuplicateForUser === 'function') {
    return await cvService.isDuplicateForUser(userId, sha256);
  }
  // Otherwise, read JSON directly
  const list = await loadUserCVsFromDisk(userId);
  return list.some(cv => cv.contentHash && cv.contentHash.toLowerCase() === String(sha256).toLowerCase());
}

// Ensure hashes exist in old records (best-effort)
async function ensureHashesForUser(userId) {
  if (typeof cvService.ensureHashesForUser === 'function') {
    try { await cvService.ensureHashesForUser(userId); } catch {}
  }
}

/* ------------------------------ multer config ------------------------------ */

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const fileType = path.extname(file.originalname).toLowerCase().substring(1);
    const uploadDir = path.join(__dirname, '../data/uploads', fileType || 'misc');
    try { await fsp.access(uploadDir); }
    catch { await fsp.mkdir(uploadDir, { recursive: true }); }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname).toLowerCase() || '';
    cb(null, `${uniqueId}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error(`File type ${ext} not allowed. Allowed: ${allowed.join(', ')}`), false);
  }
});

/* ------------------------------- upload route ------------------------------ */

// POST /api/cvs/upload  (multipart; field name: "cvs")
router.post('/upload', upload.array('cvs', 10), async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    // Best-effort: ensure historical records have contentHash populated
    await ensureHashesForUser(userId);

    const uploaded = [];
    const rejected = [];

    for (const file of req.files) {
      try {
        // 1) Compute content hash
        const contentHash = await computeFileHash(file.path);

        // 2) Duplicate check
        const dup = await isDuplicateForUser(userId, contentHash);
        if (dup) {
          // remove the just-uploaded file to avoid clutter
          try { await fsp.unlink(file.path); } catch {}
          rejected.push({
            originalName: file.originalname,
            reason: 'duplicate',
          });
          continue; // move to next file
        }

        // 3) Create record (include contentHash)
        const cvData = await cvService.createCVRecord({
          userId,
          originalName: file.originalname,
          filename: file.filename,
          filePath: file.path.startsWith('data/')
            ? file.path
            : path.relative(path.join(__dirname, '..'), file.path), // store relative like the rest of your data
          fileSize: file.size,
          fileType: path.extname(file.originalname).toLowerCase().substring(1),
          contentHash, // <--- important
        });

        uploaded.push(cvData);

        // 4) Queue for AI processing if enabled
        try { await cvService.queueForProcessing(cvData.id, userId); } catch (e) { /* non-fatal */ }

      } catch (err) {
        console.error(`Error processing upload ${file.originalname}:`, err);
        rejected.push({ originalName: file.originalname, reason: 'error' });
      }
    }

    return res.json({
      success: true,
      data: {
        uploadedCount: uploaded.length,
        rejectedCount: rejected.length,
        uploaded,
        rejected
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: 'Failed to upload CVs' });
  }
});

/* ------------------------- duplicate preflight (optional) ------------------ */

// POST /api/cvs/check-duplicate { userId, sha256 }
router.post('/check-duplicate', async (req, res) => {
  try {
    const { userId, sha256 } = req.body || {};
    if (!userId || !sha256) {
      return res.status(400).json({ success: false, error: 'userId and sha256 required' });
    }
    await ensureHashesForUser(userId);
    const duplicate = await isDuplicateForUser(userId, String(sha256).toLowerCase());
    res.json({ success: true, duplicate });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Check failed' });
  }
});

/* ------------------------------- list by user ------------------------------ */

// GET /api/cvs/:userId - Get user's CVs
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, limit, offset } = req.query;

    const result = await cvService.getUserCVs(userId, {
      status,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get CVs error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve CVs' });
  }
});

/* ------------------------------- CV details -------------------------------- */

// GET /api/cvs/detail/:cvId - Get specific CV details
router.get('/detail/:cvId', async (req, res) => {
  try {
    const { cvId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    const cv = await cvService.getCVById(cvId, userId);
    if (!cv) return res.status(404).json({ success: false, error: 'CV not found' });

    res.json({ success: true, data: cv });
  } catch (error) {
    console.error('Get CV details error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve CV details' });
  }
});

/* ------------------------------ process all ------------------------------- */

// POST /api/cvs/process-all - Process all pending CVs
router.post('/process-all', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    const result = await cvService.processAllPendingCVs(userId);

    res.json({
      success: true,
      data: {
        message: `Started processing ${result.queued} CVs`,
        queued: result.queued,
        alreadyProcessed: result.alreadyProcessed
      }
    });
  } catch (error) {
    console.error('Process all CVs error:', error);
    res.status(500).json({ success: false, error: 'Failed to start processing' });
  }
});

/* ------------------------------ reprocess one ------------------------------ */

// POST /api/cvs/:cvId/reprocess - Reprocess a specific CV
router.post('/:cvId/reprocess', async (req, res) => {
  try {
    const { cvId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    const result = await cvService.reprocessCV(cvId, userId);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true, data: { message: 'CV reprocessing started', cvId } });
  } catch (error) {
    console.error('Reprocess CV error:', error);
    res.status(500).json({ success: false, error: 'Failed to reprocess CV' });
  }
});

/* -------------------------------- delete one ------------------------------- */

// DELETE /api/cvs/:cvId - Delete a CV
router.delete('/:cvId', async (req, res) => {
  try {
    const { cvId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    const result = await cvService.deleteCV(cvId, userId);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true, data: { message: 'CV deleted successfully', cvId } });
  } catch (error) {
    console.error('Delete CV error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete CV' });
  }
});

/* -------------------------------- download -------------------------------- */

// GET /api/cvs/download/:cvId - Download original CV file
router.get('/download/:cvId', async (req, res) => {
  try {
    const { cvId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    const cv = await cvService.getCVById(cvId, userId);
    if (!cv) return res.status(404).json({ success: false, error: 'CV not found' });

    const filePath = path.resolve(cv.filePath);
    try {
      await fsp.access(filePath);
      res.download(filePath, cv.filename);
    } catch {
      res.status(404).json({ success: false, error: 'File not found on disk' });
    }
  } catch (error) {
    console.error('Download CV error:', error);
    res.status(500).json({ success: false, error: 'Failed to download CV' });
  }
});

/* -------------------------------- reset-all -------------------------------- */

// POST /api/cvs/reset-all - Reset all CVs to uploaded status
router.post('/reset-all', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'User ID required' });

    const filePath = path.join(__dirname, '../data/cvs', `${userId}_cvs.json`);
    const data = await fsp.readFile(filePath, 'utf8').catch(() => '[]');
    const cvs = JSON.parse(data || '[]');

    cvs.forEach(cv => {
      cv.status = 'uploaded';
      cv.processedAt = null;
      cv.extractionData = null;
      cv.errorMessage = null;
      cv.processingAttempts = 0;
      cv.confidence = null;
    });

    await fsp.writeFile(filePath, JSON.stringify(cvs, null, 2));
    res.json({ success: true, data: { reset: cvs.length } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ------------------------------ multer errors ------------------------------ */

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: 'File too large. Maximum size is 10MB.' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ success: false, error: 'Too many files. Maximum is 10 files per upload.' });
    }
  }
  if (error.message.includes('File type') && error.message.includes('not allowed')) {
    return res.status(400).json({ success: false, error: error.message });
  }
  next(error);
});

module.exports = router;