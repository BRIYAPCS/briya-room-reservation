// calendarPolicy.adapter.js
import * as core from "@briya/calendar-core";

// ✅ re-export helpers (browser-safe)
export const isWeekend = core.isWeekend;
export const validateReservationRange = core.validateReservationRange;

// ✅ policy adapter
export function getCalendarPolicy() {
  const policy = core.getCalendarPolicy();

  function timeStringToDate(timeStr) {
    const [h, m] = timeStr.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }

  return {
    ...policy,
    time: {
      ...policy.time,
      min: timeStringToDate(policy.time.businessHours.start),
      max: timeStringToDate(policy.time.businessHours.end),
    },
  };
}
