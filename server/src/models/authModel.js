/**
 * Authentication Model
 *
 * Handles database queries related to user authentication.
 * Uses parameterized queries to prevent SQL injection.
 */

const { pool } = require("../config/db");

/**
 * Find a user by their email address.
 * Joins the user table with the role table to retrieve the role name.
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
      role.role_name
    FROM user
    JOIN role ON user.role_id = role.role_id
    WHERE user.email = ?`,
    [email]
  );

  return rows[0] || null;
}

module.exports = {
  findUserByEmail
};
