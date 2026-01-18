// src/services/api.js
// -----------------------------------------------------------------------------
// CENTRAL API UTILITIES
//
// Responsibilities:
// • Base API URL resolution
// • Safe fetch wrapper
// • Browser privacy / ad-blocker detection
// • Backend warmup detection
//
// IMPORTANT:
// • This file MUST NOT contain JSX
// • This file NEVER shows UI
// • It only THROWS errors with meaningful messages
// -----------------------------------------------------------------------------

export const API_BASE = import.meta.env.VITE_API_BASE || "/internal";

/**
 * SAFE FETCH
 * ---------------------------------------------------------------------------
 * Wraps native fetch with:
 * • Privacy / ad-blocker detection
 * • Backend warmup detection
 * • Consistent error messages
 *
 * UI LAYER (Home.jsx, etc.) decides HOW to display these messages.
 */
export async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...options,
    });

    // -----------------------------------------------------------------------
    // BACKEND RESPONDED BUT NOT OK
    // -----------------------------------------------------------------------
    if (!res.ok) {
      const text = await res.text();

      // Normalize common backend states
      if (
        res.status === 503 ||
        text.includes("Service unavailable") ||
        text.includes("warming")
      ) {
        throw new Error("Service unavailable");
      }

      throw new Error(text || "Server error");
    }

    return await res.json();
  } catch (err) {
    // -----------------------------------------------------------------------
    // BROWSER / NETWORK LEVEL FAILURES
    // -----------------------------------------------------------------------
    // These NEVER reach the backend
    // Common with:
    // • Brave Shields
    // • uBlock
    // • Firefox strict mode
    // • Safari privacy protection
    // -----------------------------------------------------------------------
    if (
      err.message.includes("Failed to fetch") ||
      err.message.includes("blocked") ||
      err.message.includes("NetworkError") ||
      err.message.includes("ERR_CONNECTION_REFUSED")
    ) {
      throw new Error(
        "blocked"
      );
    }

    // Bubble up normalized error
    throw err;
  }
}
