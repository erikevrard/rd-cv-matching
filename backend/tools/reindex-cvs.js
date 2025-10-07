// tools/reindex-cvs.js
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const UPLOADS = path.join(ROOT, 'data', 'uploads');
const CVS_DIR = path.join(ROOT, 'data', 'cvs');

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,c=>(c^crypto.randomBytes(1)[0]&15>>c/4).toString(16));
}

async function listFiles(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const out = [];
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        // some PDFs are saved inside a folder with name/ cv.pdf
        out.push(...await listFiles(full));
      } else {
        out.push(full);
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function main() {
  const userId = process.argv[2] || 'user_default_erik';
  const target = path.join(CVS_DIR, `${userId}_cvs.json`);

  const pdfs = await listFiles(path.join(UPLOADS, 'pdf'));
  const txts = await listFiles(path.join(UPLOADS, 'txt'));
  const docxs = await listFiles(path.join(UPLOADS, 'docx'));

  const now = new Date().toISOString();

  function makeRecord(fullPath) {
    const ext = path.extname(fullPath).toLowerCase();
    const base = path.basename(fullPath);
    const id = uuid();
    const mime =
      ext === '.pdf' ? 'application/pdf' :
      ext === '.txt' ? 'text/plain' :
      ext === '.docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
      'application/octet-stream';

    return {
      id,
      originalName: base,
      storedPath: fullPath.replace(ROOT + path.sep, ''), // relative for UI
      mimeType: mime,
      sizeBytes: null,
      uploadedAt: now,
      status: 'uploaded', // not processed yet
      processing: false,
      parsed: null, // will be filled by AI step
    };
  }

  const all = [...pdfs, ...txts, ...docxs].map(makeRecord);

  await fs.mkdir(CVS_DIR, { recursive: true });
  await fs.writeFile(target, JSON.stringify(all, null, 2), 'utf8');
  console.log(`Rebuilt index with ${all.length} CV(s) at ${target}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
