import { Router } from "express";
import { getRoomsBySiteSlug } from "../controllers/rooms.controller.js";

const router = Router();

/**
 * GET /api/rooms/:siteSlug
 */
router.get("/:siteSlug", getRoomsBySiteSlug);

export default router;
