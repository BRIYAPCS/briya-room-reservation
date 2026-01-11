// src/utils/calendarUtils.js
// -----------------------------------------------------------------------------
// CALENDAR DATE UTILITIES
// -----------------------------------------------------------------------------
// Responsibilities:
// • Normalize dates for frontend + backend
// • Provide ICS-safe datetime formatting
// • NO timezone conversion (local wall time only)
// -----------------------------------------------------------------------------

/**
 * Convert a Date or MySQL DATETIME into ICS format
 *
 * Input:
 *   - Date object
 *   - "YYYY-MM-DD HH:MM:SS"
 *
 * Output:
 *   - "YYYYMMDDTHHMMSS"
 *
 * IMPORTANT:
 * • No trailing "Z"
 * • No timezone conversion
 */
export function formatICSDate(value) {
  if (!value) throw new Error("Invalid ICS date value");

  // Handle Date object
  if (value instanceof Date) {
    return (
      `${value.getFullYear()}` +
      `${String(value.getMonth() + 1).padStart(2, "0")}` +
      `${String(value.getDate()).padStart(2, "0")}T` +
      `${String(value.getHours()).padStart(2, "0")}` +
      `${String(value.getMinutes()).padStart(2, "0")}` +
      `${String(value.getSeconds()).padStart(2, "0")}`
    );
  }

  // Handle MySQL DATETIME string
  if (typeof value === "string") {
    return value.replace(/[-:]/g, "").replace(" ", "T");
  }

  throw new Error("Unsupported ICS date format");
}
