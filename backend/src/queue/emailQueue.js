// src/queue/emailQueue.js
// -----------------------------------------------------------------------------
// EMAIL QUEUE
// -----------------------------------------------------------------------------
// Responsibilities:
// • Insert email jobs into email_jobs table
// • Decouple API from email sending
// • Enable retries, workers, future scaling
// -----------------------------------------------------------------------------

import { pool } from "../db/mysql.js"; // ✅ FIX: correct relative path

/**
 * Enqueue an email job
 *
 * @param {"invite_create"|"invite_update"|"invite_cancel"} type
 * @param {Object} payload - stored as JSON
 */
  export async function enqueueEmailJob(type, payload) {
    await pool.query(
      `
      INSERT INTO email_jobs (type, payload, status, attempts, created_at)
      VALUES (?, ?, 'pending', 0, NOW())
      `,
      [
        type,
        JSON.stringify(payload), // ✅ REQUIRED
      ]
    );
    console.log("📥 Email job queued:", type);
  }
