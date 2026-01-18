// server.js
// -----------------------------------------------------------------------------
// BACKEND ENTRY POINT
// -----------------------------------------------------------------------------
// Responsibilities:
// • Load environment variables
// • Start Express API server
// • Initialize MySQL connection retry loop (non-blocking)
// • Enable LAN access (not localhost-only)
// • Handle graceful shutdown (SIGINT, SIGTERM, SIGHUP)
// -----------------------------------------------------------------------------


// -----------------------------------------------------------------------------
// LOAD ENVIRONMENT VARIABLES EARLY
// -----------------------------------------------------------------------------
import dotenv from "dotenv";
dotenv.config();

// -----------------------------------------------------------------------------
// IMPORT EXPRESS APP
// -----------------------------------------------------------------------------
import app from "./app.js";

// -----------------------------------------------------------------------------
// IMPORT MYSQL LIFECYCLE UTILITIES
// -----------------------------------------------------------------------------
// IMPORTANT:
// • testDbConnection() handles retry logic internally
// • closeDbPool() is the ONLY safe way to shut down MySQL
// • NEVER call pool.end() directly outside mysql.js
// -----------------------------------------------------------------------------
import { testDbConnection, closeDbPool } from "./db/mysql.js";

// -----------------------------------------------------------------------------
// CONFIGURATION
// -----------------------------------------------------------------------------

// API port (default: 4000)
const PORT = process.env.PORT || 4000;

// Bind to all interfaces so the backend is reachable from:
// • localhost
// • other devices on the LAN
// • Docker / VM networks
// • future cloud hosts
const HOST = "0.0.0.0";

// -----------------------------------------------------------------------------
// DATABASE CONNECTION (NON-BLOCKING)
// -----------------------------------------------------------------------------
// Start MySQL readiness check WITHOUT blocking server startup.
//
// Behavior:
// • If DB is up → dbReady flips true
// • If DB is down → retries forever in background
// • API still boots so health checks & error messages work
// -----------------------------------------------------------------------------
testDbConnection().catch(() => {
  // Intentionally silent — retry loop is handled inside mysql.js
});

// -----------------------------------------------------------------------------
// START HTTP SERVER
// -----------------------------------------------------------------------------
const server = app.listen(PORT, HOST, () => {
  console.log("🚀 Backend API started");
  console.log(`📡 Listening on http://${HOST}:${PORT}`);
  console.log("🌐 LAN access enabled");
});

// -----------------------------------------------------------------------------
// GRACEFUL SHUTDOWN (SINGLE CONTROLLED PATH)
// -----------------------------------------------------------------------------
// WHY THIS EXISTS:
// • Prevents MySQL race conditions on Ctrl+C
// • Prevents retry loop from resurrecting closed pools
// • Ensures clean exit for:
//     - Ctrl+C (SIGINT)
//     - Docker stop / system shutdown (SIGTERM)
//     - Process reloads (SIGHUP)
// -----------------------------------------------------------------------------
let shuttingDown = false;

async function shutdown(signal) {
  // Prevent double execution
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);

  try {
    // 🔐 Correct MySQL shutdown (delegated to mysql.js)
    await closeDbPool();
  } catch (err) {
    console.error("❌ Error during MySQL shutdown:", err.message);
  }

  // Stop accepting new HTTP connections
  server.close(() => {
    console.log("👋 HTTP server closed");
    process.exit(0);
  });

  // Failsafe: force exit if something hangs
  setTimeout(() => {
    console.warn("⚠️ Force exiting after timeout");
    process.exit(1);
  }, 10_000);
}

// -----------------------------------------------------------------------------
// REGISTER SIGNAL HANDLERS
// -----------------------------------------------------------------------------
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("SIGHUP", shutdown);
