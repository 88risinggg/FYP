/**
 * Health Check Controller
 *
 * Provides endpoints for monitoring server and database status.
 * Used by load balancers, monitoring tools, and DevOps pipelines.
 */

const { testDatabaseConnection } = require("../config/db");

/**
 * GET /api/health
 *
 * Returns server running status.
 * Always returns 200 if the Express server is responding.
 */
async function getServerHealth(req, res) {
  res.json({
    status: "ok",
    message: "Server is running"
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

    res.json({
      status: "ok",
      message: "Database connected"
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
