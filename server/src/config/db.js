const mysql = require("mysql2/promise");
require("dotenv").config();

const useSsl = process.env.DB_SSL === "true";

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: useSsl ? { rejectUnauthorized: true } : undefined,
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 30000,
  maxIdle: 5,
  idleTimeout: 60000
});

async function testDatabaseConnection() {
  const connection = await pool.getConnection();

  try {
    await connection.ping();
    return true;
  } finally {
    connection.release();
  }
}

async function waitForDatabase({ attempts = 3, retryDelayMs = 2000 } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await testDatabaseConnection();
      return true;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        console.warn(`Database connection attempt ${attempt}/${attempts} failed; retrying...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  throw lastError;
}

module.exports = {
  pool,
  testDatabaseConnection,
  waitForDatabase
};
