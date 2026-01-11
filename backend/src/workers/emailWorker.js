// src/workers/emailWorker.js
// -----------------------------------------------------------------------------
// EMAIL WORKER
// -----------------------------------------------------------------------------
// Responsibilities:
// • Poll email_jobs table
// • Send emails
// • Retry failed jobs with exponential backoff
// • Move permanently failed jobs to dead-letter table
// -----------------------------------------------------------------------------

import { pool } from "../db/mysql.js";
import { sendMail } from "../utils/mailer.js";
import { buildICS } from "../utils/buildICS.js";
import {
  inviteCreatedTemplate,
  inviteUpdatedTemplate,
  inviteCancelledTemplate,
} from "../services/emailTemplates.js";

/* ------------------------------------------------------------------
   CONFIG
------------------------------------------------------------------ */
const MAX_ATTEMPTS = 5;
const BASE_DELAY_MINUTES = 2;

/**
 * Calculate retry delay using exponential backoff
 */
function getBackoffDelay(attempts) {
  return BASE_DELAY_MINUTES * Math.pow(2, attempts - 1);
}

/* ------------------------------------------------------------------
   MAIN WORK LOOP
------------------------------------------------------------------ */
async function processJobs() {
  const [jobs] = await pool.query(
    `
    SELECT *
    FROM email_jobs
    WHERE status IN ('pending', 'failed')
      AND (attempts IS NULL OR attempts < ?)
    ORDER BY created_at ASC
    LIMIT 5;
    `,
    [MAX_ATTEMPTS]
  );

  for (const job of jobs) {
    await processSingleJob(job);
  }
}

/* ------------------------------------------------------------------
   PROCESS ONE JOB
------------------------------------------------------------------ */
async function processSingleJob(job) {
  const attempts = (job.attempts || 0) + 1;

  try {
    await pool.query(
      `
      UPDATE email_jobs
      SET status = 'processing', attempts = ?
      WHERE id = ?
      `,
      [attempts, job.id]
    );

    // ✅ SAFE PARSE
    const payload =
      typeof job.payload === "string" ? JSON.parse(job.payload) : job.payload;

    let template;
    let icsMethod = "REQUEST";

    if (job.type === "invite_create") {
      template = inviteCreatedTemplate(payload.reservation);
    } else if (job.type === "invite_update") {
      template = inviteUpdatedTemplate(payload.reservation);
    } else if (job.type === "invite_cancel") {
      template = inviteCancelledTemplate(payload.reservation);
      icsMethod = "CANCEL";
    } else {
      throw new Error(`Unknown job type: ${job.type}`);
    }

    const ics = buildICS({
      reservation: payload.reservation,
      method: icsMethod,
      attendees: payload.recipients,
    });

    await sendMail({
      to: payload.recipients,
      subject: template.subject,
      html: template.html,
      text: template.text,
      ics,
      icsMethod,
    });

    // ✅ SUCCESS
    await pool.query(
      `
      UPDATE email_jobs
      SET status = 'sent',
          processed_at = NOW(),
          last_error = NULL
      WHERE id = ?
      `,
      [job.id]
    );

    console.log(`✅ Email job ${job.id} sent`);
  } catch (err) {
    // ⛔ DEAD LETTER
    if (attempts >= MAX_ATTEMPTS) {
      await pool.query(
        `
        INSERT INTO email_jobs_dead
          (original_job_id, type, payload, attempts, last_error, failed_at)
        VALUES (?, ?, ?, ?, ?, NOW())
        `,
        [
          job.id,
          job.type,
          job.payload, // already JSON string
          attempts,
          err.message,
        ]
      );

      await pool.query(`DELETE FROM email_jobs WHERE id = ?`, [job.id]);

      console.error(
        `💀 Email job ${job.id} permanently failed and moved to dead-letter table`
      );
      return;
    }

    // 🔁 RETRY
    await pool.query(
      `
      UPDATE email_jobs
      SET
        status = 'failed',
        attempts = ?,
        last_error = ?,
        processed_at = NOW()
      WHERE id = ?
      `,
      [attempts, err.message, job.id]
    );

    console.error(
      `❌ Email job ${job.id} failed (attempt ${attempts}/${MAX_ATTEMPTS})`
    );
  }
}

/* ------------------------------------------------------------------
   POLLING LOOP
------------------------------------------------------------------ */
console.log("📨 Email worker started");

setInterval(() => {
  processJobs().catch((err) =>
    console.error("Worker loop error:", err.message)
  );
}, 30_000);
