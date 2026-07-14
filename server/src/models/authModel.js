const { pool } = require("../config/db");

async function findUserByEmail(email) {
  const [rows] = await pool.execute(
    `SELECT
      user.user_id,
      user.email,
      user.name,
      user.password,
      user.status,
      role.role_name
    FROM user
    JOIN role ON user.role_id = role.role_id
    WHERE user.email = ?`,
    [email]
  );

  return rows[0] || null;
}

async function ensureLoginTrackingColumns() {
  const [columns] = await pool.execute("SHOW COLUMNS FROM user");
  const existingColumns = new Set(columns.map((column) => column.Field));

  if (!existingColumns.has("previous_login_at")) {
    await pool.execute("ALTER TABLE user ADD COLUMN previous_login_at DATETIME NULL");
  }

  if (!existingColumns.has("last_login_at")) {
    await pool.execute("ALTER TABLE user ADD COLUMN last_login_at DATETIME NULL");
  }
}

async function updateUserLoginTimestamps(userId) {
  await ensureLoginTrackingColumns();

  const [rows] = await pool.execute(
    "SELECT previous_login_at AS previousLoginAt, last_login_at AS lastLoginAt FROM user WHERE user_id = ?",
    [userId]
  );
  const previousLoginAt = rows[0]?.previousLoginAt || rows[0]?.lastLoginAt || null;

  await pool.execute(
    "UPDATE user SET previous_login_at = last_login_at, last_login_at = NOW() WHERE user_id = ?",
    [userId]
  );

  return previousLoginAt;
}

module.exports = {
  findUserByEmail,
  updateUserLoginTimestamps
};

