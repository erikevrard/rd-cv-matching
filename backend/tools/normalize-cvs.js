// tools/normalize-cvs.js
const fs = require('fs').promises;
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CVS_DIR = path.join(ROOT, 'data', 'cvs');
const UPLOADS_DIR = path.join(ROOT, 'data', 'uploads');

function inferTypeFromExt(p) {
  const ext = path.extname(p || '').toLowerCase();
  if (ext === '.pdf') return 'pdf';
  if (ext === '.txt') return 'txt';
  if (ext === '.docx') return 'docx';
  return null;
}

function toAbs(p) {
  if (!p) return null;
  return path.isAbsolute(p) ? p : path.join(ROOT, p);
}

(async () => {
  const userId = process.argv[2] || 'user_default_erik';
  const file = path.join(CVS_DIR, `${userId}_cvs.json`);

  const raw = await fs.readFile(file, 'utf8');
  const cvs = JSON.parse(raw || '[]');

  let fixed = 0;
  const now = new Date().toISOString();

  for (const cv of cvs) {
    // Accept any of these as source path:
    // - filePath (preferred)
    // - storedPath (from earlier reindex)
    // - storedFilename + a guessed folder (pdf/txt/docx) [fallback]
    let p =
      cv.filePath ||
      cv.storedPath ||
      (cv.storedFilename
        ? ['pdf', 'txt', 'docx'].map(f => path.join('data', 'uploads', f, cv.storedFilename)).find(Boolean)
        : null);

    // If storedPath was relative, make absolute
    if (p) p = toAbs(p);

    // If it still doesn't exist, try to guess by id folders like <uuid>/cv.pdf
    // Only attempt guess if file is missing or path undefined.
    // We won’t check fs.exists here to keep it simple; extractor can handle ENOENT.
    cv.filePath = p || cv.filePath || null;

    // Derive fileType
    const guessedType = inferTypeFromExt(cv.filePath || cv.storedPath || cv.filename || '');
    cv.fileType = (cv.fileType || guessedType || 'pdf'); // default to pdf if unknown

    // Nice-to-haves for UI/processor
    if (!cv.filename) {
      const source = cv.filePath || cv.storedPath || cv.originalName || '';
      cv.filename = source ? path.basename(source) : (cv.originalName || 'unknown');
    }

    // Ensure required flags/fields exist
    if (!cv.status || !['uploaded','processing','processed','error'].includes(cv.status)) {
      cv.status = 'uploaded';
    }
    if (cv.processing == null) cv.processing = false;
    if (cv.uploadedAt == null) cv.uploadedAt = now;
    if (!('processedAt' in cv)) cv.processedAt = null;
    if (!('extractionData' in cv)) cv.extractionData = null;
    if (!('errorMessage' in cv)) cv.errorMessage = null;

    fixed++;
  }

  await fs.writeFile(file, JSON.stringify(cvs, null, 2), 'utf8');
  console.log(`Normalized ${fixed} CV records in ${file}`);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
