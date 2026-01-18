// src/policies/calendarPolicy.js
// -----------------------------------------------------------------------------
// CALENDAR POLICY RESOLVER
//
// Responsibility:
// • Provide the ACTIVE calendar policy
// • Today: returns static default
// • Tomorrow: merges backend + overrides
//
// RULES:
// ❌ UI must NEVER import from config/
// ✅ UI imports ONLY from this file
// -----------------------------------------------------------------------------

import { DEFAULT_CALENDAR_POLICY } from "../config/calendarPolicy.default";

// Runtime policy (future: loaded from API / dashboard)
let runtimePolicy = null;

export function setCalendarPolicy(policy) {
  runtimePolicy = policy;
}

export function getCalendarPolicy() {
  return runtimePolicy ?? DEFAULT_CALENDAR_POLICY;
}
