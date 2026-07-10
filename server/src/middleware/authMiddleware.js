const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");

/**
 * JWT authentication middleware.
 * Verifies the Bearer token and attaches user info to req.user.
 * Also validates user is still active in the database.
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "Authentication required"
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await pool.execute(
      `SELECT
        user.user_id AS userId,
        user.email,
        user.status,
        role.role_name AS role
      FROM user
      JOIN role ON user.role_id = role.role_id
      WHERE user.user_id = ?`,
      [payload.userId]
    );

    const user = rows[0];

    if (!user || Number(user.status) !== 1) {
      return res.status(403).json({
        message: "Account is disabled or no longer available"
      });
    }

    req.user = {
      ...payload,
      email: user.email,
      role: user.role
    };

    // Resolve staffId (employee_id) for Staff users from the staff table
    try {
      const [staffRows] = await pool.execute(
        "SELECT employee_id FROM staff WHERE user_user_id = ? LIMIT 1",
        [user.userId]
      );
      if (staffRows.length > 0) {
        req.user.staffId = staffRows[0].employee_id;
        req.user.employeeId = staffRows[0].employee_id;
      }
    } catch (staffErr) {
      // Non-blocking — staffId simply won't be set if staff record doesn't exist
    }

    next();
  } catch (error) {
    res.status(403).json({
      message: "Invalid or expired token"
    });
  }
}

/**
 * Role-based access control middleware.
 * Restricts route access to specified roles.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user?.role)) {
      return res.status(403).json({
        message: "Access denied: insufficient permissions"
      });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole
};
