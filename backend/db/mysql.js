// mysql.js
// -----------------------------------------------------------------------------
// Centralized MySQL connection manager
//
// Features:
// • Automatic reconnection (infinite retry loop)
// • Pool recreation on failure
// • dbReady flag for controllers (graceful degradation)
// • Backend NEVER crashes if DB goes down
//
// CRITICAL TIMEZONE GUARANTEE (IMPORTANT):
// -----------------------------------------------------------------------------
// • MySQL DATETIME has NO timezone
// • mysql2 will, by default, convert DATETIME → JS Date
// • JS Date serializes to ISO (...Z), introducing UTC drift
//
// SOLUTION (MANDATORY):
// • Use `dateStrings: true`
// • Forces DATETIME to remain "YYYY-MM-DD HH:MM:SS"
// • Prevents 8:00 → 13:00 → 18:00 PM cascading bugs
//
// This file is the SINGLE source of truth for MySQL access
// -----------------------------------------------------------------------------

import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

// -----------------------------------------------------------------------------
// State
// -----------------------------------------------------------------------------
let pool = null;
export let dbReady = false;

// Retry delay (ms)
const RETRY_DELAY_MS = 5000;

// -----------------------------------------------------------------------------
// Create MySQL connection pool
// -----------------------------------------------------------------------------
// IMPORTANT OPTIONS:
// • dateStrings: true
//   - Ensures DATETIME is returned as STRING, not JS Date
//   - Prevents timezone mutation when serializing JSON
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

    // 🔐 CRITICAL: preserve MySQL DATETIME as string (NO UTC drift)
    dateStrings: true,
  });
}

// Create initial pool immediately (even if DB is down)
createPool();

// -----------------------------------------------------------------------------
// Test DB connection (auto-retry forever)
// -----------------------------------------------------------------------------
// • Called once from server.js
// • If DB is down → keeps retrying in background
// • If DB comes back → flips dbReady = true
// • Pool is recreated on failure to avoid poisoned connections
// -----------------------------------------------------------------------------
export async function testDbConnection() {
  try {
    const conn = await pool.getConnection();
    await conn.query("SELECT 1");
    conn.release();

    if (!dbReady) {
      console.log("✅ MySQL connected");
    }

    dbReady = true;
  } catch (err) {
    if (dbReady) {
      console.error("❌ MySQL connection lost");
    } else {
      console.error("❌ MySQL unavailable, retrying...");
    }

    dbReady = false;

    // Recreate pool + retry after delay
    setTimeout(() => {
      createPool(); // 🔥 recreate broken pool
      testDbConnection(); // 🔁 retry connection
    }, RETRY_DELAY_MS);
  }
}

// -----------------------------------------------------------------------------
// Export pool
// Controllers MUST still check dbReady before querying
// -----------------------------------------------------------------------------
export { pool };
