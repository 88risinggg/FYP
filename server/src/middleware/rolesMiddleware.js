/**
 * EVALUATION HEADER
 * FEATURE: SECURITY / ACCESS
 * PURPOSE: Applies roles Middleware checks or context to incoming backend requests.
 * LAYER: Backend middleware - performs checks or adds request context before controllers run.
 * FIND RELATED CODE: Search route files for this middleware to see which endpoints it protects.
 */
function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

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
    // Debugging must never block the response.
  }
}

function allowRoles(...allowed) {
  const normalizedAllowed = allowed.map(normalizeRole);

  return function (req, res, next) {
    if (!req.user) {
      debugLeave(req, "allow_roles_denied", { reason: "missing_user", allowedRoles: allowed });
      setLeaveDebugHeader(res, "allow_roles_denied", { reason: "missing_user", allowedRoles: allowed });
      return res.status(401).json({ code: "AUTH_REQUIRED", message: "Authentication required" });
    }

    if (normalizedAllowed.includes(normalizeRole(req.user.role))) return next();
    debugLeave(req, "allow_roles_denied", { reason: "role_mismatch", allowedRoles: allowed, actualRole: req.user.role || null });
    setLeaveDebugHeader(res, "allow_roles_denied", { reason: "role_mismatch", allowedRoles: allowed, actualRole: req.user.role || null });
    return res.status(403).json({ code: "ACCESS_DENIED", message: "Forbidden" });
  };
}

function requireRole(...allowedRoles) {
  const normalizedAllowed = allowedRoles.map(normalizeRole);

  return (req, res, next) => {
    if (!normalizedAllowed.includes(normalizeRole(req.user?.role))) {
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
  allowRoles,
  requireRole
};
