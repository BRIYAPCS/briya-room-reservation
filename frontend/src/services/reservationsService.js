// services/reservationsService.js
// -----------------------------------------------------------------------------
// RESERVATIONS API SERVICE
// -----------------------------------------------------------------------------
// Responsibilities:
// • Thin, predictable API layer for reservations
// • Centralize backend endpoints used by the calendar
//
// CRITICAL RULES:
// • MySQL DATETIME = LOCAL wall time only (NO UTC "Z")
// • Never send Date objects to the backend (defensive conversion only)
// -----------------------------------------------------------------------------

import { API_BASE } from "./api";
import { toMySQLDateTime } from "../utils/reservationDateTime";

/**
 * Fetch reservations for a specific room at a specific site
 * GET /api/reservations/:siteSlug/:roomId
 */
export async function getReservationsByRoom(siteSlug, roomId) {
  const res = await fetch(`${API_BASE}/reservations/${siteSlug}/${roomId}`);

  if (!res.ok) {
    throw new Error("Failed to load reservations");
  }

  const data = await res.json();

  // DEBUG — RAW BACKEND PAYLOAD
  console.group("📦 BACKEND RAW RESPONSE");
  data.forEach((r) => {
    console.log(
      "id:",
      r.id,
      "start_time:",
      r.start_time,
      "type:",
      typeof r.start_time
    );
  });
  console.groupEnd();

  return data;
}

/**
 * CREATE reservation
 * POST /api/reservations
 */
export async function createReservation(payload) {
  const res = await fetch(`${API_BASE}/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || "Failed to create reservation");
  }

  return res.json();
}

/**
 * EDIT SINGLE vs EDIT SERIES (future-safe hook)
 * For now we ONLY allow "single".
 */
export const EDIT_SCOPE = {
  SINGLE: "single",
  SERIES: "series",
};

/**
 * Build a safe PUT payload that matches backend UPDATE whitelist EXACTLY.
 *
 * Backend editable whitelist (current):
 * • start_time
 * • end_time
 * • title
 * • description
 * • created_by_name
 * • email
 * • attendees_emails
 *
 * Future-safe:
 * • edit_scope: "single" | "series" (series rejected for now)
 */
function buildPutPayload(input = {}) {
  // Defensive Date → MySQL DATETIME (LOCAL wall time).
  // Callers should already send strings; this is just a safety net.
  const normalizeDateTime = (v) => {
    if (!v) return v;
    if (v instanceof Date) return toMySQLDateTime(v); // ✅ local wall time string
    return v;
  };

  const payload = {
    // --- editable fields (exact names the backend expects) ---
    start_time: normalizeDateTime(input.start_time),
    end_time: normalizeDateTime(input.end_time),

    title: input.title,
    description: input.description,
    created_by_name: input.created_by_name,
    email: input.email,
    attendees_emails: input.attendees_emails,

    // --- future-safe hook (backend guard can reject "series" for now) ---
    edit_scope: input.edit_scope || EDIT_SCOPE.SINGLE,
  };

  // Strip undefined ONLY (keep nulls, because null is a meaningful "clear field")
  Object.keys(payload).forEach((k) => {
    if (payload[k] === undefined) delete payload[k];
  });

  return payload;
}

/**
 * UPDATE reservation (single-instance only)
 * PUT /api/reservations/:id
 *
 * SAFETY RULES:
 * • id MUST be numeric DB ID
 * • Payload MUST match backend whitelist
 * • start_time/end_time MUST be MySQL DATETIME strings (LOCAL wall time)
 */
export async function updateReservation(id, inputPayload) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) {
    throw new Error("updateReservation called with invalid reservation id");
  }

  const safePayload = buildPutPayload(inputPayload);

  const res = await fetch(`${API_BASE}/reservations/${numericId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(safePayload),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || "Failed to update reservation");
  }

  return res.json();
}
