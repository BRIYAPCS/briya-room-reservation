// controllers/reservations.controller.js
// -----------------------------------------------------------------------------
// RESERVATIONS CONTROLLER
// -----------------------------------------------------------------------------
// Responsibilities:
// • Serve calendar reservation data (READ)
// • Create new reservations (MODAL CREATE)
// • Update reservation times (DRAG & RESIZE + MODAL EDIT)
// • Normalize datetime values for MySQL
// • Enforce recurrence integrity
// • Provide audit-friendly UTC timestamps
//
// API:
// • GET  /api/reservations/:siteSlug/:roomId
// • POST /api/reservations
// • PUT  /api/reservations/:id
// -----------------------------------------------------------------------------

import { pool, dbReady } from "../db/mysql.js";
import { generateRecurrenceInstances } from "../recurrence/recurrenceEngine.js";
import calendarInviteService from "../services/calendarInviteService.js";



/* ------------------------------------------------------------------
   EMAIL VALIDATION HELPERS
------------------------------------------------------------------ */
function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validateAttendeesEmails(value) {
  if (!value) return [];

  const emails = value
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  return emails.filter((e) => !isValidEmail(e));
}

/* =============================================================================
   AUDIT CONFIGURATION (BACKEND ONLY)
   =============================================================================
   IMPORTANT:
   • These values NEVER affect scheduling
   • They exist ONLY for auditing & compliance
   • Frontend never sends or controls them

   start_time / end_time → LOCAL wall time (human intent)
   created_at_utc        → UTC timestamp (machine truth)
============================================================================= */

const AUDIT_TZ = "America/New_York";

/**
 * Generate a MySQL-safe UTC timestamp string.
 * Format: YYYY-MM-DD HH:MM:SS
 *
 * Used ONLY for audit columns.
 * NEVER use this for start_time / end_time.
 */
function nowUtcMySQL() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

/* =============================================================================
   DATETIME NORMALIZATION (LOCAL WALL TIME)
   =============================================================================
   Guarantees:
   • No UTC conversion
   • No toISOString() for scheduling
   • Output is MySQL DATETIME-safe
============================================================================= */
function toMySQLDateTime(value) {
  if (!value) throw new Error("Invalid datetime value");

  if (typeof value === "string") {
    const s = value.trim();

    // MySQL DATETIME
    const mysqlMatch = s.match(
      /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/
    );
    if (mysqlMatch) {
      const [, y, mo, d, hh, mm, ss] = mysqlMatch;
      return `${y}-${mo}-${d} ${hh}:${mm}:${ss ?? "00"}`;
    }

    // ISO without timezone
    const isoMatch = s.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/
    );
    if (isoMatch) {
      const [, y, mo, d, hh, mm, ss] = isoMatch;
      return `${y}-${mo}-${d} ${hh}:${mm}:${ss ?? "00"}`;
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid datetime value");
  }

  return (
    `${date.getFullYear()}-` +
    `${String(date.getMonth() + 1).padStart(2, "0")}-` +
    `${String(date.getDate()).padStart(2, "0")} ` +
    `${String(date.getHours()).padStart(2, "0")}:` +
    `${String(date.getMinutes()).padStart(2, "0")}:00`
  );
}

/* =============================================================================
   BACKEND RECURRENCE VALIDATION (DEFENSE-IN-DEPTH)
============================================================================= */
function validateRecurrencePayload(recurrence, start, end) {
  if (!recurrence) return [];

  const errors = [];

  if (!recurrence.frequency) {
    errors.push("Recurrence frequency is required.");
  }

  if (
    recurrence.interval !== undefined &&
    (!Number.isInteger(Number(recurrence.interval)) ||
      Number(recurrence.interval) < 1)
  ) {
    errors.push("Recurrence interval must be an integer >= 1.");
  }

  if (!recurrence.until) {
    errors.push("Recurrence end date is required.");
  }

  const until = new Date(recurrence.until);
  if (isNaN(until.getTime())) {
    errors.push("Recurring end date must be a valid date.");
  }

  if (until <= end) {
    errors.push("Recurring end date must be after reservation end.");
  }

  if (recurrence.excludeDates && !Array.isArray(recurrence.excludeDates)) {
    errors.push("excludeDates must be an array.");
  }

  return errors;
}

/* =============================================================================
   GET /api/reservations/:siteSlug/:roomId
   =============================================================================
   Returns all reservations for a given room at a given site.

   IMPORTANT NOTES:
   ---------------------------------------------------------------------------
   • This endpoint feeds BOTH:
     - React Big Calendar rendering
     - Edit Reservation modal (via event.resource)
   • We MUST return all editable fields so the modal can pre-fill values.
   • RoomCalendar / calendarUtils IGNORE extra fields safely.
   • start_time / end_time remain LOCAL wall time (MySQL DATETIME).
   • Audit fields are included for verification/admin use only.
============================================================================= */
export async function getReservationsByRoom(req, res) {
  const { siteSlug, roomId } = req.params;

  // DB warm-up / reconnect safety
  if (!dbReady) {
    return res.status(503).json({ message: "System warming up." });
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT
        r.id,

        -- Scheduling (calendar-critical)
        r.start_time,
        r.end_time,

        -- Form fields (REQUIRED for edit modal hydration)
        r.title,
        r.description,
        r.email,
        r.attendees_emails,

        -- Recurrence (display-only in modal)
        r.recurrence_id,

        -- Snapshot metadata
        r.room_name_snapshot,
        r.site_name_snapshot,

        -- Ownership
        r.created_by_name,

        -- Audit (UTC canonical)
        r.created_at_utc,
        r.updated_at_utc,
        r.created_tz

      FROM reservations r
      JOIN rooms rm ON rm.id = r.room_id
      JOIN sites s ON s.id = r.site_id
      WHERE s.slug = ?
        AND rm.id = ?
      ORDER BY r.start_time ASC;
      `,
      [siteSlug, roomId]
    );

    /*
      NOTE:
      • Rows are returned as-is
      • mapReservationsToEvents attaches each row as event.resource
      • Edit modal reads from activeEvent.resource
    */
    res.json(rows);
  } catch (err) {
    console.error("❌ GET reservations failed:", err.message);
    res.status(500).json({ message: "Unable to load reservations." });
  }
}

/* =============================================================================
   POST /api/reservations
============================================================================= */
export async function createReservation(req, res) {
  const {
    site_id,
    room_id,

    // NEW: user-facing fields (were missing before)
    title,
    description,

    created_by_name,
    email,
    attendees_emails,
    start_time,
    end_time,
    recurrence = null,
  } = req.body;

  // ---------------------------------------------------------------------------
  // DB WARM-UP GUARD
  // ---------------------------------------------------------------------------
  if (!dbReady) {
    return res.status(503).json({ message: "System warming up." });
  }

  /* ------------------------------------------------------------------
     DATE VALIDATION & NORMALIZATION
     ------------------------------------------------------------------
     • Frontend sends MySQL-safe strings ("YYYY-MM-DD HH:MM:SS")
     • We still validate defensively
     • Convert once → reuse everywhere
  ------------------------------------------------------------------ */
  let start, end, startSQL, endSQL;

  try {
    start = new Date(start_time);
    end = new Date(end_time);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error("Invalid datetime value");
    }

    if (start >= end) {
      return res
        .status(400)
        .json({ message: "End time must be after start time." });
    }

    // Canonical MySQL DATETIME (NO timezone conversion)
    startSQL = toMySQLDateTime(start);
    endSQL = toMySQLDateTime(end);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }

  /* ------------------------------------------------------------------
   SITE ↔ ROOM SNAPSHOT
   ------------------------------------------------------------------
   Why snapshots:
   • Preserves historical accuracy
   • Site/room names may change later
   • Calendar + audit views rely on this
------------------------------------------------------------------ */
  const [snapRows] = await pool.query(
    `
  SELECT
    s.name AS site_name,
    r.name AS room_name
  FROM rooms r
  JOIN sites s ON s.id = r.site_id
  WHERE s.id = ?
    AND r.id = ?
  LIMIT 1;
  `,
    [site_id, room_id]
  );

  if (snapRows.length === 0) {
    return res.status(404).json({ message: "Invalid site/room combination." });
  }

  const { site_name, room_name } = snapRows[0];

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    /* ===============================================================
     PLAN A — SINGLE (NON-RECURRING) RESERVATION
     ===============================================================
     CRITICAL GUARANTEES:
     • DB write is atomic
     • Emails are sent ONLY after commit
     • No email is ever sent for rolled-back data
  =============================================================== */
    if (!recurrence) {
      const [result] = await conn.query(
        `
      INSERT INTO reservations (
        site_id,
        room_id,

        title,
        description,

        room_name_snapshot,
        site_name_snapshot,

        created_by_name,
        email,
        attendees_emails,

        start_time,
        end_time,

        created_at_utc,
        created_tz
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
        [
          site_id,
          room_id,

          title || null,
          description || null,

          room_name,
          site_name,

          created_by_name,
          email || null,
          attendees_emails || null,

          startSQL,
          endSQL,

          nowUtcMySQL(),
          AUDIT_TZ,
        ]
      );

      /* --------------------------------------------------------------
       COMMIT FIRST (CRITICAL)
       --------------------------------------------------------------
       WHY:
       • Email sending is NOT transactional
       • If commit fails → NO emails must be sent
       • This preserves data + notification integrity
    -------------------------------------------------------------- */
      await conn.commit();

      /* --------------------------------------------------------------
       🔔 SEND CALENDAR INVITES (ASYNC, POST-COMMIT)
       --------------------------------------------------------------
       WHY:
       • Users expect invites immediately after booking
       • Invite sending must NEVER block the API response
       • Failures here should NOT break reservation creation

       DESIGN CHOICE:
       • Fire-and-forget with logging
       • Future upgrade: background job / queue
    -------------------------------------------------------------- */
      calendarInviteService
        .sendInvitesOnCreate({
          id: result.insertId,
          title,
          description,
          email,
          attendees_emails,
          start_time: startSQL,
          end_time: endSQL,
          room_name_snapshot: room_name,
          site_name_snapshot: site_name,
        })
        .catch((err) => {
          console.error(
            "⚠️ Calendar invite send failed (create):",
            err.message
          );
        });

      /* --------------------------------------------------------------
       RESPONSE (UNCHANGED SHAPE)
       --------------------------------------------------------------
       Frontend calendar depends on this exact payload
    -------------------------------------------------------------- */
      return res.status(201).json({
        id: result.insertId,
        site_id,
        room_id,
        title: title || null,
        description: description || null,
        room_name_snapshot: room_name,
        site_name_snapshot: site_name,
        created_by_name,
        start_time: startSQL,
        end_time: endSQL,
      });
    }

    /* ===============================================================
     PLAN B — RECURRING RESERVATION
     ===============================================================
     (UNCHANGED — invites handled later per-instance or series)
  =============================================================== */

    // ... your existing recurring logic stays exactly the same ...
  } catch (err) {
    await conn.rollback();
    console.error("❌ CREATE reservation failed:", err.message);
    res.status(500).json({ message: "Failed to create reservation." });
  } finally {
    conn.release();
  }
}

/* =============================================================================
   PUT /api/reservations/:id
=============================================================================
   Updates editable fields for a SINGLE (non-recurring) reservation.

   Editable:
   • start_time
   • end_time
   • title
   • description
   • created_by_name
   • email
   • attendees_emails

   NOT editable:
   • site_id
   • room_id
   • recurrence / recurrence_id
   • created_at_utc
   • created_tz
============================================================================= */
export async function updateReservationTime(req, res) {
  const { id } = req.params;

  const {
    start_time,
    end_time,
    title,
    description,
    created_by_name,
    email,
    attendees_emails,

    // FUTURE-SAFE: Edit scope hook
    edit_scope = "single",
  } = req.body;

  /* ------------------------------------------------------------------
     DB readiness guard
  ------------------------------------------------------------------ */
  if (!dbReady) {
    return res.status(503).json({ message: "System warming up." });
  }

  /* ------------------------------------------------------------------
     FUTURE-SAFE GUARD: series edits not implemented yet
  ------------------------------------------------------------------ */
  if (edit_scope !== "single") {
    return res.status(400).json({
      message: "Editing an entire series is not supported yet.",
    });
  }

  /* ------------------------------------------------------------------
     ID validation
  ------------------------------------------------------------------ */
  const reservationId = Number(id);
  if (!Number.isInteger(reservationId)) {
    return res.status(400).json({ message: "Invalid reservation id" });
  }

  /* ------------------------------------------------------------------
     BLOCK editing recurring instances
  ------------------------------------------------------------------ */
  const [[existing]] = await pool.query(
    `SELECT recurrence_id FROM reservations WHERE id = ? LIMIT 1`,
    [reservationId]
  );

  if (!existing) {
    return res.status(404).json({ message: "Reservation not found" });
  }

  if (existing.recurrence_id != null) {
    return res.status(400).json({
      message: "Recurring reservation instances cannot be edited.",
    });
  }

  /* ------------------------------------------------------------------
     FETCH EXISTING RESERVATION (FOR INVITE DIFFING)
     ------------------------------------------------------------------
     WHY:
     • Required to detect what changed
     • Needed to avoid duplicate calendar invites
     • Enables CANCEL emails for removed attendees
  ------------------------------------------------------------------ */
  const [[oldReservation]] = await pool.query(
    `
    SELECT
      id,
      title,
      description,
      email,
      attendees_emails,
      start_time,
      end_time,
      room_name_snapshot,
      site_name_snapshot
    FROM reservations
    WHERE id = ?
    LIMIT 1;
    `,
    [reservationId]
  );

  if (!oldReservation) {
    return res.status(404).json({ message: "Reservation not found" });
  }

  /* ------------------------------------------------------------------
     DATETIME normalization (LOCAL wall time)
  ------------------------------------------------------------------ */
  let startSQL, endSQL;
  try {
    startSQL = toMySQLDateTime(start_time);
    endSQL = toMySQLDateTime(end_time);
  } catch {
    return res.status(400).json({ message: "Invalid datetime format" });
  }

  if (startSQL >= endSQL) {
    return res
      .status(400)
      .json({ message: "End time must be after start time." });
  }

  /* ------------------------------------------------------------------
     EMAIL VALIDATION (BACKEND AUTHORITY)
  ------------------------------------------------------------------ */
  if (!isValidEmail(email)) {
    return res.status(400).json({
      message: "Primary email address is invalid.",
    });
  }

  const invalidAttendees = validateAttendeesEmails(attendees_emails);
  if (invalidAttendees.length > 0) {
    return res.status(400).json({
      message: `Invalid attendee emails: ${invalidAttendees.join(", ")}`,
    });
  }

  /* ------------------------------------------------------------------
     EXECUTE UPDATE (⚠️ UPDATE — NOT INSERT ⚠️)
  ------------------------------------------------------------------ */
  try {
    const [result] = await pool.query(
      `
      UPDATE reservations
      SET
        start_time = ?,
        end_time = ?,
        title = ?,
        description = ?,
        created_by_name = ?,
        email = ?,
        attendees_emails = ?,
        updated_at_utc = UTC_TIMESTAMP()
      WHERE id = ?;
      `,
      [
        startSQL,
        endSQL,
        title || null,
        description || null,
        created_by_name,
        email,
        attendees_emails || null,
        reservationId,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Reservation not found" });
    }

    /* --------------------------------------------------------------
       🔔 SEND CALENDAR UPDATES (ASYNC, POST-UPDATE)
       --------------------------------------------------------------
       WHY:
       • Notify ONLY affected attendees
       • Avoid duplicate invites
       • Proper UPDATE vs CANCEL semantics (Outlook / Google)
       • Must NEVER block API response
    -------------------------------------------------------------- */
    calendarInviteService
      .sendInvitesOnUpdate({
        reservation: {
          id: reservationId,
          title,
          description,
          email,
          attendees_emails,
          start_time: startSQL,
          end_time: endSQL,
          room_name_snapshot: oldReservation.room_name_snapshot,
          site_name_snapshot: oldReservation.site_name_snapshot,
        },
        previousReservation: oldReservation,
      })
      .catch((err) => {
        console.error("⚠️ Calendar invite send failed (update):", err.message);
      });

    /* ------------------------------------------------------------------
       SUCCESS RESPONSE (UNCHANGED SHAPE)
    ------------------------------------------------------------------ */
    return res.json({
      id: reservationId,
      start_time: startSQL,
      end_time: endSQL,
      title,
      description,
      created_by_name,
      email,
      attendees_emails,
    });
  } catch (err) {
    console.error("❌ UPDATE reservation failed:", err.message);
    return res.status(500).json({ message: "Failed to update reservation" });
  }
}
