// src/utils/reservationDateTime.js
// -----------------------------------------------------------------------------
// DATE & TIME UTILITIES — RESERVATION SYSTEM
//
// PURPOSE:
// Centralized helpers for ALL date & time handling in the reservation flow.
//
// DESIGN GOALS:
// -----------------------------------------------------------------------------
// • Prevent timezone rollover bugs (DST / UTC issues)
// • Keep LOCAL wall-time semantics (MySQL DATETIME safe)
// • Align modal inputs with calendar grid behavior
// • Enforce slot-based time snapping (policy-driven)
//
// ARCHITECTURAL RULES:
// -----------------------------------------------------------------------------
// ❌ No UI logic
// ❌ No calendar rendering imports
// ❌ No hardcoded slot durations
//
// ✅ Slot size comes from calendarPolicy
// ✅ Safe to share between frontend & backend (future)
// -----------------------------------------------------------------------------

import { getCalendarPolicy } from "../policies/calendarPolicy";

/* ------------------------------------------------------------------
   INTERNAL HELPERS
------------------------------------------------------------------ */

/**
 * Pads a number to 2 digits.
 * Example:
 *   4  → "04"
 *   12 → "12"
 */
function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * Returns the ACTIVE slot size (minutes) from calendar policy.
 *
 * IMPORTANT:
 * • Single source of truth
 * • Allows dashboard-based changes later
 * • NEVER hardcode slot minutes anywhere else
 */
function getSlotMinutes() {
  return getCalendarPolicy().time.slotMinutes;
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
 * Used for:
 * • min= attribute on date inputs
 *
 * CRITICAL:
 * • Snaps forward to the NEXT valid slot
 * • Prevents selecting "today" with past time
 */
export function getTodayInputDate() {
  const now = snapNowToNextSlot();
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
 * GUARANTEES:
 * • Uses LOCAL time
 * • Avoids Date.parse()
 * • No UTC or timezone shifting
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
 * Clamp a Date to business hours (same day).
 *
 * Used when:
 * • Clicking outside allowed hours
 * • Auto-correcting invalid selections
 *
 * NOTE:
 * • Business hours are passed in
 * • This function does NOT decide policy
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
   SLOT-BASED TIME SNAPPING (POLICY-DRIVEN)
------------------------------------------------------------------ */

/**
 * Snap a time string ("HH:MM") to the NEAREST slot.
 *
 * Used for:
 * • START TIME inputs
 *
 * Example (slot = 30):
 *   09:04 → 09:00
 *   09:16 → 09:30
 */
export function snapTimeToNearestSlot(time) {
  if (!time) return time;

  const slotMinutes = getSlotMinutes();

  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m;

  const snapped = Math.round(total / slotMinutes) * slotMinutes;
  return minutesToHHMM(snapped);
}

/**
 * Snap a time string ("HH:MM") UP to the next slot.
 *
 * Used for:
 * • END TIME inputs
 * • Guarantees end ≥ start + slot
 *
 * Example (slot = 30):
 *   09:01 → 09:30
 *   09:31 → 10:00
 */
export function snapTimeUpToSlot(time) {
  if (!time) return time;

  const slotMinutes = getSlotMinutes();

  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m;

  const snapped = Math.ceil(total / slotMinutes) * slotMinutes;
  return minutesToHHMM(snapped);
}

/**
 * Snap "now" FORWARD to the next valid slot.
 *
 * CRITICAL:
 * • Prevents second-level race conditions
 * • Ensures "today + now" is always valid
 * • EXACTLY matches calendar grid
 */
export function snapNowToNextSlot() {
  const slotMinutes = getSlotMinutes();

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

/**
 * Convert minutes → "HH:MM"
 *
 * INTERNAL USE ONLY
 */
function minutesToHHMM(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${pad2(hours)}:${pad2(minutes)}`;
}

/* ------------------------------------------------------------------
   TIME SLOT GENERATOR (FOR DROPDOWNS)
------------------------------------------------------------------ */

/**
 * Generate time slots between business hours.
 *
 * Example:
 *   08:00 → 22:00 (slot = 30)
 *   ["08:00", "08:30", "09:00", ...]
 *
 * Used by:
 * • Reservation modal dropdowns
 *
 * GUARANTEE:
 * • Slots ALWAYS align with calendar grid
 */
export function generateTimeSlots(minTime, maxTime) {
  const slotMinutes = getSlotMinutes();
  const slots = [];

  const startMinutes = minTime.getHours() * 60 + minTime.getMinutes();
  const endMinutes = maxTime.getHours() * 60 + maxTime.getMinutes();

  for (let m = startMinutes; m <= endMinutes; m += slotMinutes) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    slots.push(`${pad2(h)}:${pad2(mm)}`);
  }

  return slots;
}

/* ------------------------------------------------------------------
   DISPLAY HELPERS (UI ONLY)
------------------------------------------------------------------ */

/**
 * Convert "HH:MM" → "h:MM AM/PM"
 *
 * UI-only helper.
 * Does NOT affect stored values or validation.
 */
export function formatTime12h(time) {
  if (!time) return "";

  const [h, m] = time.split(":").map(Number);
  const hour12 = ((h + 11) % 12) + 1;
  const suffix = h >= 12 ? "PM" : "AM";

  return `${hour12}:${pad2(m)} ${suffix}`;
}

/* ------------------------------------------------------------------
   MYSQL DATETIME BUILDER (TIMEZONE-SAFE)
------------------------------------------------------------------ */
/**
 * Convert a LOCAL Date object → MySQL DATETIME string.
 *
 * PURPOSE:
 * • Preserve exact wall-clock time
 * • Avoid UTC shifting
 *
 * Output format:
 * • "YYYY-MM-DD HH:MM:SS"
 */
export function toMySQLDateTime(date) {
  const yyyy = date.getFullYear();
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());

  const hh = pad2(date.getHours());
  const min = pad2(date.getMinutes());
  const ss = "00";

  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}
