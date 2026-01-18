// reservationValidation.js
// ------------------------------------------------------------
// RESERVATION VALIDATION ENGINE
// ------------------------------------------------------------

import { isWeekend } from "./calendarUtils.js";

function timeStringToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function isWithinBusinessHours(start, end, businessHours) {
  const min = timeStringToMinutes(businessHours.start);
  const max = timeStringToMinutes(businessHours.end);

  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();

  return (
    startMinutes >= min &&
    startMinutes <= max &&
    endMinutes >= min &&
    endMinutes <= max
  );
}

export function validateReservationRange({
  start,
  end,
  policy,
  isRecurring = false,
  repeatEndDate = null,
}) {
  const errors = [];

  const s = new Date(start);
  const e = new Date(end);

  if (Number.isNaN(s) || Number.isNaN(e)) {
    return ["Start and end must be valid dates."];
  }

  if (s >= e) {
    errors.push("End must be after start.");
  }

  if (policy.rules.disableWeekends) {
    if (isWeekend(s)) errors.push("Start date cannot be on a weekend.");
    if (isWeekend(e)) errors.push("End date cannot be on a weekend.");
  }

  if (!isWithinBusinessHours(s, e, policy.time.businessHours)) {
    errors.push(
      `Reservations must be within business hours (${policy.time.businessHours.start}–${policy.time.businessHours.end}).`
    );
  }

  if (isRecurring) {
    if (!repeatEndDate) {
      errors.push("Recurring events require an end date.");
    }
  }

  return errors;
}
