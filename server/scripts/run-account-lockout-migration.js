require("dotenv").config();

const { pool } = require("../src/config/db");

const columns = [
  ["failed_login_attempts", "INT NOT NULL DEFAULT 0 AFTER must_change_password"],
  ["account_locked_at", "DATETIME NULL AFTER failed_login_attempts"],
  ["account_lock_reason", "VARCHAR(255) NULL AFTER account_locked_at"]
];

async function columnExists(name) {
  const [rows] = await pool.execute(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = ?`,
    [name]
  );
  return rows.length > 0;
}

async function run() {
  try {
    for (const [name, definition] of columns) {
      if (!(await columnExists(name))) {
        await pool.query(`ALTER TABLE user ADD COLUMN ${name} ${definition}`);
        console.log(`Added user.${name}`);
      } else {
        console.log(`user.${name} already exists`);
      }
    }
    console.log("Account lockout migration complete.");
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("Account lockout migration failed:", error.message);
  process.exitCode = 1;
});
