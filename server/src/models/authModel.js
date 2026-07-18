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
      user.role_name
    FROM user
    WHERE LOWER(user.email) = LOWER(?)`,
    [email]
  );

  return rows[0] || null;
}

module.exports = {
  findUserByEmail
};
