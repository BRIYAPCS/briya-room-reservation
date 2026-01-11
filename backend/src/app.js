// app.js
// -----------------------------------------------------------------------------
// EXPRESS APPLICATION SETUP
// -----------------------------------------------------------------------------
// Responsibilities:
// • Global middleware (JSON, CORS)
// • Security + first-party headers (ad-blocker safe)
// • Health checks
// • Internal API route mounting
// • PIN authentication (demo / device-based)
// -----------------------------------------------------------------------------

import express from "express";
import cors from "cors";

// -----------------------------------------------------------------------------
// ROUTE IMPORTS
// -----------------------------------------------------------------------------
import sitesRoutes from "./routes/sites.routes.js";
import roomsRoutes from "./routes/rooms.routes.js";
import reservationsRoutes from "./routes/reservations.routes.js";

const app = express();

// -----------------------------------------------------------------------------
// GLOBAL MIDDLEWARE
// -----------------------------------------------------------------------------

// Parse incoming JSON payloads
app.use(express.json());

// CORS — open for development
// In production, restrict origin explicitly
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// -----------------------------------------------------------------------------
// FIRST-PARTY / ANTI-BLOCKER RESPONSE HEADERS
// -----------------------------------------------------------------------------
// These headers:
// • Reduce false positives from ad-blockers
// • Improve security posture
// • Clearly identify this API as a system service
// -----------------------------------------------------------------------------
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Powered-By", "Briya-Internal-System");
  next();
});

// -----------------------------------------------------------------------------
// HEALTH CHECK (NO DATABASE DEPENDENCY)
// -----------------------------------------------------------------------------
// Used for:
// • Load balancers
// • Monitoring
// • Dev sanity checks
// -----------------------------------------------------------------------------
app.get("/internal/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "briya-room-reservations-api",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// -----------------------------------------------------------------------------
// PIN AUTHENTICATION (TEMP / DEMO / DEVICE-BASED)
// -----------------------------------------------------------------------------
// • Verifies PINs stored in .env
// • Returns a role only (no session storage)
// • Frontend stores access in localStorage
// • Intentionally simple & stateless
// -----------------------------------------------------------------------------
app.post("/internal/pin/verify", (req, res) => {
  const { pin } = req.body;

  if (!pin) {
    return res.status(400).json({ message: "PIN is required" });
  }

  if (pin === process.env.PIN_USER) {
    return res.json({ role: "user" });
  }

  if (pin === process.env.PIN_ADMIN) {
    return res.json({ role: "admin" });
  }

  if (pin === process.env.PIN_SUPER_ADMIN) {
    return res.json({ role: "super_admin" });
  }

  return res.status(401).json({ message: "Invalid PIN" });
});

// -----------------------------------------------------------------------------
// INTERNAL API ROUTES (AD-BLOCKER SAFE)
// -----------------------------------------------------------------------------
// IMPORTANT:
// • Avoid "/api/*" paths to prevent Brave / uBlock blocking
// • "/internal/*" is treated as first-party system traffic
// -----------------------------------------------------------------------------
app.use("/internal/sites", sitesRoutes);
app.use("/internal/rooms", roomsRoutes);
app.use("/internal/reservations", reservationsRoutes);

// -----------------------------------------------------------------------------
// EXPORT EXPRESS APP
// -----------------------------------------------------------------------------
export default app;
