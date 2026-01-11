import { Router } from "express";
import { getSites } from "../controllers/sites.controller.js";

const router = Router();

/**
 * GET /api/sites
 */
router.get("/", getSites);

export default router;
