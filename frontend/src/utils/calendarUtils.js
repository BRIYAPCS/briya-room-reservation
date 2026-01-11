// calendarUtils.js
// -----------------------------------------------------------------------------
// SINGLE SOURCE OF TRUTH — CALENDAR RULES & HELPERS
//
// This file defines ALL calendar-related rules and transformations.
// UI components (RoomCalendar.jsx, ReservationModal.jsx, Calendar.jsx, etc.) MUST:
//
//   • READ from this file
//   • NEVER redefine calendar behavior locally
//
// WHY THIS DESIGN IS CRITICAL:
// • Prevents Month / Week / Day view inconsistencies
// • Keeps drag & drop and resize behavior predictable
// • Eliminates time drift (12h / 24h / UTC issues)
// • Makes validation and recurrence rules consistent
// -----------------------------------------------------------------------------

/**
 * ⚠️ CRITICAL:
 * Date objects passed to react-big-calendar MUST be cloned.
 * Do NOT remove getTime() cloning unless you want timezone bugs.
 */


/* ------------------------------------------------------------------
   GLOBAL WEEKEND SWITCH
------------------------------------------------------------------ */
export const IS_WEEKENDS_ENABLED = false;

/* ------------------------------------------------------------------
   CALENDAR SLOT CONFIGURATION
------------------------------------------------------------------ */
export const TIME_SLOT_MINUTES = 30;

/* ------------------------------------------------------------------
   BUSINESS HOURS (ABSOLUTE AUTHORITY)
   ⚠️ Date portion is irrelevant — ONLY time is used
------------------------------------------------------------------ */
export const CALENDAR_MIN_TIME = new Date(1970, 0, 1, 8, 0); // 08:00
export const CALENDAR_MAX_TIME = new Date(1970, 0, 1, 22, 0); // 22:00

/* ------------------------------------------------------------------
   DERIVED BUSINESS-HOUR PRIMITIVES (READ-ONLY)
------------------------------------------------------------------ */
export const BUSINESS_START_HOUR = CALENDAR_MIN_TIME.getHours();
export const BUSINESS_END_HOUR = CALENDAR_MAX_TIME.getHours();

export const BUSINESS_START_TIME_STRING =
  CALENDAR_MIN_TIME.toTimeString().slice(0, 5);

export const BUSINESS_END_TIME_STRING = CALENDAR_MAX_TIME.toTimeString().slice(
  0,
  5
);

/* ------------------------------------------------------------------
   HELPER: Detect weekend days
------------------------------------------------------------------ */
export function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/* ------------------------------------------------------------------
   BACKEND DATETIME PARSER — LOCAL WALL TIME (CRITICAL)
   ------------------------------------------------------------------
   Supports:
   • MySQL DATETIME: "YYYY-MM-DD HH:MM[:SS]"
   • ISO strings:    "YYYY-MM-DDTHH:MM[:SS][.sss][Z|±offset]"
   • Date objects

   GUARANTEES (NON-NEGOTIABLE):
   ------------------------------------------------------------------
   • MySQL DATETIME → treated as LOCAL wall time
   • ISO + Z / offset → converted from REAL timezone to LOCAL
   • ISO without timezone → preserved as wall time
   • NO silent UTC drift
   • Same input ALWAYS yields same clock time

   DEBUGGING MODE (TEMPORARY):
   ------------------------------------------------------------------
   • Logs prove:
     - Function execution
     - Which parsing path is used
     - Final wall-clock hour
------------------------------------------------------------------ */
function parseBackendDateTime(value) {
  /* ------------------------------------------------------------
     ✅ LOG #1 — ENTRY PROOF
     ------------------------------------------------------------ */
  console.log("🧩 parseBackendDateTime input:", value);

  if (!value) return null;

  /* ------------------------------------------------------------
     CASE 1: Already a Date object
     ------------------------------------------------------------
     We CLONE via getTime() to:
     • Preserve exact instant
     • Avoid re-parsing
  ------------------------------------------------------------ */
  if (value instanceof Date) {
    const d = new Date(value.getTime());

    console.log(
      "🧩 parsed Date (from Date):",
      d,
      d.toString(),
      "hours:",
      d.getHours()
    );

    return d;
  }

  const str = String(value).trim();

  /* ------------------------------------------------------------
     CASE 2: MySQL DATETIME (NO timezone)
     Format: "YYYY-MM-DD HH:MM[:SS]"
     ------------------------------------------------------------
     IMPORTANT:
     • MySQL DATETIME has NO timezone
     • Must be treated as LOCAL wall time
  ------------------------------------------------------------ */
  const mysqlMatch = str.match(
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/
  );

  if (mysqlMatch) {
    const [, y, m, d, hh, mm, ss] = mysqlMatch.map(Number);
    const date = new Date(y, m - 1, d, hh, mm, ss ?? 0, 0);

    console.log(
      "🧩 parsed Date (from MySQL):",
      date,
      date.toString(),
      "hours:",
      date.getHours()
    );

    return date;
  }

  /* ------------------------------------------------------------
     CASE 3: ISO STRING (WITH or WITHOUT timezone)
     ------------------------------------------------------------
     Examples:
     • 2025-12-31T13:00:00.000Z
     • 2025-12-31T13:00:00-05:00
     • 2025-12-31T08:00:00

     CRITICAL FIX:
     ------------------------------------------------------------
     • If timezone EXISTS → use native Date parsing
       (converts UTC/offset → LOCAL correctly)
     • If timezone DOES NOT exist → preserve wall time
  ------------------------------------------------------------ */
  const isoMatch = str.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?$/
  );

  if (isoMatch) {
    const [, y, m, d, hh, mm, ss, tz] = isoMatch;

    /* ----------------------------------------------------------
       ISO WITH TIMEZONE (Z or ±offset)
       ----------------------------------------------------------
       This is REAL time — must be converted to LOCAL
    ---------------------------------------------------------- */
    if (tz) {
      const date = new Date(str);

      if (Number.isNaN(date.getTime())) return null;

      console.log(
        "🧩 parsed Date (from ISO w/ timezone):",
        date,
        date.toString(),
        "hours:",
        date.getHours()
      );

      return date;
    }

    /* ----------------------------------------------------------
       ISO WITHOUT TIMEZONE
       ----------------------------------------------------------
       Preserve wall-clock time exactly as written
    ---------------------------------------------------------- */
    const date = new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss ?? 0),
      0
    );

    console.log(
      "🧩 parsed Date (from ISO no timezone):",
      date,
      date.toString(),
      "hours:",
      date.getHours()
    );

    return date;
  }

  /* ------------------------------------------------------------
     FAIL SAFE
     ------------------------------------------------------------
     If we cannot parse explicitly, we REFUSE to guess.
     Silent parsing is how time-drift bugs are born.
  ------------------------------------------------------------ */
  return null;
}
/* ------------------------------------------------------------------
   TRANSFORM BACKEND RESERVATIONS → BIG REACT CALENDAR EVENTS
------------------------------------------------------------------ */
export function mapReservationsToEvents(reservations = []) {
  const events = [];

  reservations.forEach((r) => {
    /* ------------------------------------------------------------
       Parse backend datetimes using LOCAL wall-time parser
       ------------------------------------------------------------
       IMPORTANT:
       • parseBackendDateTime() is the ONLY allowed entry point
       • Returned Dates are LOCAL and timezone-safe
    ------------------------------------------------------------ */
    const parsedStart = parseBackendDateTime(r.start_time);
    const parsedEnd = parseBackendDateTime(r.end_time);

    // Safety guard — never render invalid dates
    if (!parsedStart || !parsedEnd) return;

    /* ------------------------------------------------------------
       HARD IMMUTABLE BASE DATES
       ------------------------------------------------------------
       React Big Calendar MUTATES Date objects internally.
       These base copies are NEVER exposed to the calendar.
    ------------------------------------------------------------ */
    const baseStart = new Date(parsedStart.getTime());
    const baseEnd = new Date(parsedEnd.getTime());

    const isAllDay =
      baseStart.getHours() === 0 &&
      baseStart.getMinutes() === 0 &&
      baseEnd.getHours() === 23 &&
      baseEnd.getMinutes() === 59;

    /* ------------------------------------------------------------
       WEEKENDS ENABLED → ONE CONTINUOUS EVENT
    ------------------------------------------------------------ */
    if (IS_WEEKENDS_ENABLED) {
      events.push({
        id: r.id,
        title: r.title || r.created_by_name,

        // 🔒 HARD CLONES — NEVER pass shared Date references
        start: new Date(baseStart.getTime()),
        end: new Date(baseEnd.getTime()),

        allDay: isAllDay,
        resource: r,
      });
      return;
    }

    /* ------------------------------------------------------------
       WEEKENDS DISABLED — VISUAL WEEKDAY SPLIT
       (DATA IS NOT MUTATED)
    ------------------------------------------------------------ */

    // Cursor starts as a CLONE of baseStart (never reused)
    let cursor = new Date(baseStart.getTime());

    while (cursor < baseEnd) {
      /* ----------------------------------------------------------
         Calculate LOCAL day boundaries
      ---------------------------------------------------------- */
      const dayStart = new Date(cursor.getTime());
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(cursor.getTime());
      dayEnd.setHours(23, 59, 59, 999);

      // Skip weekends entirely when weekends are disabled
      if (isWeekend(dayStart)) {
        cursor.setDate(cursor.getDate() + 1);
        continue;
      }

      /* ----------------------------------------------------------
         Clamp this visual segment to the real reservation range
         (ALL math done in LOCAL time)
      ---------------------------------------------------------- */
      const segmentStart = new Date(
        Math.max(dayStart.getTime(), baseStart.getTime())
      );
      const segmentEnd = new Date(
        Math.min(dayEnd.getTime(), baseEnd.getTime())
      );

      /* ----------------------------------------------------------
         STABLE, TIMEZONE-SAFE SEGMENT ID
         ----------------------------------------------------------
         ❌ NO toISOString()
         ❌ NO UTC math
         ✅ LOCAL calendar date only
      ---------------------------------------------------------- */
      const yyyy = dayStart.getFullYear();
      const mm = String(dayStart.getMonth() + 1).padStart(2, "0");
      const dd = String(dayStart.getDate()).padStart(2, "0");

      events.push({
        id: `${r.id}-${yyyy}-${mm}-${dd}`,

        title: r.title || r.created_by_name,

        /* --------------------------------------------------------
           CRITICAL FIX — HARD CLONE DATES
           --------------------------------------------------------
           Prevents:
           • Reload time jumps
           • Silent +5h drift
           • Mutation side-effects
        -------------------------------------------------------- */
        start: new Date(segmentStart.getTime()),
        end: new Date(segmentEnd.getTime()),

        allDay: isAllDay,
        resource: {
          parentId: r.id,
          ...r,
        },
      });

      // Move cursor forward ONE LOCAL calendar day
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  return events;
}
