// src/data/siteService.js
// -----------------------------------------------------------------------------
// SITE DATA SERVICE
// -----------------------------------------------------------------------------
// Responsibilities:
// • Fetch site data from backend
// • Never hardcode URLs
// • Delegate error handling to apiFetch
//
// IMPORTANT:
// • Ad-blocker / privacy detection happens in apiFetch
// • UI components only receive clean errors
// -----------------------------------------------------------------------------

import { apiFetch } from "../services/api";

/**
 * ---------------------------------------------------------------------------
 * FETCH ALL SITES
 * ---------------------------------------------------------------------------
 * • Centralized API call
 * • Uses internal-safe route (/internal/sites or proxied /api/sites)
 * • Automatically resilient to:
 *   - Brave Shields
 *   - uBlock
 *   - Privacy Badger
 *   - LAN / CORS issues
 * ---------------------------------------------------------------------------
 */
export function getSites() {
  return apiFetch("/sites");
}

/**
 * ---------------------------------------------------------------------------
 * CLIENT-SIDE HELPER — GET SITE BY SLUG
 * ---------------------------------------------------------------------------
 * Used ONLY when:
 * • Sites are already loaded in memory
 * • No backend call is required
 *
 * Safe for:
 * • Rooms.jsx
 * • Calendar.jsx (breadcrumbs, headers)
 * ---------------------------------------------------------------------------
 */
export function getSiteBySlugFromList(sites, slug) {
  return sites.find((s) => s.slug === slug) || null;
}
