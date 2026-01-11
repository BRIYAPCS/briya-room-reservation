// src/utils/reservationValidation.js
// ------------------------------------------------------------
// Reservation validation rules
//
// Enforces:
// • Weekend rules (rule-driven)
// • Business hours
// • Valid date ranges
// • Recurrence safety (Model C)
//
// IMPORTANT:
// • Validation ≠ rendering
// • Long reservations MAY span weekends
// • Start / End dates must obey weekend rules
// ------------------------------------------------------------

import { IS_WEEKENDS_ENABLED } from "./calendarUtils";

/** Sunday = 0 ... Saturday = 6 */
function isWeekend(date) {
  const d = new Date(date);
  const day = d.getDay();
  return day === 0 || day === 6;
}

/**
 * True if ANY date touched by the range is a weekend
 * (used only when full exclusion is required)
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

/**
 * Business hours validator
 * - Start time must be within business hours
 * - End time must be within business hours
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

/**
 * MAIN VALIDATION FUNCTION
 * Used by:
 * • ReservationModal.jsx
 * • Backend controllers (future parity)
 */
export function validateReservationRange({
  start,
  end,
  businessStartHour,
  businessEndHour,

  // Recurrence (Model C – optional)
  isRecurring = false,
  repeatEndDate = null,
}) {
  const errors = [];

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
     ✔ Allows long reservations across weekends
     ✖ Disallows starting or ending on weekends
  ------------------------------------------------------------ */
  if (!IS_WEEKENDS_ENABLED) {
    if (isWeekend(s)) {
      errors.push("Start date cannot be on a weekend.");
    }

    if (isWeekend(e)) {
      errors.push("End date cannot be on a weekend.");
    }
  }

  /* ------------------------------------------------------------
     BUSINESS HOURS
  ------------------------------------------------------------ */
  if (!isWithinBusinessHours(s, e, businessStartHour, businessEndHour)) {
    errors.push(
      `Reservations must be within business hours (${businessStartHour}:00–${businessEndHour}:00).`
    );
  }

  /* ------------------------------------------------------------
     RECURRENCE VALIDATION (MODEL C)
     ------------------------------------------------------------
     • Requires end date
     • Must be after event end
     • Must obey weekend rules
  ------------------------------------------------------------ */
  if (isRecurring) {
    if (!repeatEndDate) {
      errors.push("Recurring events require an end date.");
    } else {
      const until = new Date(repeatEndDate);

      if (Number.isNaN(until.getTime())) {
        errors.push("Recurring end date must be a valid date.");
      } else {
        if (until <= e) {
          errors.push("Recurring end date must be after the event end.");
        }

        if (!IS_WEEKENDS_ENABLED && isWeekend(until)) {
          errors.push("Recurring end date cannot be on a weekend.");
        }
      }
    }
  }

  return errors;
}
