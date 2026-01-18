// mysql.js
// -----------------------------------------------------------------------------
// Centralized MySQL connection manager
//
// Features:
// • Automatic reconnection (infinite retry loop)
// • Pool recreation on failure
// • dbReady flag for controllers (graceful degradation)
// • Graceful shutdown support (safe pool close)
//
// CRITICAL TIMEZONE GUARANTEE:
// • MySQL DATETIME has NO timezone
// • mysql2 defaults convert DATETIME → JS Date → UTC drift
// • dateStrings: true prevents all timezone corruption
// -----------------------------------------------------------------------------

import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

// -----------------------------------------------------------------------------
// STATE
// -----------------------------------------------------------------------------
let pool = null;
export let dbReady = false;
let shuttingDown = false;

// Retry delay (ms)
const RETRY_DELAY_MS = 5000;

// -----------------------------------------------------------------------------
// CREATE POOL
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

    // 🔐 CRITICAL: keep DATETIME as string
    dateStrings: true,
  });
}

// Create initial pool immediately
createPool();

// -----------------------------------------------------------------------------
// DB READINESS CHECK (AUTO-RETRY)
// -----------------------------------------------------------------------------
export async function testDbConnection() {
  // Do not retry once shutdown starts
  if (shuttingDown) return;

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

    // Retry unless shutting down
    if (!shuttingDown) {
      setTimeout(() => {
        createPool();       // 🔥 recreate poisoned pool
        testDbConnection(); // 🔁 retry
      }, RETRY_DELAY_MS);
    }
  }
}

// -----------------------------------------------------------------------------
// GRACEFUL SHUTDOWN (SINGLE SAFE EXIT)
// -----------------------------------------------------------------------------
export async function closeDbPool() {
  if (shuttingDown) return;
  shuttingDown = true;

  if (!pool) return;

  try {
    console.log("🧹 Closing MySQL pool...");
    await pool.end();
    console.log("✅ MySQL pool closed");
  } catch (err) {
    console.error("❌ Error closing MySQL pool:", err.message);
  }
}

// -----------------------------------------------------------------------------
// EXPORT POOL (READ-ONLY USAGE)
// -----------------------------------------------------------------------------
export { pool };
