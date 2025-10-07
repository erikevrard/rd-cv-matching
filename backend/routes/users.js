// backend/routes/users.js
const express = require("express");
const router = express.Router();
const authService = require("../services/auth-service");

/** Strip sensitive fields from responses */
function publicUser(u) {
  if (!u) return null;
  const { passwordHash, ...rest } = u;
  return rest;
}

/* =========================
   COLLECTION-LEVEL ROUTES
   (must come BEFORE any "/:userId" routes)
   ========================= */

/** Create user (admin)
 * POST /api/users
 * Body: { name, email, password, active?, isPrime? }
 */
router.post("/", async (req, res) => {
  try {
    const { name, email, password, active, isPrime } = req.body || {};
    const result = await authService.createUserAdmin({ name, email, password, active, isPrime });
    if (!result?.success) return res.status(400).json(result);
    return res.status(201).json({ success: true, data: result.user });
  } catch (err) {
    console.error("Create user error:", err);
    res.status(500).json({ success: false, error: "Failed to create user" });
  }
});

/** List users (no passwords)
 * GET /api/users
 */
router.get("/", async (_req, res) => {
  try {
    const users = await authService.getAllUsers();
    res.json({ success: true, data: users.map(publicUser) });
  } catch (err) {
    console.error("List users error:", err);
    res.status(500).json({ success: false, error: "Failed to list users" });
  }
});

/** Quick IDs list (handy for scripting)
 * GET /api/users/ids
 */
router.get("/ids", async (_req, res) => {
  try {
    const users = await authService.getAllUsers();
    const data = users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      active: !!u.active,
      isPrime: !!u.isPrime,
    }));
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: "Failed to list user ids" });
  }
});

/** Lookup by id OR email
 * GET /api/users/lookup?email=... or ?id=...
 */
router.get("/lookup", async (req, res) => {
  try {
    const { id, email } = req.query || {};
    const users = await authService.getAllUsers();

    let user = null;
    if (id) {
      user = users.find(u => u.id === String(id));
    } else if (email) {
      const em = String(email).toLowerCase();
      user = users.find(u => (u.email || "").toLowerCase() === em);
    } else {
      return res.status(400).json({ success: false, error: "Provide id or email" });
    }

    if (!user) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, data: publicUser(user) });
  } catch {
    res.status(500).json({ success: false, error: "Lookup failed" });
  }
});

/** Convenience: activate/deactivate by id OR email
 * POST /api/users/activate
 * Body: { id OR email, active: true|false }
 */
router.post("/activate", async (req, res) => {
  try {
    const { id, email, active } = req.body || {};
    let userId = id;

    if (!userId) {
      if (!email) return res.status(400).json({ success: false, error: "id or email required" });
      const users = await authService.getAllUsers();
      const u = users.find(x => (x.email || "").toLowerCase() === String(email).toLowerCase());
      if (!u) return res.status(404).json({ success: false, error: "User not found by email" });
      userId = u.id;
    }

    const r = await authService.setUserActive(userId, !!active);
    if (!r?.success) return res.status(r.status || 400).json(r);
    res.json(r);
  } catch (err) {
    console.error("Set active (convenience) error:", err);
    res.status(500).json({ success: false, error: "Failed to set active" });
  }
});

/** Convenience: set/unset prime by id
 * POST /api/users/prime
 * Body: { id, prime: true|false }
 */
router.post("/prime", async (req, res) => {
  try {
    const { id, prime } = req.body || {};
    if (!id) return res.status(400).json({ success: false, error: "id required" });
    const r = await authService.setUserPrime(id, !!prime);
    if (!r?.success) return res.status(r.status || 400).json(r);
    res.json(r);
  } catch (err) {
    console.error("Set prime (convenience) error:", err);
    res.status(500).json({ success: false, error: "Failed to set prime" });
  }
});

/** Pretty HTML list
 * GET /api/users/html  (alias: /api/users/html/list)
 */
router.get(["/html", "/html/list"], async (_req, res) => {
  try {
    const users = await authService.getAllUsers();

    // dd-Mon-yyyy HH:mm (24h)
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

    const rows = users.map(u => {
      const status = u.active ? `<span class="badge active">ACTIVE</span>` : `<span class="badge inactive">inactive</span>`;
      const prime = u.isPrime ? `<span class="badge prime">PRIME</span>` : ``;
      return `
        <tr>
          <td><code>${u.id}</code><br>${status} ${prime}</td>
          <td>${u.name || ""}</td>
          <td>${u.email || ""}</td>
          <td>${fmtDate(u.createdAt)}</td>
          <td>${fmtDate(u.updatedAt)}</td>
          <td>${fmtDate(u.lastLogin)}</td>
        </tr>`;
    }).join("") || `<tr><td colspan="6" class="empty">No users yet.</td></tr>`;

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Users</title>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    :root { color-scheme: light dark; }
    body {
      font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #fafafa; color: #1a1a1a; margin: 40px auto; max-width: 1100px; padding: 0 20px; line-height: 1.5;
    }
    h1 { font-size: 1.6rem; font-weight: 600; margin-bottom: .2rem; letter-spacing: .02em; }
    .meta { margin-bottom: 1.2rem; color: #555; font-size: .95rem; }
    table { width: 100%; border-collapse: collapse; font-size: .9rem; border-radius: 8px; overflow: hidden; box-shadow: 0 0 6px rgba(0,0,0,.05); }
    th, td { padding: 10px 14px; border-bottom: 1px solid #e3e3e3; vertical-align: top; }
    th { text-align: left; background: #f5f5f5; font-weight: 600; font-size: .85rem; text-transform: uppercase; letter-spacing: .03em; color: #333; }
    tr:hover td { background: #fdfdfd; }
    code { font-family: "SF Mono", Menlo, Consolas, monospace; background: #f2f2f2; padding: 2px 6px; border-radius: 4px; font-size: .85em; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: .75rem; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; margin-top: 4px; }
    .badge.active { background: #e6f6ec; color: #15803d; border: 1px solid #15803d33; }
    .badge.inactive { background: #f4f4f4; color: #666; border: 1px solid #ddd; }
    .badge.prime { background: #fff7e6; color: #b45309; border: 1px solid #b4530933; }
    .empty { text-align: center; color: #777; font-style: italic; }
    .actions { margin-bottom: 1.2rem; display: flex; gap: .6rem; flex-wrap: wrap; }
    a.btn { display:inline-block; padding:6px 12px; border-radius:6px; text-decoration:none; background:#f8f8f8; border:1px solid #ddd; color:#333; font-size:.9rem; }
    a.btn:hover { background:#f0f0f0; }
  </style>
</head>
<body>
  <h1>Users</h1>
  <div class="meta">${users.length} record${users.length === 1 ? "" : "s"}</div>

  <div class="actions">
    <a class="btn" href="/api/users" target="_blank" rel="noopener">JSON: list all</a>
    <a class="btn" href="/api/users/ids" target="_blank" rel="noopener">JSON: ids</a>
  </div>

  <table>
    <thead>
      <tr>
        <th>ID / Status</th>
        <th>Name</th>
        <th>Email</th>
        <th>Created</th>
        <th>Updated</th>
        <th>Last Login</th>
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

/* =========================
   PARAM ROUTES (catch-alls)
   ========================= */

/** Get one user by ID
 * GET /api/users/:userId
 */
router.get("/:userId", async (req, res) => {
  try {
    const user = await authService.getUserById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, data: publicUser(user) });
  } catch (err) {
    console.error("Get user error:", err);
    res.status(500).json({ success: false, error: "Failed to get user" });
  }
});

/** Update profile (name/email) & optional active
 * PUT /api/users/:userId
 * Body: { name?, email?, active? }
 */
router.put("/:userId", async (req, res) => {
  try {
    const { name, email, active } = req.body || {};
    const id = req.params.userId;

    if (name || email) {
      const r = await authService.updateUserProfile(id, { name, email });
      if (!r?.success) return res.status(400).json(r);
    }
    if (typeof active === "boolean") {
      const r = await authService.setUserActive(id, active);
      if (!r?.success) return res.status(r.status || 400).json(r);
    }

    const user = await authService.getUserById(id);
    if (!user) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, data: publicUser(user) });
  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).json({ success: false, error: "Failed to update user" });
  }
});

/** Activate/deactivate (param)
 * POST /api/users/:userId/active
 * Body: { active: true|false }
 */
router.post("/:userId/active", async (req, res) => {
  try {
    const id = req.params.userId;
    const { active } = req.body || {};
    const r = await authService.setUserActive(id, !!active);
    if (!r?.success) return res.status(r.status || 400).json(r);
    res.json(r);
  } catch (err) {
    console.error("Set active error:", err);
    res.status(500).json({ success: false, error: "Failed to set active" });
  }
});

/** Set/unset prime (param)
 * POST /api/users/:userId/prime
 * Body: { prime: true|false }
 */
router.post("/:userId/prime", async (req, res) => {
  try {
    const id = req.params.userId;
    const { prime } = req.body || {};
    const r = await authService.setUserPrime(id, !!prime);
    if (!r?.success) return res.status(r.status || 400).json(r);
    res.json(r);
  } catch (err) {
    console.error("Set prime error:", err);
    res.status(500).json({ success: false, error: "Failed to set prime" });
  }
});

/** Delete user (prime protected → 403)
 * DELETE /api/users/:userId
 */
router.delete("/:userId", async (req, res) => {
  try {
    const result = await authService.deleteUser(req.params.userId);
    res.status(result.status || (result.success ? 200 : 400)).json(result);
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
