const { testDatabaseConnection } = require("../config/db");

async function getServerHealth(req, res) {
  res.json({
    status: "ok",
    message: "Server is running"
  });
}

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

