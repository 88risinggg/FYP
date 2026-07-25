/**
 * Authentication Model
 *
 * Handles database queries related to user authentication.
 * Uses parameterized queries to prevent SQL injection.
 */

const { pool } = require("../config/db");

let userColumnCache = null;

async function getUserColumns(connection = pool) {
  if (userColumnCache) return userColumnCache;
  const [rows] = await connection.execute(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'user'`
  );
  userColumnCache = new Set(rows.map((row) => row.COLUMN_NAME || row.column_name));
  return userColumnCache;
}

function userColumn(columns, columnName, fallbackSql) {
  return columns.has(columnName)
    ? `user.\`${columnName}\``
    : fallbackSql;
}

/**
 * Find a user by their email address.
 * Reads the role directly from the consolidated user table.
 *
 * @param {string} email - The email address to search for.
 * @returns {Object|null} User object with user_id, email, name, password (hashed), status, and role_name. Returns null if not found.
 */
async function findUserByEmail(email) {
  const columns = await getUserColumns();
  const [rows] = await pool.execute(
    `SELECT
      user.user_id,
      user.email,
      user.name,
      user.password,
      user.status,
      user.role_name,
      ${userColumn(columns, "must_change_password", "0")} AS must_change_password,
      ${userColumn(columns, "failed_login_attempts", "0")} AS failed_login_attempts,
      ${userColumn(columns, "account_locked_at", "NULL")} AS account_locked_at,
      ${userColumn(columns, "account_lock_reason", "NULL")} AS account_lock_reason,
      ${userColumn(columns, "company_id", "NULL")} AS company_id
    FROM user
    WHERE LOWER(user.email) = LOWER(?)`,
    [email]
  );

  return rows[0] || null;
}

async function findUserById(userId) {
  const columns = await getUserColumns();
  const [rows] = await pool.execute(
    `SELECT
      user.user_id,
      user.email,
      user.name,
      user.password,
      user.status,
      user.role_name,
      ${userColumn(columns, "company_id", "NULL")} AS company_id,
      ${userColumn(columns, "must_change_password", "0")} AS must_change_password,
      ${userColumn(columns, "failed_login_attempts", "0")} AS failed_login_attempts,
      ${userColumn(columns, "account_locked_at", "NULL")} AS account_locked_at,
      ${userColumn(columns, "account_lock_reason", "NULL")} AS account_lock_reason
     FROM user WHERE user.user_id = ? LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function recordFailedLogin(userId, threshold = 5) {
  const columns = await getUserColumns();
  if (!columns.has("failed_login_attempts") || !columns.has("account_locked_at") || !columns.has("account_lock_reason")) {
    return { locked: false, newlyLocked: false, attempts: 0 };
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT failed_login_attempts, account_locked_at
       FROM user WHERE user_id = ? FOR UPDATE`,
      [userId]
    );
    if (!rows[0]) {
      await connection.rollback();
      return { locked: false, newlyLocked: false, attempts: 0 };
    }
    if (rows[0].account_locked_at) {
      await connection.commit();
      return { locked: true, newlyLocked: false, attempts: Number(rows[0].failed_login_attempts || threshold) };
    }

    const attempts = Number(rows[0].failed_login_attempts || 0) + 1;
    const newlyLocked = attempts >= threshold;
    await connection.execute(
      `UPDATE user
       SET failed_login_attempts = ?,
           account_locked_at = IF(?, NOW(), NULL),
           account_lock_reason = IF(?, 'Too many failed password attempts', NULL)
       WHERE user_id = ?`,
      [attempts, newlyLocked ? 1 : 0, newlyLocked ? 1 : 0, userId]
    );
    await connection.commit();
    return { locked: newlyLocked, newlyLocked, attempts };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function resetFailedLogins(userId) {
  const columns = await getUserColumns();
  if (!columns.has("failed_login_attempts") || !columns.has("account_locked_at")) return;

  await pool.execute(
    `UPDATE user SET failed_login_attempts = 0
     WHERE user_id = ? AND account_locked_at IS NULL`,
    [userId]
  );
}

async function completeFirstLogin(userId, passwordHash) {
  const columns = await getUserColumns();
  if (!columns.has("must_change_password")) return findUserById(userId);

  const setParts = ["password = ?", "must_change_password = 0"];
  if (columns.has("password_changed_at")) setParts.push("password_changed_at = NOW()");
  if (columns.has("updated_at")) setParts.push("updated_at = NOW()");

  await pool.execute(
    `UPDATE user
     SET ${setParts.join(", ")}
     WHERE user_id = ? AND status = 1 AND must_change_password = 1`,
    [passwordHash, userId]
  );
  return findUserById(userId);
}

module.exports = {
  completeFirstLogin,
  findUserByEmail,
  findUserById,
  getUserColumns,
  recordFailedLogin,
  resetFailedLogins
};
