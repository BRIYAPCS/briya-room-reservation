// backend/src/db/mysql.js
// -----------------------------------------------------------------------------
// Centralized MySQL connection layer with resilient auto-recovery
//
// Responsibilities:
// • Maintain a shared MySQL pool
// • Retry connection automatically in background
// • Expose `dbReady` flag for controllers
// • Log ONLY meaningful connection state changes
// • Never crash the backend due to DB outages
// -----------------------------------------------------------------------------

import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------
const RETRY_DELAY_MS = 5000;

// -----------------------------------------------------------------------------
// DB readiness flag (imported by controllers)
// -----------------------------------------------------------------------------
export let dbReady = false;

// -----------------------------------------------------------------------------
// Internal state (NOT exported)
// -----------------------------------------------------------------------------
let pool = null;

// Tracks LAST known connection state to avoid log spam
// Possible values: "UP" | "DOWN"
let lastConnectionState = "DOWN";

// -----------------------------------------------------------------------------
// Create (or recreate) MySQL pool
// -----------------------------------------------------------------------------
function createPool() {
  pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
}

// Create initial pool immediately on startup
createPool();

// -----------------------------------------------------------------------------
// Expose pool for controllers
// -----------------------------------------------------------------------------
export { pool };

// -----------------------------------------------------------------------------
// Test DB connection with auto-retry (NON-BLOCKING)
// -----------------------------------------------------------------------------
// This function:
// • Tries to connect
// • Updates dbReady flag
// • Logs ONLY on state transitions (UP ↔ DOWN)
// • Reattempts connection forever in background
// -----------------------------------------------------------------------------
export async function testDbConnection() {
  try {
    const connection = await pool.getConnection();
    connection.release();

    dbReady = true;

    // 🔔 Log ONLY when transitioning from DOWN → UP
    if (lastConnectionState !== "UP") {
      console.log("✅ MySQL connected / reconnected successfully");
      lastConnectionState = "UP";
    }
  } catch (err) {
    dbReady = false;

    // 🔔 Log ONLY when transitioning from UP → DOWN
    if (lastConnectionState !== "DOWN") {
      console.error("❌ MySQL connection lost");
      lastConnectionState = "DOWN";
    }

    // Background retry (auto-healing)
    setTimeout(() => {
      createPool(); // 🔄 recreate pool
      testDbConnection(); // 🔁 retry connection
    }, RETRY_DELAY_MS);
  }
}
