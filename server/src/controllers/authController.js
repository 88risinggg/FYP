/**
 * Authentication Controller
 *
 * Handles user login with email/password verification.
 * Issues JWT tokens for authenticated sessions.
 * Implements role-based module access control.
 */

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { findUserByEmail } = require("../models/authModel");

/**
 * Determine which application modules a user role can access.
 * Admin and Finance can access both invoicing and payroll.
 * HR and Staff can only access payroll.
 *
 * @param {string} roleName - The role name (Admin, Finance, HR, Staff).
 * @returns {string[]} Array of allowed module names.
 */
function getAllowedModules(roleName) {
  const modulesByRole = {
    Admin: ["invoicing", "payroll"],
    Finance: ["invoicing", "payroll"],
    HR: ["payroll"],
    Staff: ["payroll"]
  };

  return modulesByRole[roleName] || [];
}

/**
 * Check if a user's account status is active.
 * Handles different representations of active status (1, true, "1", "active").
 *
 * @param {*} status - The status value from the database.
 * @returns {boolean} True if user is active.
 */
function isActiveStatus(status) {
  return status === 1 || status === true || status === "1" || status === "active";
}

/**
 * POST /api/auth/login
 *
 * Authenticates a user with email and password.
 * Validates credentials against bcrypt-hashed password in database.
 * Returns a signed JWT token and user profile on success.
 *
 * Request body: { email: string, password: string }
 * Success response: { token: string, user: { userId, email, name, role, allowedModules } }
 * Error responses: 400 (missing fields), 401 (invalid credentials), 500 (server error)
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        message: "Invalid email or password"
      });
    }

    // Look up user by email in database
    const user = await findUserByEmail(email.trim().toLowerCase());

    // Check user exists and account is active
    if (!user || !isActiveStatus(user.status)) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    // Verify password against bcrypt hash
    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    // Build JWT payload with user identity and role
    const payload = {
      userId: user.user_id,
      email: user.email,
      role: user.role_name
    };

    // Sign JWT token with configured secret and expiration
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d"
    });

    // Return token and user profile including allowed modules
    res.json({
      token,
      user: {
        userId: user.user_id,
        email: user.email,
        name: user.name,
        role: user.role_name,
        allowedModules: getAllowedModules(user.role_name)
      }
    });
  } catch (error) {
    res.status(500).json({
      message: "Login failed. Please try again later."
    });
  }
}

module.exports = {
  login
};
