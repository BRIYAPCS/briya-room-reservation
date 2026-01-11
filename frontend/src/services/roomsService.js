// roomsService.js
// -----------------------------------------------------------------------------
// ROOMS API SERVICE
// -----------------------------------------------------------------------------
// Responsible ONLY for communicating with the backend rooms API.
// Includes lightweight caching + preloading helpers.
// -----------------------------------------------------------------------------

import { API_BASE } from "../services/api";

// -----------------------------------------------------------------------------
// In-memory cache (lives for the browser session)
// -----------------------------------------------------------------------------
const roomCache = new Map();

/**
 * Fetch ALL rooms for a site (Rooms page)
 * GET /api/rooms/:siteSlug
 */
export async function getRoomsBySiteSlug(siteSlug) {
  const res = await fetch(`${API_BASE}/rooms/${siteSlug}`);

  if (!res.ok) {
    throw new Error("Failed to fetch rooms");
  }

  return res.json();
}

/**
 * Fetch a SINGLE room (Calendar page)
 * GET /api/rooms/:siteSlug/:roomId
 */
export async function getRoomById(siteSlug, roomId) {
  if (!siteSlug || !roomId) {
    throw new Error("Invalid room parameters");
  }

  const cacheKey = `${siteSlug}:${roomId}`;

  // ✅ Return cached value if available
  if (roomCache.has(cacheKey)) {
    return roomCache.get(cacheKey);
  }

  const res = await fetch(`${API_BASE}/rooms/${siteSlug}/${roomId}`);

  if (!res.ok) {
    throw new Error("Room not found");
  }

  const data = await res.json();

  // Cache result for instant future access
  roomCache.set(cacheKey, data);

  return data;
}

/**
 * 🔹 PRELOAD helper (non-blocking, fire-and-forget)
 * Used by Cards.jsx on hover / touch
 */
export function preloadRoom(siteSlug, roomId) {
  if (!siteSlug || !roomId) return;

  getRoomById(siteSlug, roomId).catch(() => {
    // Intentionally ignore errors during preload
  });
}
