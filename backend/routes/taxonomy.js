// backend/routes/taxonomy.js
const express = require("express");
const router = express.Router();
const taxonomy = require("../services/taxonomy-service");

/* ---------- COLLECTION / FIXED ROUTES (must come first) ---------- */

// Pretty HTML table
router.get("/html", async (_req, res) => {
  try {
    const list = await taxonomy.list();
    const rows = list.map(e => `
      <tr>
        <td><code>${e.key}</code></td>
        <td>${e.label}</td>
        <td>${e.category}</td>
        <td>${(e.synonyms||[]).join("<br>")}</td>
        <td>${(e.implies||[]).map(k=>`<code>${k}</code>`).join(", ")}</td>
        <td>${(e.tags||[]).join(", ")}</td>
        <td>${e.vendor ?? ""}</td>
        <td>${e.deprecated ? "Yes" : "No"}</td>
        <td>${e.notes || ""}</td>
      </tr>
    `).join("") || `<tr><td colspan="9" class="empty">No entries yet.</td></tr>`;

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Technology Taxonomy</title>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background:#fafafa; color:#1a1a1a; margin:40px auto; max-width:1200px; padding:0 20px; line-height:1.5; }
    h1 { font-size:1.6rem; font-weight:600; margin:0 0 6px; letter-spacing:.02em; }
    .meta { color:#666; margin-bottom:16px; }
    table { width:100%; border-collapse:collapse; border-radius:8px; overflow:hidden; box-shadow:0 0 6px rgba(0,0,0,.05); font-size:.92rem; }
    th, td { padding:10px 12px; border-bottom:1px solid #e5e5e5; vertical-align:top; }
    th { background:#f5f5f5; text-align:left; font-size:.8rem; letter-spacing:.04em; text-transform:uppercase; color:#333; }
    code { background:#f2f2f2; padding:2px 6px; border-radius:4px; }
    .empty { text-align:center; color:#777; font-style:italic; }
  </style>
</head>
<body>
  <h1>Technology Taxonomy</h1>
  <div class="meta">${list.length} entries</div>
  <table>
    <thead>
      <tr>
        <th>Key</th><th>Label</th><th>Category</th><th>Synonyms</th><th>Implies</th><th>Tags</th><th>Vendor</th><th>Deprecated</th><th>Notes</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (e) {
    res.status(500).send(`<pre>Failed to render: ${e.message}</pre>`);
  }
});

// Export full JSON (version + entries)
router.get("/export/all/json", async (_req, res) => {
  try {
    const data = await taxonomy.exportAll();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: "Failed to export" });
  }
});

// Resolve free-text tokens → canonical keys
router.post("/resolve/batch", async (req, res) => {
  try {
    const tokens = Array.isArray(req.body?.tokens) ? req.body.tokens : [];
    const keys = await taxonomy.resolve(tokens);
    res.json({ success: true, data: keys });
  } catch (e) {
    res.status(400).json({ success: false, error: "Bad payload" });
  }
});

// Bulk replace all entries
router.post("/bulk/replace", async (req, res) => {
  try {
    const entries = req.body?.entries || [];
    const out = await taxonomy.replaceAll(entries);
    res.json(out);
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// Create new entry
router.post("/", async (req, res) => {
  try {
    const created = await taxonomy.create(req.body);
    res.status(201).json({ success: true, data: created });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// List (with optional ?query=&category= filters)
router.get("/", async (req, res) => {
  try {
    const { query, category } = req.query;
    if (query || category) {
      const data = await taxonomy.search(query || "", { category });
      return res.json({ success: true, data });
    }
    const data = await taxonomy.list();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: "Failed to list" });
  }
});

/* ---------- PARAMETERIZED ROUTES (must come last) ---------- */

// Get single entry
router.get("/:key", async (req, res) => {
  try {
    const item = await taxonomy.get(req.params.key);
    if (!item) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, data: item });
  } catch (e) {
    res.status(500).json({ success: false, error: "Failed to get" });
  }
});

// Update entry
router.put("/:key", async (req, res) => {
  try {
    const updated = await taxonomy.update(req.params.key, req.body);
    res.json({ success: true, data: updated });
  } catch (e) {
    const code = e.message === "Not found" ? 404 : 400;
    res.status(code).json({ success: false, error: e.message });
  }
});

// Delete entry
router.delete("/:key", async (req, res) => {
  try {
    const out = await taxonomy.remove(req.params.key);
    const code = out.success ? 200 : 404;
    res.status(code).json(out);
  } catch (e) {
    res.status(500).json({ success: false, error: "Failed to delete" });
  }
});

module.exports = router;