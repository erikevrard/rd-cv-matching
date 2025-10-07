const express = require("express");
const router = express.Router();
const tenderSearchService = require("../services/tender-search-service");

/**
 * CREATE a tender search
 * Preferred payload:
 * { userId, tenderId?, seniority, requestedServices:[], profiles:[{ title, description?, natureOfTasks?, knowledgeAndSkills? }...] }
 * (Back-compat accepts single-profile fields; requestedProfile is ignored)
 */
router.post("/", async (req, res) => {
  try {
    const {
      userId,
      tenderId,
      seniority,
      requestedServices,
      profiles,
      // back-compat single-profile fields
      profileTitle,
      profileDescription,
      natureOfTasks,
      knowledgeAndSkills,
    } = req.body || {};

    const record = await tenderSearchService.createTenderSearch(userId, {
      tenderId,
      seniority,
      requestedServices,
      profiles,
      profileTitle,
      profileDescription,
      natureOfTasks,
      knowledgeAndSkills,
    });

    res.json({ success: true, data: record });
  } catch (err) {
    res.status(400).json({ success: false, error: String(err.message || err) });
  }
});

/**
 * LIST all for user (works in browser)
 * GET /api/tender-searches/:userId
 */
router.get("/:userId", async (req, res) => {
  try {
    const list = await tenderSearchService.listTenderSearches(req.params.userId);
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err.message || err) });
  }
});

/**
 * GET ACTIVE one
 * GET /api/tender-searches/:userId/active
 */
router.get("/:userId/active", async (req, res) => {
  try {
    const active = await tenderSearchService.getActive(req.params.userId);
    if (!active) return res.status(404).json({ success: false, error: "No active tender search" });
    res.json({ success: true, data: active });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err.message || err) });
  }
});

/**
 * RESET ALL (delete all for user)
 * DELETE /api/tender-searches/reset/:userId
 */
router.delete("/reset/:userId", async (req, res) => {
  try {
    const out = await tenderSearchService.clearAll(req.params.userId);
    res.json(out);
  } catch (err) {
    res.status(400).json({ success: false, error: String(err.message || err) });
  }
});

/**
 * DELETE ONE (param-based; no body needed)
 * DELETE /api/tender-searches/:userId/:mnemonic
 */
router.delete("/:userId/:mnemonic", async (req, res) => {
  try {
    const { userId, mnemonic } = req.params;
    const result = await tenderSearchService.deleteTenderSearch(userId, mnemonic);
    if (!result.success) return res.status(404).json(result);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: String(err.message || err) });
  }
});

/**
 * ACTIVATE / DEACTIVATE (param-based; no body needed except active boolean)
 * POST /api/tender-searches/:userId/:mnemonic/active
 * Body: { active: true|false }
 */
router.post("/:userId/:mnemonic/active", async (req, res) => {
  try {
    const { userId, mnemonic } = req.params;
    const { active } = req.body || {};
    const result = await tenderSearchService.setActive(userId, mnemonic, !!active);
    if (!result.success) return res.status(404).json(result);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: String(err.message || err) });
  }
});

/* ---- Backward-compat endpoints (keep working with older callers) ---- */

// (Old) ACTIVATE/DEACTIVATE: POST /api/tender-searches/:mnemonic/active with { userId, active }
router.post("/:mnemonic/active", async (req, res, next) => {
  // Only handle if userId is in body and route didn't match the param-based one above
  if (!req.params.userId && req.body && req.body.userId) {
    try {
      const { mnemonic } = req.params;
      const { userId, active } = req.body;
      const result = await tenderSearchService.setActive(userId, mnemonic, !!active);
      if (!result.success) return res.status(404).json(result);
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ success: false, error: String(err.message || err) });
    }
  }
  return next();
});

// (Old) DELETE ONE: DELETE /api/tender-searches/:mnemonic with { userId }
router.delete("/:mnemonic", async (req, res, next) => {
  if (!req.params.userId && req.body && req.body.userId) {
    try {
      const { mnemonic } = req.params;
      const { userId } = req.body;
      const result = await tenderSearchService.deleteTenderSearch(userId, mnemonic);
      if (!result.success) return res.status(404).json(result);
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ success: false, error: String(err.message || err) });
    }
  }
  return next();
});

module.exports = router;
