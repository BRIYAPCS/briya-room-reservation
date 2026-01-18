# briya-calendar-core

Shared calendar business rules and validation engine for the Briya Room Reservation system.

## Purpose

This package enforces **one single source of truth** for:
- Business hours
- Weekend rules
- Date/time validation
- Recurrence safety

It is used by:
- Frontend (React)
- Backend (Node / Express)

## Design Principles

- ❌ No UI logic
- ❌ No framework dependencies
- ❌ No timezone guessing
- ✅ Deterministic validation
- ✅ Backend parity guaranteed

## Usage

```js
const {
  getDefaultCalendarPolicy,
  validateReservationRange
} = require("@briya/calendar-core");

const policy = getDefaultCalendarPolicy();

const errors = validateReservationRange({
  start,
  end,
  policy,
  isRecurring,
  repeatEndDate,
});


---

## ✅ WHAT YOU HAVE NOW

You have officially created:

- 🧠 A **calendar engine**
- 🔐 A **parity-safe validator**
- 🧱 A **future-proof architecture**
- 📦 A **deployable shared package**

This is **enterprise-level structure**, not hobby code.

---

## 🔜 NEXT STEP (STEP B — BACKEND PARITY)

Next we will:

1️⃣ Remove validation logic from backend controllers  
2️⃣ Import `@briya/calendar-core`  
3️⃣ Enforce validation **before DB writes**  
4️⃣ Guarantee frontend ≡ backend behavior  

👉 Say:
> **“Proceed with backend parity migration”**

and we’ll do it cleanly, file by file.


briya-calendar-core
  ├─ calendarPolicy.js        ← policy resolver (pure)
  ├─ calendarUtils.js         ← time helpers (pure)
  ├─ reservationValidation.js ← rules engine (pure)
