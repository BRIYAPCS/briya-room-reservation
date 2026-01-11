// src/utils/buildICS.js
// -----------------------------------------------------------------------------
// ICS (iCalendar) GENERATOR
// -----------------------------------------------------------------------------
// Responsibilities:
// • Generate RFC 5545–compliant ICS content
// • Support CREATE / UPDATE / CANCEL semantics
// • Work in Outlook, Google Calendar, Apple Calendar
// • Use LOCAL wall time (NO timezone conversion)
// -----------------------------------------------------------------------------
//
// IMPORTANT DESIGN NOTES:
// • DTSTART / DTEND are sent WITHOUT "Z" (local wall time)
// • UID must be STABLE per reservation
// • METHOD determines client behavior:
//   - REQUEST → create/update
//   - CANCEL  → remove event
// -----------------------------------------------------------------------------

import { formatICSDate } from "./calendarUtils.js";

/* ------------------------------------------------------------------
   Escape text fields for ICS safety
   ------------------------------------------------------------------
   Required by RFC 5545 to prevent malformed calendars
------------------------------------------------------------------ */
function escapeICS(text = "") {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/**
 * Build ICS file content
 *
 * @param {Object} params
 * @param {"REQUEST"|"CANCEL"} params.method
 * @param {Object} params.reservation
 * @param {string[]} [params.attendees]
 */
export function buildICS({ method = "REQUEST", reservation, attendees = [] }) {
  const {
    id,
    title,
    description,
    email,
    start_time,
    end_time,
    room_name_snapshot,
    site_name_snapshot,
  } = reservation;

  // ------------------------------------------------------------------
  // STABLE EVENT UID (⚠️ NEVER CHANGE THIS FORMAT)
  // ------------------------------------------------------------------
  // Google / Outlook rely on UID to match updates & cancellations
  const uid = `reservation-${id}@briya.org`;

  const dtStart = formatICSDate(start_time);
  const dtEnd = formatICSDate(end_time);
  const dtStamp = formatICSDate(new Date());

  const summary = escapeICS(title || "Room Reservation");
  const location = escapeICS(`${site_name_snapshot} - ${room_name_snapshot}`);
  const desc = escapeICS(description || "");

  // ------------------------------------------------------------------
  // ATTENDEES
  // ------------------------------------------------------------------
  const attendeeLines = attendees
    .map((addr) => `ATTENDEE;CN=${escapeICS(addr)};RSVP=TRUE:MAILTO:${addr}`)
    .join("\r\n");

  // ------------------------------------------------------------------
  // ORGANIZER (PRIMARY EMAIL)
  // ------------------------------------------------------------------
  const organizerLine = email ? `ORGANIZER;CN=Organizer:MAILTO:${email}` : "";

  // ------------------------------------------------------------------
  // BUILD ICS CONTENT
  // ------------------------------------------------------------------
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Briya//Room Reservations//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${desc}`,
    `LOCATION:${location}`,
    organizerLine,
    attendeeLines,
    method === "CANCEL" ? "STATUS:CANCELLED" : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}
