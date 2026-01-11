// src/services/api.js
// -----------------------------------------------------------------------------
// CENTRAL API UTILITIES
// Handles:
// • Base URL resolution
// • Ad-blocker / privacy detection
// • Consistent error messages
// -----------------------------------------------------------------------------

export const API_BASE = import.meta.env.VITE_API_BASE || "/internal";

/**
 * SAFE FETCH
 * ------------------------------------------------------------
 * Wraps native fetch with:
 * • Privacy / ad-blocker detection
 * • Consistent error messages
 * • Future retry / auth handling
 */
export async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...options,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Server error");
    }

    return await res.json();
  } catch (err) {
    // Detect browser-level blocking
    if (
      err.message.includes("Failed to fetch") ||
      err.message.includes("blocked") ||
      err.message.includes("NetworkError")
    ) {
      throw new Error(
        "This browser blocked a required system request. Please disable shields or privacy protection for this site."
      );
    }

    throw err;
  }
}
