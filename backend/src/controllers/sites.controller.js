// sites.controller.js
// -----------------------------------------------------------------------------
// SITES CONTROLLER
// -----------------------------------------------------------------------------
// Handles fetching sites from the database.
//
// Design goals:
// • Safe against temporary DB outages
// • Graceful startup & reconnection handling
// • User-facing messages are NON-technical
// • Meaningful HTTP status codes
// • Backend NEVER crashes due to DB issues
// -----------------------------------------------------------------------------

import { pool, dbReady } from "../db/mysql.js";

/**
 * -----------------------------------------------------------------------------
 * GET /api/sites
 * -----------------------------------------------------------------------------
 * Returns all sites sorted by name
 *
 * Used by:
 *  • Home.jsx
 *
 * Behavior:
 *  • If DB is still initializing → return 503 (temporary)
 *  • If DB connection drops → return 503 (temporary)
 *  • Never exposes DB/MySQL details to frontend
 * -----------------------------------------------------------------------------
 */
export async function getSites(req, res) {
  // ---------------------------------------------------------------------------
  // 🧠 DATABASE READINESS GUARD
  // The API stays online while DB reconnects in background
  // ---------------------------------------------------------------------------
  if (!dbReady) {
    return res.status(503).json({
      // ⚠️ User-friendly, non-technical wording
      message:
        "The system is temporarily unavailable. Please try again shortly.",
    });
  }

  try {
    const [rows] = await pool.query(`
      SELECT id, slug, name, image_url
      FROM sites
      ORDER BY display_order ASC, name ASC;
    `);

    res.json(rows);
  } catch (err) {
    console.error("❌ GET /api/sites failed:", err.message);

    // -------------------------------------------------------------------------
    // TRANSIENT BACKEND / DATABASE ERRORS
    // (network blip, timeout, MySQL restart, etc.)
    // -------------------------------------------------------------------------
    if (
      err.code === "ECONNREFUSED" ||
      err.code === "ETIMEDOUT" ||
      err.code === "PROTOCOL_CONNECTION_LOST"
    ) {
      return res.status(503).json({
        message:
          "The system is temporarily unavailable. Please try again shortly.",
      });
    }

    // -------------------------------------------------------------------------
    // UNEXPECTED SERVER ERROR
    // -------------------------------------------------------------------------
    return res.status(500).json({
      message: "Unable to load sites at this time.",
    });
  }
}
