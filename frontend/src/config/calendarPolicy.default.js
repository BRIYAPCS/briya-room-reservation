// src/config/calendarPolicy.default.js
// -----------------------------------------------------------------------------
// DEFAULT CALENDAR POLICY (STATIC FALLBACK)
//
// PURPOSE:
// • Single source of truth for ALL calendar behavior
// • Used when no dynamic policy is loaded (frontend-only safe)
// • Shape is consumed directly by:
//   - RoomCalendar.jsx
//   - ReservationModal.jsx
//   - reservationValidation.js
//
// CRITICAL DESIGN RULES:
// • time.min / time.max MUST be Date objects
// • NEVER store business hours as strings
// • UI may DERIVE strings, but policy stays canonical
// -----------------------------------------------------------------------------

export const DEFAULT_CALENDAR_POLICY = Object.freeze({
  /* ===========================================================================
     FEATURE FLAGS
     =========================================================================== */
  features: {
    recurrence: true,
    pinRequired: true,
    dragAndDrop: true,
  },

  /* ===========================================================================
     TIME CONFIGURATION — SINGLE SOURCE OF TRUTH
     ---------------------------------------------------------------------------
     IMPORTANT:
     • min / max are Date objects (required by React Big Calendar)
     • Date portion is irrelevant — ONLY the clock time is used
     • 1970-01-01 is a stable, timezone-safe anchor
     =========================================================================== */
  time: {
    // BUSINESS HOURS (LOCAL WALL TIME)
    min: new Date(1970, 0, 1, 8, 0, 0),   // 08:00 AM
    max: new Date(1970, 0, 1, 18, 0, 0),  // 06:00 PM

    // SLOT SIZE (minutes)
    slotMinutes: 15,
  },

  /* ===========================================================================
     RULES — VALIDATION & INTERACTION
     =========================================================================== */
  rules: {
    // WEEKEND BEHAVIOR
    // true  → weekends disabled (no create / edit / drag)
    // false → weekends allowed
    disableWeekends: true,

    // MULTI-DAY RESERVATIONS
    allowMultiDay: true,

    // PAST DATES (CREATE MODE)
    allowPastDates: false,
  },

  /* ===========================================================================
     UI PREFERENCES (NON-AUTHORITATIVE)
     ---------------------------------------------------------------------------
     NOTE:
     • UI values may be strings
     • They NEVER drive validation or backend logic
     =========================================================================== */
  ui: {
    showAllDayRow: false,

    // Used only for calendar initial scroll position
    // (converted to Date internally where needed)
    scrollToTime: "08:00",

    defaultView: "week",
  },
});
