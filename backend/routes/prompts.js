// backend/routes/prompts.js
const express = require("express");
const router = express.Router();
const promptService = require("../services/prompt-service");

/* =========================
   COLLECTION / FIXED ROUTES
   (must come BEFORE any "/:userId" routes)
   ========================= */

// Create
// POST /api/prompts  body: { userId, mnemonic, text, title?, tags? }
router.post("/", async (req, res) => {
  try {
    const { userId, mnemonic, text, title, tags } = req.body || {};
    const created = await promptService.createPrompt(userId, { mnemonic, text, title, tags });
    res.status(201).json({ success: true, data: created });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// HTML view (two forms to avoid collisions with param routes)
// GET /api/prompts/html/:userId
// GET /api/prompts/:userId/html
router.get(["/html/:userId", "/:userId/html"], async (req, res) => {
  try {
    const userId = req.params.userId;
    const list = await promptService.listPrompts(userId);

    const esc = (s) => String(s ?? "")
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

    const rows = list.map(p => `
      <tr>
        <td><code>${esc(p.mnemonic)}</code></td>
        <td>${esc(p.title || "")}</td>
        <td>${(p.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join(" ")}</td>
        <td><pre>${esc(p.text || "")}</pre></td>
        <td>${esc((p.createdAt || "").replace("T"," ").replace("Z",""))}</td>
        <td>${esc((p.updatedAt || "").replace("T"," ").replace("Z",""))}</td>
      </tr>
    `).join("") || `<tr><td colspan="6" class="empty">No prompts yet.</td></tr>`;

    const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<title>LLM Prompts – ${esc(userId)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  :root { color-scheme: light dark; }
  body { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background:#fafafa; color:#1a1a1a; margin:40px auto; max-width:1200px; padding:0 20px; line-height:1.5; }
  h1 { font-size:1.6rem; font-weight:600; margin:0 0 8px; letter-spacing:.02em; }
  .meta { color:#666; margin-bottom:16px; }
  table { width:100%; border-collapse:collapse; border-radius:10px; overflow:hidden; box-shadow:0 0 8px rgba(0,0,0,.06); font-size:.95rem; }
  th, td { padding:12px 14px; border-bottom:1px solid #e5e5e5; vertical-align:top; }
  th { background:#f5f5f5; text-align:left; font-size:.8rem; letter-spacing:.04em; text-transform:uppercase; color:#333; }
  code { background:#f2f2f2; padding:2px 6px; border-radius:5px; }
  pre { white-space:pre-wrap; background:#fff; border:1px solid #eee; border-radius:8px; padding:10px; margin:0; }
  .empty { text-align:center; color:#777; font-style:italic; }
  .tag { display:inline-block; background:#eef2ff; border:1px solid #c7d2fe; color:#1e3a8a; padding:2px 8px; border-radius:999px; font-size:.78rem; margin-right:6px; }
  .actions { margin: 0 0 14px; }
  .btn { display:inline-block; padding:6px 10px; border-radius:6px; text-decoration:none; background:#f8f8f8; border:1px solid #ddd; color:#333; font-size:.9rem; }
  .btn:hover { background:#f0f0f0; }
</style>
</head>
<body>
  <h1>LLM Prompts</h1>
  <div class="meta">${list.length} prompt${list.length===1?"":"s"} for <code>${esc(userId)}</code></div>
  <div class="actions">
    <a class="btn" href="/api/prompts/${encodeURIComponent(userId)}" target="_blank" rel="noopener">JSON: list</a>
  </div>
  <table>
    <thead>
      <tr>
        <th>Mnemonic</th><th>Title</th><th>Tags</th><th>Text</th><th>Created</th><th>Updated</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body></html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (e) {
    res.status(500).send(`<pre>Failed to render: ${e.message}</pre>`);
  }
});

/* =========================
   PARAM / USER-SCOPED ROUTES
   ========================= */

// List all for a user
// GET /api/prompts/:userId
router.get("/:userId", async (req, res) => {
  try {
    const data = await promptService.listPrompts(req.params.userId);
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: "Failed to list prompts" });
  }
});

// Get one
// GET /api/prompts/:userId/:mnemonic
router.get("/:userId/:mnemonic", async (req, res) => {
  try {
    const { userId, mnemonic } = req.params;
    const item = await promptService.getPrompt(userId, mnemonic);
    if (!item) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, data: item });
  } catch {
    res.status(500).json({ success: false, error: "Failed to get prompt" });
  }
});

// Update (partial)
// PUT /api/prompts/:userId/:mnemonic   body: { text?, title?, tags?, newMnemonic? }
router.put("/:userId/:mnemonic", async (req, res) => {
  try {
    const { userId, mnemonic } = req.params;
    const updated = await promptService.updatePrompt(userId, mnemonic, req.body || {});
    res.json({ success: true, data: updated });
  } catch (e) {
    const code = e.message === "not found" ? 404 : 400;
    res.status(code).json({ success: false, error: e.message });
  }
});

// Delete
// DELETE /api/prompts/:userId/:mnemonic
router.delete("/:userId/:mnemonic", async (req, res) => {
  try {
    const { userId, mnemonic } = req.params;
    const out = await promptService.deletePrompt(userId, mnemonic);
    res.status(out.success ? 200 : 404).json(out);
  } catch {
    res.status(500).json({ success: false, error: "Failed to delete prompt" });
  }
});

module.exports = router;