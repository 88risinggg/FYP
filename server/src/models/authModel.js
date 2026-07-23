/**
 * Authentication Model
 *
 * Handles database queries related to user authentication.
 * Uses parameterized queries to prevent SQL injection.
 */

const { pool } = require("../config/db");

/**
 * Find a user by their email address.
 * Reads the role directly from the consolidated user table.
 *
 * @param {string} email - The email address to search for.
 * @returns {Object|null} User object with user_id, email, name, password (hashed), status, and role_name. Returns null if not found.
 */
async function findUserByEmail(email) {
  const [rows] = await pool.execute(
    `SELECT
      user.user_id,
      user.email,
      user.name,
      user.password,
      user.status,
      user.role_name,
      user.must_change_password
    FROM user
    WHERE LOWER(user.email) = LOWER(?)`,
    [email]
  );

  return rows[0] || null;
}

async function findUserById(userId) {
  const [rows] = await pool.execute(
    `SELECT user_id, email, name, password, status, role_name, must_change_password
     FROM user WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function completeFirstLogin(userId, passwordHash) {
  await pool.execute(
    `UPDATE user
     SET password = ?, must_change_password = 0, password_changed_at = NOW(), updated_at = NOW()
     WHERE user_id = ? AND status = 1 AND must_change_password = 1`,
    [passwordHash, userId]
  );
  return findUserById(userId);
}

module.exports = {
  completeFirstLogin,
  findUserByEmail,
  findUserById
};
