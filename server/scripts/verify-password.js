/**
 * Verify the stored hash matches the password we set.
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const bcrypt = require("bcrypt");
const mysql = require("mysql2/promise");

async function verify() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined
  });

  console.log("Connecting to:", process.env.DB_HOST, "DB:", process.env.DB_NAME);

  const [rows] = await pool.query(
    "SELECT user_id, email, password, status FROM user WHERE email IN ('admin@paynivo.com','finance@paynivo.com') ORDER BY email"
  );

  for (const row of rows) {
    const match123  = await bcrypt.compare("Password@123", row.password);
    const matchAdmin = await bcrypt.compare("Admin@123", row.password);
    console.log(`\n${row.email} (status=${row.status})`);
    console.log(`  hash prefix : ${row.password.substring(0, 30)}...`);
    console.log(`  Password@123 matches: ${match123}`);
    console.log(`  Admin@123    matches: ${matchAdmin}`);
  }

  await pool.end();
}

verify().catch(console.error);
