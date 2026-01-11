import { Router } from "express";
import {
  getRoomsBySiteSlug,
  getRoomById,
} from "../controllers/rooms.controller.js";

const router = Router();

/**
 * ROOMS ROUTES
 * ---------------------------------------------------------------------------
 * Base path: /api/rooms
 *
 * Route order matters:
 * - More specific routes MUST come first
 * - Prevents :siteSlug from swallowing :roomId
 * ---------------------------------------------------------------------------
 */

/**
 * GET /api/rooms/:siteSlug/:roomId
 * Example:
 *   /api/rooms/fort-totten/12
 *
 * Returns a single room (used by Calendar page)
 */
router.get("/:siteSlug/:roomId", getRoomById);

/**
 * GET /api/rooms/:siteSlug
 * Example:
 *   /api/rooms/fort-totten
 *
 * Returns all rooms for a site (used by Rooms page)
 */
router.get("/:siteSlug", getRoomsBySiteSlug);

export default router;
