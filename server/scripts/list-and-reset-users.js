/**
 * List all users and reset their passwords to a standard pattern.
 * Usage: node scripts/list-and-reset-users.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const bcrypt = require("bcrypt");
const mysql = require("mysql2/promise");

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined
  });

  // List all users
  const [users] = await pool.query(`
    SELECT u.user_id, u.email, u.name, u.status, r.role_name
    FROM user u
    LEFT JOIN role r ON r.role_id = u.role_id
    ORDER BY u.user_id ASC
  `);

  console.log("\n=== ALL USERS ===");
  console.log("ID  | Email                          | Name                | Role    | Status");
  console.log("----|--------------------------------|---------------------|---------|-------");
  users.forEach((u) => {
    console.log(
      `${String(u.user_id).padEnd(4)}| ${String(u.email || "").padEnd(31)} | ${String(u.name || "").padEnd(20)}| ${String(u.role_name || "").padEnd(8)}| ${u.status}`
    );
  });

  // Reset all passwords to Password@123
  const NEW_PASSWORD = "Password@123";
  const hash = await bcrypt.hash(NEW_PASSWORD, 12);

  await pool.query("UPDATE user SET password = ?", [hash]);

  console.log(`\n=== PASSWORDS RESET ===`);
  console.log(`All ${users.length} user(s) now use password: ${NEW_PASSWORD}`);
  console.log("\nQuick login reference:");
  users.forEach((u) => {
    console.log(`  ${u.email}  →  ${NEW_PASSWORD}  (${u.role_name})`);
  });

  await pool.end();
}

run().catch(console.error);
