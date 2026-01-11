// src/utils/reservationDateTime.js
// ------------------------------------------------------------
// Date & time helpers for the Reservation system.
//
// Goals:
// • Keep all date/time logic centralized
// • Avoid timezone rollover bugs (DST / UTC issues)
// • Align modal inputs with calendar behavior
// • Provide slot-based time snapping (30-min default)
//
// NOTE:
// • No external date libraries
// • No calendar imports (prevents circular deps)
// ------------------------------------------------------------

/* ------------------------------------------------------------------
   INTERNAL HELPERS
------------------------------------------------------------------ */

/** Pads a number to 2 digits (e.g., 4 → "04") */
function pad2(n) {
  return String(n).padStart(2, "0");
}

/* ------------------------------------------------------------------
   DATE HELPERS (INPUT-SAFE, TIMEZONE-SAFE)
------------------------------------------------------------------ */

/**
 * Convert a Date → "YYYY-MM-DD"
 * ------------------------------------------------------------
 * • SAFE for <input type="date">
 * • Uses LOCAL calendar date
 * • Prevents UTC rollover bugs
 */
export function toInputDate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Returns TODAY in "YYYY-MM-DD" (LOCAL TIME)
 * ------------------------------------------------------------
 * • Used for min= on date inputs
 * • Snaps to next valid slot to avoid "past time" bugs
 */
export function getTodayInputDate(slotMinutes = 30) {
  const now = snapNowToNextSlot(slotMinutes);
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(
    now.getDate()
  )}`;
}

/* ------------------------------------------------------------------
   TIME HELPERS (INPUT-SAFE)
------------------------------------------------------------------ */

/**
 * Convert a Date → "HH:MM" (24h format)
 * ------------------------------------------------------------
 * Used for <input type="time">
 */
export function toInputTime(date) {
  const d = new Date(date);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Combine date string + time string into a Date
 * ------------------------------------------------------------
 * @param dateStr "YYYY-MM-DD"
 * @param timeStr "HH:MM"
 *
 * • Uses LOCAL time
 * • Avoids Date.parse (no UTC shifts)
 */
export function combineDateAndTime(dateStr, timeStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

/* ------------------------------------------------------------------
   BUSINESS HOURS UTIL
------------------------------------------------------------------ */

/**
 * Clamp a Date to business hours (same day)
 * ------------------------------------------------------------
 * Used when:
 * • Clicking outside allowed hours
 * • Auto-correcting invalid selections
 */
export function clampToBusinessHours(date, startHour, endHour) {
  const d = new Date(date);
  const minutes = d.getHours() * 60 + d.getMinutes();
  const min = startHour * 60;
  const max = endHour * 60;

  if (minutes < min) {
    d.setHours(startHour, 0, 0, 0);
  } else if (minutes > max) {
    d.setHours(endHour, 0, 0, 0);
  }

  return d;
}

/* ------------------------------------------------------------------
   SLOT-BASED TIME SNAPPING
------------------------------------------------------------------ */

/**
 * Snap a time string ("HH:MM") to the NEAREST slot
 * ------------------------------------------------------------
 * Used for:
 * • START TIME inputs
 *
 * Example (30-min):
 *   09:04 → 09:00
 *   09:16 → 09:30
 */
export function snapTimeToNearestSlot(time, slotMinutes = 30) {
  if (!time) return time;

  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m;

  const snapped = Math.round(total / slotMinutes) * slotMinutes;
  return minutesToHHMM(snapped);
}

/**
 * Snap a time string ("HH:MM") UP to next slot
 * ------------------------------------------------------------
 * Used for:
 * • END TIME inputs
 * • Guarantees end ≥ start + slot
 *
 * Example (30-min):
 *   09:01 → 09:30
 *   09:31 → 10:00
 */
export function snapTimeUpToSlot(time, slotMinutes = 30) {
  if (!time) return time;

  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m;

  const snapped = Math.ceil(total / slotMinutes) * slotMinutes;
  return minutesToHHMM(snapped);
}

/**
 * Snap "now" FORWARD to the next valid slot
 * ------------------------------------------------------------
 * CRITICAL:
 * • Prevents second-level race conditions
 * • Ensures "today + now" is always valid
 * • Matches calendar grid exactly
 */
export function snapNowToNextSlot(slotMinutes = 30) {
  const now = new Date();
  const totalMinutes = now.getHours() * 60 + now.getMinutes();

  const snappedMinutes = Math.ceil(totalMinutes / slotMinutes) * slotMinutes;

  const hours = Math.floor(snappedMinutes / 60);
  const minutes = snappedMinutes % 60;

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours,
    minutes,
    0,
    0
  );
}

/* ------------------------------------------------------------------
   INTERNAL FORMATTER
------------------------------------------------------------------ */

/** Convert minutes → "HH:MM" */
function minutesToHHMM(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;

  return `${pad2(hours)}:${pad2(minutes)}`;
}

/* ------------------------------------------------------------------
   TIME SLOT GENERATOR (FOR DROPDOWNS)
------------------------------------------------------------------ */

/**
 * Generate time slots between business hours
 * ------------------------------------------------------------
 * Example (08:00 → 22:00, 30 min):
 * ["08:00", "08:30", "09:00", ...]
 *
 * Used by:
 * • Reservation modal dropdowns
 * • Guarantees alignment with calendar grid
 */
export function generateTimeSlots(minTime, maxTime, slotMinutes = 30) {
  const slots = [];

  const startMinutes = minTime.getHours() * 60 + minTime.getMinutes();
  const endMinutes = maxTime.getHours() * 60 + maxTime.getMinutes();

  for (let m = startMinutes; m <= endMinutes; m += slotMinutes) {
    const h = Math.floor(m / 60);
    const mm = m % 60;

    slots.push(`${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
  }

  return slots;
}

/* ------------------------------------------------------------------
   DISPLAY HELPERS (UI ONLY)
------------------------------------------------------------------ */

/**
 * Convert "HH:MM" → "h:MM AM/PM"
 * ------------------------------------------------------------
 * UI-only helper
 * Does NOT affect stored values or logic
 */
export function formatTime12h(time) {
  if (!time) return "";

  const [h, m] = time.split(":").map(Number);
  const hour12 = ((h + 11) % 12) + 1;
  const suffix = h >= 12 ? "PM" : "AM";

  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/* ------------------------------------------------------------------
   MYSQL DATETIME BUILDER (TIMEZONE-SAFE)
   ------------------------------------------------------------------
   Purpose:
   • Convert a LOCAL Date object into a MySQL DATETIME string
   • WITHOUT timezone shifting
   • Preserves the exact wall-clock time selected by the user

   Output:
   • "YYYY-MM-DD HH:MM:SS"
------------------------------------------------------------------ */
export function toMySQLDateTime(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const ss = "00";

  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}
