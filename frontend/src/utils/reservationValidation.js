// src/utils/reservationValidation.js
// -----------------------------------------------------------------------------
// RESERVATION VALIDATION ENGINE
//
// PURPOSE:
// This file enforces ALL business rules related to reservations.
//
// It is intentionally:
// • UI-agnostic
// • Calendar-agnostic
// • Backend-parity friendly
//
// VALIDATION ≠ RENDERING
// -----------------------------------------------------------------------------
// Rendering logic lives in:
// • RoomCalendar.jsx
// • ReservationModal.jsx
//
// Validation logic lives HERE.
//
// WHY THIS MATTERS:
// • Prevents inconsistent rules across UI / backend
// • Makes recurrence and approvals safe
// • Enables future dashboard-driven rules
// -----------------------------------------------------------------------------

/* ------------------------------------------------------------------
   DATE HELPERS (PURE FUNCTIONS)
------------------------------------------------------------------ */

/**
 * Returns true if a given date falls on a weekend.
 *
 * IMPORTANT:
 * • Uses LOCAL time
 * • Pure function (no side effects)
 */
function isWeekend(date) {
  const d = new Date(date);
  const day = d.getDay(); // Sunday = 0 ... Saturday = 6
  return day === 0 || day === 6;
}

/**
 * Returns true if ANY calendar day touched by the range
 * includes a weekend.
 *
 * NOTE:
 * • Used only for strict exclusion cases
 * • Long reservations MAY span weekends unless policy forbids it
 */
function rangeTouchesWeekend(start, end) {
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  while (cur <= last) {
    if (isWeekend(cur)) return true;
    cur.setDate(cur.getDate() + 1);
  }

  return false;
}

/* ------------------------------------------------------------------
   BUSINESS HOURS VALIDATION
------------------------------------------------------------------ */

/**
 * Ensures start and end times fall within business hours.
 *
 * IMPORTANT:
 * • Business hours come from POLICY (never hardcoded)
 * • Date portion is irrelevant — only clock time matters
 */
function isWithinBusinessHours(start, end, businessStartHour, businessEndHour) {
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();

  const min = businessStartHour * 60;
  const max = businessEndHour * 60;

  if (startMinutes < min || startMinutes > max) return false;
  if (endMinutes < min || endMinutes > max) return false;

  return true;
}

/* ------------------------------------------------------------------
   MAIN VALIDATION FUNCTION
------------------------------------------------------------------ */
/**
 * Validates a reservation date range against calendar policy.
 *
 * Used by:
 * • ReservationModal.jsx
 * • (Future) Backend controllers for parity
 *
 * GUARANTEES:
 * ------------------------------------------------------------------
 * • No Date mutation
 * • No timezone guessing
 * • Deterministic validation results
 */
export function validateReservationRange({
  start,
  end,
  policy,
  isRecurring,
  repeatEndDate,
}) {
  const errors = [];

  // ------------------------------------------------------------
  // BUSINESS HOURS — SINGLE SOURCE OF TRUTH
  // ------------------------------------------------------------
  const businessStartHour = policy.time.min.getHours();
  const businessEndHour = policy.time.max.getHours();

  // Defensive cloning (never mutate caller objects)
  const s = new Date(start);
  const e = new Date(end);

  /* ------------------------------------------------------------
     BASIC DATE VALIDATION
  ------------------------------------------------------------ */
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    errors.push("Start and end must be valid dates.");
    return errors;
  }

  if (s >= e) {
    errors.push("End must be after start.");
  }

  /* ------------------------------------------------------------
     WEEKEND RULES (START / END ONLY)
     ------------------------------------------------------------
     ✔ Allows long reservations spanning weekends
     ✖ Disallows starting OR ending on weekends
     ------------------------------------------------------------
     Policy-driven:
     • policy.rules.allowWeekends === false → block weekends
  ------------------------------------------------------------ */
  if (!policy.rules.allowWeekends) {
    if (isWeekend(s)) {
      errors.push("Start date cannot be on a weekend.");
    }

    if (isWeekend(e)) {
      errors.push("End date cannot be on a weekend.");
    }
  }

  /* ------------------------------------------------------------
     BUSINESS HOURS VALIDATION
  ------------------------------------------------------------ */
  if (
    !isWithinBusinessHours(
      s,
      e,
      businessStartHour,
      businessEndHour
    )
  ) {
    errors.push(
      `Reservations must be within business hours (${businessStartHour}:00–${businessEndHour}:00).`
    );
  }

  /* ------------------------------------------------------------
     RECURRENCE VALIDATION (MODEL C)
     ------------------------------------------------------------
     Rules:
     • Recurring events MUST have an end date
     • End date must be after event end
     • End date must obey weekend rules
  ------------------------------------------------------------ */
  if (isRecurring) {
    if (!repeatEndDate) {
      errors.push("Recurring events require an end date.");
    } else {
      // Use NOON local time to avoid DST / timezone rollover bugs
      const until = new Date(`${repeatEndDate}T12:00:00`);

      if (Number.isNaN(until.getTime())) {
        errors.push("Recurring end date must be a valid date.");
      } else {
        if (until <= e) {
          errors.push("Recurring end date must be after the event end.");
        }

        if (!policy.rules.allowWeekends && isWeekend(until)) {
          errors.push("Recurring end date cannot be on a weekend.");
        }
      }
    }
  }

  return errors;
}
