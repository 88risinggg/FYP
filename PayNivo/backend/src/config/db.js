import mysql from "mysql2/promise";

// Shared MySQL connection pool. Import this pool in models/services when database logic is added.
export const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME || "paynivo",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export async function testDatabaseConnection() {
  const connection = await pool.getConnection();
  connection.release();
}
