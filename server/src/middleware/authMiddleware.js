/**
 * EVALUATION HEADER
 * FEATURE: SECURITY / ACCESS
 * PURPOSE: Applies auth Middleware checks or context to incoming backend requests.
 * LAYER: Backend middleware - performs checks or adds request context before controllers run.
 * FIND RELATED CODE: Search route files for this middleware to see which endpoints it protects.
 */
const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");
const { findUserById } = require("../models/authModel");
const { validateSupportContext } = require("./tenantMiddleware");
const settingsModel = require("../models/settingsModel");

function debugLeave(req, stage, details = {}) {
  if (process.env.DEBUG_LEAVE !== "true") return;
  console.log("[LEAVE_DEBUG]", JSON.stringify({
    stage,
    method: req.method,
    path: req.originalUrl || req.url || "unknown",
    userId: req.user?.userId || null,
    role: req.user?.role || null,
    companyId: req.user?.companyId || null,
    staffId: req.user?.staffId || null,
    ...details
  }));
}

function setLeaveDebugHeader(res, stage, details = {}) {
  if (process.env.DEBUG_LEAVE !== "true") return;
  try {
    res.setHeader("X-Leave-Debug", Buffer.from(JSON.stringify({ stage, ...details })).toString("base64"));
  } catch {
    // Header debugging must never block a real response.
  }
}

async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ code: "AUTH_REQUIRED", message: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await findUserById(payload.userId);
    debugLeave(req, "jwt_verified", { tokenRole: payload.role || null, tokenCompanyId: payload.companyId || null });

    if (user?.account_locked_at) {
      debugLeave(req, "account_locked");
      setLeaveDebugHeader(res, "account_locked");
      return res.status(423).json({
        code: "ACCOUNT_LOCKED",
        message: "This account is locked. Contact an administrator to reactivate it."
      });
    }

    if (!user || !(user.status === 1 || user.status === "1" || (typeof user.status === "string" && user.status.toLowerCase() === "active"))) {
      debugLeave(req, "account_disabled");
      setLeaveDebugHeader(res, "account_disabled");
      return res.status(403).json({
        code: "ACCOUNT_DISABLED",
        message: "Account is disabled or no longer available"
      });
    }

    if (Number(user.must_change_password) === 1) {
      debugLeave(req, "password_change_required");
      setLeaveDebugHeader(res, "password_change_required");
      return res.status(403).json({
        code: "PASSWORD_CHANGE_REQUIRED",
        message: "Sign in with your temporary password and create a permanent password before continuing."
      });
    }

    req.user = {
      ...payload,
      email: user.email,
      role: payload.supportGrantId ? payload.role : user.role_name,
      operatorRole: payload.supportGrantId ? user.role_name : null,
      companyId: user.company_id || payload.companyId || null,
      supportGrantId: payload.supportGrantId || null
    };
    debugLeave(req, "user_attached", { dbRole: user.role_name || null, dbCompanyId: user.company_id || null });

    if (payload.sessionId && user.company_id) {
      const activeSession = await settingsModel.loginSessionExists(user.user_id, payload.sessionId, user.company_id);
      if (!activeSession) {
        debugLeave(req, "session_terminated", { sessionId: payload.sessionId });
        setLeaveDebugHeader(res, "session_terminated", { sessionId: payload.sessionId });
        return res.status(401).json({ code: "SESSION_TERMINATED", message: "This login session has been terminated." });
      }
    }

    try {
      let [staffRows] = await pool.execute(
        "SELECT employee_id FROM staff WHERE user_user_id = ? AND company_id = ? LIMIT 1",
        [user.user_id, user.company_id || payload.companyId || null]
      );

      if (!staffRows.length && user.email) {
        [staffRows] = await pool.execute(
          "SELECT employee_id FROM staff WHERE LOWER(email) = LOWER(?) AND company_id = ? LIMIT 1",
          [user.email, user.company_id || payload.companyId || null]
        );
      }

      if (staffRows.length > 0) {
        req.user.staffId = staffRows[0].employee_id;
        req.user.employeeId = staffRows[0].employee_id;
      }
      debugLeave(req, "staff_resolved", { linkedStaffCount: staffRows.length });
    } catch (staffErr) {
      debugLeave(req, "staff_lookup_failed", { error: staffErr.message });
    }

    return validateSupportContext(req, res, next);
  } catch (error) {
    debugLeave(req, "auth_failed", { error: error.message });
    setLeaveDebugHeader(res, "auth_failed", { error: error.message });
    return res.status(401).json({
      code: "AUTH_INVALID",
      message: "Invalid or expired token"
    });
  }
}

function requireRole(...allowedRoles) {
  const normalizedAllowed = allowedRoles.map((role) => String(role || "").trim().toLowerCase());

  return (req, res, next) => {
    const actualRole = String(req.user?.role || "").trim().toLowerCase();
    if (!normalizedAllowed.includes(actualRole)) {
      debugLeave(req, "require_role_denied", { allowedRoles, actualRole: req.user?.role || null });
      setLeaveDebugHeader(res, "require_role_denied", { allowedRoles, actualRole: req.user?.role || null });
      return res.status(403).json({
        code: "ACCESS_DENIED",
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
