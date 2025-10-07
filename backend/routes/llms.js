// backend/routes/llms.js
const express = require("express");
const router = express.Router();
const llmService = require("../services/llm-service");

// CREATE LLM config
// POST /api/llms
// Body: { userId, name?, model, version, apiUrl, apiKey?, headers?, temperature?, maxTokens?, timeoutMs? }
router.post("/", async (req, res) => {
  try {
    const rec = await llmService.createConfig(req.body.userId, req.body);
    res.json({ success: true, data: llmService.toPublic(rec) });
  } catch (err) {
    res.status(400).json({ success: false, error: String(err.message || err) });
  }
});

// LIST all configs (masked keys)
// GET /api/llms/:userId
router.get("/:userId", async (req, res) => {
  try {
    const list = await llmService.list(req.params.userId);
    res.json({
      success: true,
      data: list.map(r => llmService.toPublic(r)),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err.message || err) });
  }
});

// GET active config (masked key)
// GET /api/llms/:userId/active
router.get("/:userId/active", async (req, res) => {
  try {
    const active = await llmService.getActive(req.params.userId);
    if (!active) return res.status(404).json({ success: false, error: "No active LLM" });
    res.json({ success: true, data: llmService.toPublic(active) });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err.message || err) });
  }
});

// ACTIVATE / DEACTIVATE
// POST /api/llms/:userId/:mnemonic/active   Body: { active: true|false }
router.post("/:userId/:mnemonic/active", async (req, res) => {
  try {
    const { userId, mnemonic } = req.params;
    const { active } = req.body || {};
    const out = await llmService.setActive(userId, mnemonic, !!active);
    if (!out.success) return res.status(404).json(out);
    res.json(out);
  } catch (err) {
    res.status(400).json({ success: false, error: String(err.message || err) });
  }
});

// DELETE one
// DELETE /api/llms/:userId/:mnemonic
router.delete("/:userId/:mnemonic", async (req, res) => {
  try {
    const out = await llmService.delete(req.params.userId, req.params.mnemonic);
    if (!out.success) return res.status(404).json(out);
    res.json(out);
  } catch (err) {
    res.status(400).json({ success: false, error: String(err.message || err) });
  }
});

// HTML view: GET /api/llms/:userId/html
// Elegant HTML view for LLMs
router.get("/:userId/html", async (req, res) => {
  try {
    const userId = req.params.userId;
    const list = await llmService.list(userId);

    // Date formatting: "06-Oct-2025 14:23"
    const fmtDate = (iso) => {
      if (!iso) return "";
      const d = new Date(iso);
      const day = d.getDate().toString().padStart(2, "0");
      const mon = d.toLocaleString("en-GB", { month: "short" });
      const yr = d.getFullYear();
      const hh = d.getHours().toString().padStart(2, "0");
      const mm = d.getMinutes().toString().padStart(2, "0");
      return `${day}-${mon}-${yr} ${hh}:${mm}`;
    };

    const rows = list.map(r => {
      const maskedKey = llmService.toPublic(r).apiKey || "";
      const activeBadge = r.active
        ? `<span class="badge active">ACTIVE</span>`
        : `<span class="badge inactive">inactive</span>`;

      return `
        <tr>
          <td><code>${r.mnemonic}</code><br>${activeBadge}</td>
          <td>${r.name ?? ""}</td>
          <td>${r.model}</td>
          <td>${r.version}</td>
          <td><a href="${r.apiUrl}" target="_blank" rel="noopener noreferrer">${r.apiUrl}</a></td>
          <td><code>${maskedKey}</code></td>
          <td>${r.temperature ?? ""}</td>
          <td>${r.maxTokens ?? ""}</td>
          <td>${fmtDate(r.createdAt)}</td>
          <td>${fmtDate(r.updatedAt)}</td>
        </tr>`;
    }).join("") || `<tr><td colspan="10" class="empty">No LLMs configured yet.</td></tr>`;

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>LLMs – ${userId}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    :root { color-scheme: light dark; }
    body {
      font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #fafafa;
      color: #1a1a1a;
      margin: 40px auto;
      max-width: 1200px;
      padding: 0 20px;
      line-height: 1.5;
    }
    h1 {
      font-size: 1.6rem;
      font-weight: 600;
      margin-bottom: 0.2rem;
      letter-spacing: 0.02em;
    }
    .meta {
      margin-bottom: 1.5rem;
      color: #555;
      font-size: 0.95rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 0 6px rgba(0,0,0,0.05);
    }
    th, td {
      padding: 10px 14px;
      border-bottom: 1px solid #e3e3e3;
      vertical-align: top;
    }
    th {
      text-align: left;
      background: #f5f5f5;
      font-weight: 600;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: #333;
    }
    tr:hover td {
      background: #fdfdfd;
    }
    code {
      font-family: "SF Mono", Menlo, Consolas, monospace;
      background: #f2f2f2;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.85em;
    }
    a {
      color: #0066cc;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-top: 4px;
    }
    .badge.active {
      background: #e6f6ec;
      color: #15803d;
      border: 1px solid #15803d33;
    }
    .badge.inactive {
      background: #f4f4f4;
      color: #666;
      border: 1px solid #ddd;
    }
    .empty {
      text-align: center;
      color: #777;
      font-style: italic;
    }
    .actions {
      margin-bottom: 1.5rem;
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
    }
    a.btn {
      display:inline-block;
      padding:6px 12px;
      border-radius:6px;
      text-decoration:none;
      background:#f8f8f8;
      border:1px solid #ddd;
      color:#333;
      font-size:0.9rem;
    }
    a.btn:hover {
      background:#f0f0f0;
    }
  </style>
</head>
<body>
  <h1>Configured LLM Interfaces</h1>
  <div class="meta">User: <strong>${userId}</strong> — ${list.length} record${list.length === 1 ? "" : "s"}</div>

  <div class="actions">
    <a class="btn" href="/api/llms/${encodeURIComponent(userId)}" target="_blank">JSON: list all</a>
    <a class="btn" href="/api/llms/${encodeURIComponent(userId)}/active" target="_blank">JSON: active</a>
  </div>

  <table>
    <thead>
      <tr>
        <th>Mnemonic / Status</th>
        <th>Name</th>
        <th>Model</th>
        <th>Version</th>
        <th>API URL</th>
        <th>API Key</th>
        <th>Temp</th>
        <th>Max Tokens</th>
        <th>Created</th>
        <th>Updated</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    res.status(500).send(`<pre>Failed to render: ${String(err.message || err)}</pre>`);
  }
});

module.exports = router;