// routes/reservations.routes.js
// -----------------------------------------------------------------------------
// RESERVATIONS ROUTES
// Base path: /api/reservations
//
// Responsibilities:
// • Define HTTP routes for reservation operations
// • Delegate logic to reservations.controller.js
// • Keep routing layer thin and predictable
//
// IMPORTANT DESIGN NOTES:
// • This file contains NO business logic
// • All validation and DB work lives in the controller
// • Safe to extend later (permissions, approvals, recurrence)
// -----------------------------------------------------------------------------

import { Router } from "express";

/**
 * Controllers
 * ---------------------------------------------------------------------------
 * Each controller function handles a single responsibility:
 *
 * • getReservationsByRoom   → READ (calendar display)
 * • createReservation       → CREATE (modal-based reservation creation)
 * • updateReservationTime   → UPDATE (drag & resize + modal edit)
 */
import {
  getReservationsByRoom,
  updateReservationTime,
  createReservation, // ✅ NEW (modal-based creation)
} from "../controllers/reservations.controller.js";

const router = Router();

/**
 * -----------------------------------------------------------------------------
 * GET /api/reservations/:siteSlug/:roomId
 * -----------------------------------------------------------------------------
 * Returns all reservations for a specific room at a specific site.
 *
 * Used by:
 * • Calendar.jsx → RoomCalendar.jsx
 *
 * Example:
 * • /api/reservations/fort-totten/101
 * -----------------------------------------------------------------------------
 */
router.get("/:siteSlug/:roomId", getReservationsByRoom);

/**
 * -----------------------------------------------------------------------------
 * POST /api/reservations
 * -----------------------------------------------------------------------------
 * Creates a new reservation.
 *
 * Used by:
 * • ReservationModal.jsx (Create Reservation flow)
 *
 * Payload (minimum required fields):
 * {
 *   site_id: number,
 *   room_id: number,
 *   created_by_name: string,
 *   start_time: Date | ISO string,
 *   end_time:   Date | ISO string
 * }
 *
 * Notes:
 * • Used ONLY for creation (never for drag & drop)
 * • Ownership, permissions, and approvals can be added later
 * • Backend validates date ranges and site/room integrity
 * -----------------------------------------------------------------------------
 */
router.post("/", createReservation); // ✅ NEW

/**
 * -----------------------------------------------------------------------------
 * PUT /api/reservations/:id
 * -----------------------------------------------------------------------------
 * Updates the time range of an existing reservation.
 *
 * Used by:
 * • Drag & drop
 * • Resize operations in React Big Calendar
 * • ReservationModal.jsx (Edit Reservation flow)
 *
 * Payload:
 * {
 *   start_time: Date | ISO string,
 *   end_time:   Date | ISO string
 * }
 *
 * Notes:
 * • Only updates time-related fields
 * • Does NOT change site, room, or ownership
 * • Keeps drag & resize behavior stable
 * • Safe for incremental rollout
 * -----------------------------------------------------------------------------
 */
router.put("/:id", updateReservationTime);

export default router;
