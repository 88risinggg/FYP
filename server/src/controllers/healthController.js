/**
 * Health Check Controller
 *
 * Provides endpoints for monitoring server and database status.
 * Used by load balancers, monitoring tools, and DevOps pipelines.
 */

const { getDatabaseTimezone, testDatabaseConnection } = require("../config/db");
const { APPLICATION_TIMEZONE, DATABASE_TIMEZONE } = require("../config/timezone");

/**
 * GET /api/health
 *
 * Returns server running status.
 * Always returns 200 if the Express server is responding.
 */
async function getServerHealth(req, res) {
  res.json({
    status: "ok",
    message: "Server is running",
    timezone: APPLICATION_TIMEZONE,
    serverTime: new Intl.DateTimeFormat("en-SG", { dateStyle: "medium", timeStyle: "long", timeZone: APPLICATION_TIMEZONE }).format(new Date()),
    isoTime: new Date().toISOString()
  });
}

/**
 * GET /api/health/database
 *
 * Tests the MySQL database connection by pinging the pool.
 * Returns 200 if connected, 500 if connection fails.
 */
async function getDatabaseHealth(req, res) {
  try {
    await testDatabaseConnection();
    const database = await getDatabaseTimezone();

    res.json({
      status: "ok",
      message: "Database connected",
      configuredTimezone: DATABASE_TIMEZONE,
      sessionTimezone: database.sessionTimezone,
      databaseTime: database.databaseNow
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Database connection failed",
      detail: error.message
    });
  }
}

module.exports = {
  getServerHealth,
  getDatabaseHealth
};
