// calendarUtils.js
// -----------------------------------------------------------------------------
// CALENDAR ENGINE — RULES & TRANSFORMATIONS
//
// PURPOSE:
// This file is the **calendar engine**.
// It contains all LOW-LEVEL logic related to:
//
// • Parsing backend datetimes safely (NO timezone drift)
// • Transforming reservations into Big React Calendar events
// • Visually splitting events when weekends are disabled
// • Deriving business hours (READ-ONLY)
//
// IMPORTANT ARCHITECTURAL RULES:
// -----------------------------------------------------------------------------
// ❌ NO feature flags defined here
// ❌ NO hardcoded calendar configuration
// ❌ NO UI decisions (views, buttons, modals)
//
// ✅ ALL behavior toggles come from calendarPolicy
// ✅ ALL Date math is LOCAL wall-time
// ✅ ALL Date objects passed to the calendar are CLONED
//
// WHY THIS FILE EXISTS:
// -----------------------------------------------------------------------------
// • Prevents timezone bugs (UTC drift, +5h jumps, DST issues)
// • Guarantees drag & drop stability
// • Keeps Month / Week / Day views consistent
// • Makes future features (recurrence, dashboards, holidays) SAFE
// -----------------------------------------------------------------------------

import { getCalendarPolicy } from "../policies/calendarPolicy";

/**
 * ⚠️ CRITICAL WARNING — DO NOT IGNORE
 * ---------------------------------------------------------------------------
 * React Big Calendar MUTATES Date objects internally.
 *
 * If you pass shared Date references:
 * ❌ Times will shift on re-render
 * ❌ Drag & drop will corrupt state
 * ❌ Events may jump hours or days
 *
 * RULE:
 * ---------------------------------------------------------------------------
 * Every Date object passed OUT of this file MUST be cloned using:
 *   new Date(date.getTime())
 *
 * Do NOT remove cloning unless you WANT production bugs.
 * ---------------------------------------------------------------------------
 */

/* ------------------------------------------------------------------
   HELPER: Detect weekend days
------------------------------------------------------------------ */
/**
 * Returns true if the given date falls on Saturday or Sunday.
 *
 * NOTE:
 * • Uses LOCAL time
 * • Safe for all calendar views
 * • Used ONLY for visual splitting (data is never mutated)
 */
export function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/* ------------------------------------------------------------------
   BACKEND DATETIME PARSER — LOCAL WALL TIME (CRITICAL)
------------------------------------------------------------------ */
/**
 * Parses backend-provided datetime values into LOCAL Date objects.
 *
 * SUPPORTED INPUTS:
 * ------------------------------------------------------------------
 * • MySQL DATETIME   → "YYYY-MM-DD HH:MM[:SS]"
 * • ISO strings     → "YYYY-MM-DDTHH:MM[:SS][.sss][Z|±offset]"
 * • JavaScript Date → cloned safely
 *
 * NON-NEGOTIABLE GUARANTEES:
 * ------------------------------------------------------------------
 * • MySQL DATETIME is treated as LOCAL wall time
 * • ISO WITH timezone is converted to LOCAL
 * • ISO WITHOUT timezone preserves wall time
 * • NO silent timezone guessing
 * • Same input ALWAYS yields same clock time
 *
 * WHY THIS MATTERS:
 * ------------------------------------------------------------------
 * Silent Date parsing is how:
 * • +5 hour shifts
 * • DST bugs
 * • “Works on my machine” issues
 * are introduced.
 *
 * This function REFUSES to guess.
 */
function parseBackendDateTime(value) {
  if (!value) return null;

  /* ------------------------------------------------------------
     CASE 1: Already a Date object
     ------------------------------------------------------------
     We CLONE via getTime() to:
     • Preserve the exact instant
     • Prevent mutation side-effects
  ------------------------------------------------------------ */
  if (value instanceof Date) {
    return new Date(value.getTime());
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
    return new Date(y, m - 1, d, hh, mm, ss ?? 0, 0);
  }

  /* ------------------------------------------------------------
     CASE 3: ISO STRING (WITH or WITHOUT timezone)
     ------------------------------------------------------------
     Examples:
     • 2025-12-31T13:00:00.000Z
     • 2025-12-31T13:00:00-05:00
     • 2025-12-31T08:00:00
  ------------------------------------------------------------ */
  const isoMatch = str.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?$/
  );

  if (isoMatch) {
    const [, y, m, d, hh, mm, ss, tz] = isoMatch;

    /* ----------------------------------------------------------
       ISO WITH timezone (Z or ±offset)
       ----------------------------------------------------------
       This is REAL time and MUST be converted to LOCAL
    ---------------------------------------------------------- */
    if (tz) {
      const date = new Date(str);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    /* ----------------------------------------------------------
       ISO WITHOUT timezone
       ----------------------------------------------------------
       Preserve wall-clock time EXACTLY as written
    ---------------------------------------------------------- */
    return new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss ?? 0),
      0
    );
  }

  /* ------------------------------------------------------------
     FAIL SAFE
     ------------------------------------------------------------
     If we cannot explicitly parse the value,
     we REFUSE to guess.
  ------------------------------------------------------------ */
  return null;
}

/* ------------------------------------------------------------------
   DERIVED BUSINESS HOURS (FROM POLICY)
------------------------------------------------------------------ */
/**
 * Returns business-hour primitives derived from calendar policy.
 *
 * IMPORTANT:
 * • This function is READ-ONLY
 * • No UI logic lives here
 * • Date portion is irrelevant — ONLY time matters
 *
 * Used by:
 * • RoomCalendar.jsx
 * • ReservationModal.jsx
 * • Validation helpers
 */
export function getBusinessHours() {
  const policy = getCalendarPolicy();

  const [startH, startM] = policy.time.businessHours.start
    .split(":")
    .map(Number);

  const [endH, endM] = policy.time.businessHours.end
    .split(":")
    .map(Number);

  return {
    // Used by Big React Calendar
    minTime: new Date(1970, 0, 1, startH, startM),
    maxTime: new Date(1970, 0, 1, endH, endM),

    // Useful primitives
    startHour: startH,
    endHour: endH,

    // UI-friendly strings
    startTimeString: policy.time.businessHours.start,
    endTimeString: policy.time.businessHours.end,
  };
}

/* ------------------------------------------------------------------
   TRANSFORM BACKEND RESERVATIONS → BIG REACT CALENDAR EVENTS
------------------------------------------------------------------ */
/**
 * Converts backend reservations into events safe for
 * React Big Calendar rendering.
 *
 * GUARANTEES:
 * ------------------------------------------------------------------
 * • NO mutation of backend data
 * • NO mutation of Date objects
 * • ALL math done in LOCAL time
 * • Stable IDs for drag & drop
 *
 * VISUAL WEEKEND HANDLING:
 * ------------------------------------------------------------------
 * • If weekends are enabled → one continuous event
 * • If weekends are disabled → event is VISUALLY split
 * • Backend data is NEVER modified
 */
export function mapReservationsToEvents(reservations = []) {
  const policy = getCalendarPolicy();
  const weekendsEnabled = !policy.rules.disableWeekends;

  const events = [];

  reservations.forEach((r) => {
    const parsedStart = parseBackendDateTime(r.start_time);
    const parsedEnd = parseBackendDateTime(r.end_time);

    // Safety guard — never render invalid dates
    if (!parsedStart || !parsedEnd) return;

    // HARD immutable base dates (never exposed)
    const baseStart = new Date(parsedStart.getTime());
    const baseEnd = new Date(parsedEnd.getTime());

    const isAllDay =
      baseStart.getHours() === 0 &&
      baseStart.getMinutes() === 0 &&
      baseEnd.getHours() === 23 &&
      baseEnd.getMinutes() === 59;

    /* ------------------------------------------------------------
       WEEKENDS ENABLED → SINGLE EVENT
    ------------------------------------------------------------ */
    if (weekendsEnabled) {
      events.push({
        id: r.id,
        title: r.title || r.created_by_name,
        start: new Date(baseStart.getTime()),
        end: new Date(baseEnd.getTime()),
        allDay: isAllDay,
        resource: r,
      });
      return;
    }

    /* ------------------------------------------------------------
       WEEKENDS DISABLED → VISUAL WEEKDAY SPLIT
    ------------------------------------------------------------ */
    let cursor = new Date(baseStart.getTime());

    while (cursor < baseEnd) {
      const dayStart = new Date(cursor.getTime());
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(cursor.getTime());
      dayEnd.setHours(23, 59, 59, 999);

      // Skip weekends entirely
      if (isWeekend(dayStart)) {
        cursor.setDate(cursor.getDate() + 1);
        continue;
      }

      // Clamp segment to reservation boundaries
      const segmentStart = new Date(
        Math.max(dayStart.getTime(), baseStart.getTime())
      );
      const segmentEnd = new Date(
        Math.min(dayEnd.getTime(), baseEnd.getTime())
      );

      // Stable LOCAL date-based ID (NO UTC)
      const yyyy = dayStart.getFullYear();
      const mm = String(dayStart.getMonth() + 1).padStart(2, "0");
      const dd = String(dayStart.getDate()).padStart(2, "0");

      events.push({
        id: `${r.id}-${yyyy}-${mm}-${dd}`,
        title: r.title || r.created_by_name,
        start: new Date(segmentStart.getTime()),
        end: new Date(segmentEnd.getTime()),
        allDay: isAllDay,
        resource: {
          parentId: r.id,
          ...r,
        },
      });

      // Move cursor forward ONE LOCAL day
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  return events;
}
