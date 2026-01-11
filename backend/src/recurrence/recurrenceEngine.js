// backend/src/recurrence/recurrenceEngine.js
// -----------------------------------------------------------------------------
// RECURRENCE EXPANSION ENGINE (MODEL C — STABLE VERSION)
// -----------------------------------------------------------------------------
// Purpose:
// • Convert ONE reservation request into MANY concrete reservation instances
// • Handle frequency, interval, exclusions, and weekend rules
//
// This file:
// ✔ Does NOT talk to the UI
// ✔ Does NOT talk to the database
// ✔ Returns clean { start, end } Date ranges only
//
// IMPORTANT DESIGN RULES:
// • "bi-weekly" is NOT a frequency — it is weekly + interval = 2
// • All recurrence logic is deterministic and timezone-safe
// • Backend remains the final authority on recurrence rules
// -----------------------------------------------------------------------------

/**
 * BACKEND RULE SWITCH (independent of frontend)
 * ---------------------------------------------------------------------------
 * If you want backend to enforce weekends off:
 *   false → skip weekend instances during recurrence generation
 *   true  → allow weekend instances
 *
 * NOTE:
 * Even if frontend allows weekends, backend should be the final authority.
 */
export const IS_WEEKENDS_ENABLED = false;

/**
 * Helper: weekend detection
 * Sunday = 0, Saturday = 6
 */
export function isWeekend(date) {
  const d = new Date(date);
  const day = d.getDay();
  return day === 0 || day === 6;
}

/* ---------------------------------------------------------------------------
   CORE GENERATOR — PUBLIC EXPORT
   ---------------------------------------------------------------------------
   Generates concrete reservation instances from a recurrence definition.

   Inputs:
   • start: Date | ISO string
   • end:   Date | ISO string
   • frequency: "daily" | "weekly" | "monthly"
   • interval: number (>= 1)
       - daily    → every N days
       - weekly   → every N weeks (bi-weekly = 2)
       - monthly  → every N months
   • until: YYYY-MM-DD or ISO string
   • excludeDates: ["YYYY-MM-DD", ...]
--------------------------------------------------------------------------- */
export function generateRecurrenceInstances({
  start,
  end,
  frequency,
  interval = 1, // defaults safely to 1
  until,
  excludeDates = [],
}) {
  const instances = [];

  // -------------------------------------------------------------------------
  // INPUT NORMALIZATION
  // -------------------------------------------------------------------------
  let cursorStart = new Date(start);
  let cursorEnd = new Date(end);
  const untilDate = new Date(until);

  if (Number.isNaN(cursorStart.getTime())) {
    throw new Error("generateRecurrenceInstances: invalid start date");
  }
  if (Number.isNaN(cursorEnd.getTime())) {
    throw new Error("generateRecurrenceInstances: invalid end date");
  }
  if (Number.isNaN(untilDate.getTime())) {
    throw new Error("generateRecurrenceInstances: invalid until date");
  }

  // Treat "until" as END OF DAY to avoid skipping last occurrence
  untilDate.setHours(23, 59, 59, 999);

  // Normalize interval defensively
  const step =
    Number.isInteger(Number(interval)) && Number(interval) >= 1
      ? Number(interval)
      : 1;

  // Normalize exclusion list for fast lookups
  const excludeSet = new Set(excludeDates);

  // -------------------------------------------------------------------------
  // GENERATION LOOP
  // -------------------------------------------------------------------------
  while (cursorStart <= untilDate) {
    /**
     * IMPORTANT:
     * We generate the dayKey using LOCAL date parts.
     * Using toISOString() here would cause UTC date drift.
     */
    const dayKey =
      cursorStart.getFullYear() +
      "-" +
      String(cursorStart.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(cursorStart.getDate()).padStart(2, "0");

    // Weekend rule
    const weekendOk = IS_WEEKENDS_ENABLED || !isWeekend(cursorStart);

    // Exclusion rule
    const excluded = excludeSet.has(dayKey);

    if (weekendOk && !excluded) {
      instances.push({
        start: new Date(cursorStart),
        end: new Date(cursorEnd),
      });
    }

    // -----------------------------------------------------------------------
    // ADVANCE CURSOR BASED ON FREQUENCY + INTERVAL
    // -----------------------------------------------------------------------
    switch (frequency) {
      case "daily":
        // Every N days
        cursorStart.setDate(cursorStart.getDate() + step);
        cursorEnd.setDate(cursorEnd.getDate() + step);
        break;

      case "weekly":
        // Every N weeks (bi-weekly = 2)
        cursorStart.setDate(cursorStart.getDate() + step * 7);
        cursorEnd.setDate(cursorEnd.getDate() + step * 7);
        break;

      case "monthly":
        // Every N months
        cursorStart.setMonth(cursorStart.getMonth() + step);
        cursorEnd.setMonth(cursorEnd.getMonth() + step);
        break;

      default:
        throw new Error(`Unsupported recurrence frequency: ${frequency}`);
    }
  }

  return instances;
}

/* ---------------------------------------------------------------------------
   BACKWARD-COMPATIBLE WRAPPER
   ---------------------------------------------------------------------------
   Allows older code paths to continue working without refactor.
--------------------------------------------------------------------------- */
export function expandRecurringReservation({ start, end, recurrence }) {
  if (!recurrence) return [{ start, end }];

  const { frequency, interval = 1, until, excludeDates = [] } = recurrence;

  return generateRecurrenceInstances({
    start,
    end,
    frequency,
    interval,
    until,
    excludeDates,
  });
}
