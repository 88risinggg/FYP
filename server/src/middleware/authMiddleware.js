const jwt = require("jsonwebtoken");

const { pool } = require("../config/db");

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
    next();
  } catch (error) {
    res.status(403).json({
      message: "Invalid or expired token"
    });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user?.role)) {
      return res.status(403).json({
        message: "Admin access required"
      });
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole
};
