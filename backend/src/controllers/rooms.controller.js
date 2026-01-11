// rooms.controller.js
// -----------------------------------------------------------------------------
// ROOMS CONTROLLER
// -----------------------------------------------------------------------------
// Handles fetching rooms from the database.
//
// Design goals:
// • Safe against temporary DB outages
// • Graceful startup & reconnection handling
// • Prevents backend crashes
// • Refresh-safe & deep-link safe
// • NEVER exposes database details to frontend
// • Supports explicit room ordering via display_order
// -----------------------------------------------------------------------------

import { pool, dbReady } from "../db/mysql.js";

/**
 * -----------------------------------------------------------------------------
 * GET /api/rooms/:siteSlug
 * -----------------------------------------------------------------------------
 * Returns all ACTIVE rooms for a given site (by site slug).
 *
 * Used by:
 *  • Rooms.jsx (Rooms list page)
 *
 * Behavior:
 *  • If system is warming up → return 503
 *  • If DB connection drops → return 503
 *  • Results are ordered by:
 *      1) display_order (explicit admin control)
 *      2) name (stable alphabetical fallback)
 * -----------------------------------------------------------------------------
 */
export async function getRoomsBySiteSlug(req, res) {
  const { siteSlug } = req.params;

  // ---------------------------------------------------------------------------
  // 🧠 SYSTEM READINESS GUARD
  // Backend stays alive while DB reconnects in background
  // ---------------------------------------------------------------------------
  if (!dbReady) {
    return res.status(503).json({
      message:
        "The system is temporarily unavailable. Please try again shortly.",
    });
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT
        r.id,
        r.name,
        r.image_url
      FROM rooms r
      JOIN sites s ON s.id = r.site_id
      WHERE s.slug = ?
        AND r.is_active = TRUE
      ORDER BY r.display_order ASC, r.name ASC;
      `,
      [siteSlug]
    );

    res.json(rows);
  } catch (err) {
    console.error("❌ GET /api/rooms/:siteSlug failed:", err.message);

    // -------------------------------------------------------------------------
    // TRANSIENT BACKEND / CONNECTION ERRORS
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
    res.status(500).json({
      message: "Unable to load rooms at this time.",
    });
  }
}

/**
 * -----------------------------------------------------------------------------
 * GET /api/rooms/:siteSlug/:roomId
 * -----------------------------------------------------------------------------
 * Returns a SINGLE room by ID, scoped to a site.
 *
 * Used by:
 *  • Calendar.jsx (deep link + refresh-safe)
 *
 * Notes:
 *  • Prevents cross-site room access
 *  • Enables refresh-safe calendar URLs
 * -----------------------------------------------------------------------------
 */
export async function getRoomById(req, res) {
  const { siteSlug, roomId } = req.params;

  // ---------------------------------------------------------------------------
  // 🧠 SYSTEM READINESS GUARD
  // ---------------------------------------------------------------------------
  if (!dbReady) {
    return res.status(503).json({
      message:
        "The system is temporarily unavailable. Please try again shortly.",
    });
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT
        r.id,
        r.name,
        r.image_url
      FROM rooms r
      JOIN sites s ON s.id = r.site_id
      WHERE s.slug = ?
        AND r.id = ?
      LIMIT 1;
      `,
      [siteSlug, roomId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Room not found",
      });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("❌ GET /api/rooms/:siteSlug/:roomId failed:", err.message);

    // -------------------------------------------------------------------------
    // TRANSIENT BACKEND / CONNECTION ERRORS
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
    res.status(500).json({
      message: "Unable to load room details at this time.",
    });
  }
}
