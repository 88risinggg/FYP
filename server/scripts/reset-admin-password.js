/**
 * Admin Password Reset Script
 *
 * Usage: node scripts/reset-admin-password.js
 *
 * Resets the password for admin@paynivo.com to Admin@123
 * Run once, then delete this file.
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const bcrypt = require("bcrypt");
const mysql = require("mysql2/promise");

const NEW_PASSWORD = "Admin@123";
const TARGET_EMAIL = "admin@paynivo.com";

async function resetPassword() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined
  });

  try {
    const hash = await bcrypt.hash(NEW_PASSWORD, 12);

    const [result] = await pool.query(
      "UPDATE user SET password = ? WHERE email = ?",
      [hash, TARGET_EMAIL]
    );

    if (result.affectedRows === 0) {
      console.log(`No user found with email: ${TARGET_EMAIL}`);

      // Show existing users to help identify the correct email
      const [users] = await pool.query("SELECT email, status FROM user LIMIT 10");
      console.log("\nExisting users:");
      users.forEach((u) => console.log(` - ${u.email} (status: ${u.status})`));
    } else {
      console.log(`✓ Password reset for ${TARGET_EMAIL}`);
      console.log(`  New password: ${NEW_PASSWORD}`);
    }
  } finally {
    await pool.end();
  }
}

resetPassword().catch(console.error);
