// server.js
// -----------------------------------------------------------------------------
// BACKEND ENTRY POINT
// -----------------------------------------------------------------------------
// Responsibilities:
// • Load environment variables
// • Start Express API server
// • Initialize MySQL connection retry loop
// • Enable LAN access (not localhost-only)
// • Handle graceful shutdown (SIGINT, SIGTERM, etc.)
// -----------------------------------------------------------------------------

// Load environment variables early
import dotenv from "dotenv";
dotenv.config();

// Import Express app
import app from "./app.js";

// Import MySQL utilities
import { testDbConnection, pool } from "./db/mysql.js";

// -----------------------------------------------------------------------------
// CONFIGURATION
// -----------------------------------------------------------------------------

// API port (default: 4000)
const PORT = process.env.PORT || 4000;

// IMPORTANT:
// Bind to 0.0.0.0 so the backend is reachable from:
// • localhost
// • other devices on the LAN (phones, tablets, kiosks)
// • Docker / VM networks
// • future cloud hosts (Linode)
const HOST = "0.0.0.0";

// -----------------------------------------------------------------------------
// DATABASE CONNECTION (NON-BLOCKING)
// -----------------------------------------------------------------------------
// Start MySQL retry loop without blocking server startup.
// This allows the API to boot even if MySQL is temporarily unavailable.

testDbConnection().catch(() => {
  // Intentionally silent — retries handled inside mysql.js
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
// GRACEFUL SHUTDOWN
// -----------------------------------------------------------------------------
// Ensures clean shutdown when:
// • Ctrl+C (SIGINT)
// • Docker stop / system shutdown (SIGTERM)
// • Process reload (SIGHUP)

async function shutdown(signal) {
  console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);

  try {
    // Close MySQL connection pool
    await pool.end();
    console.log("✅ MySQL pool closed");
  } catch (err) {
    console.error("❌ Error closing MySQL pool:", err.message);
  }

  // Close HTTP server
  server.close(() => {
    console.log("👋 HTTP server closed");
    process.exit(0);
  });
}

// Register signal handlers
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("SIGHUP", shutdown);
