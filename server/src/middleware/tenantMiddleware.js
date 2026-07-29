const { pool } = require("../config/db");
const { runWithTenant } = require("../services/tenantContext");

const HIGH_RISK_PATTERNS = [
  /approve-payroll/i, /confirm-payment/i, /submit.*treasury/i, /send-payslip/i,
  /delete/i, /password/i, /export/i, /download/i
];

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

function requireTenant(req, res, next) {
  const resolveCompanyId = async () => {
    const directCompanyId = Number(req.user?.companyId);
    if (Number.isInteger(directCompanyId) && directCompanyId > 0) {
      debugLeave(req, "tenant_direct_company", { companyId: directCompanyId });
      return directCompanyId;
    }

    if (req.user?.staffId) {
      const [rows] = await pool.execute(
        "SELECT company_id FROM staff WHERE employee_id = ? LIMIT 1",
        [req.user.staffId]
      );
      const staffCompanyId = Number(rows[0]?.company_id);
      debugLeave(req, "tenant_by_staff", { found: rows.length, companyId: staffCompanyId || null });
      if (Number.isInteger(staffCompanyId) && staffCompanyId > 0) {
        req.user.companyId = staffCompanyId;
        return staffCompanyId;
      }
    }

    if (req.user?.userId) {
      const [rows] = await pool.execute(
        "SELECT company_id FROM staff WHERE user_user_id = ? LIMIT 1",
        [req.user.userId]
      );
      const staffCompanyId = Number(rows[0]?.company_id);
      debugLeave(req, "tenant_by_user", { found: rows.length, companyId: staffCompanyId || null });
      if (Number.isInteger(staffCompanyId) && staffCompanyId > 0) {
        req.user.companyId = staffCompanyId;
        return staffCompanyId;
      }
    }

    return null;
  };

  resolveCompanyId()
    .then((companyId) => {
      if (!Number.isInteger(companyId) || companyId <= 0) {
        debugLeave(req, "tenant_denied", { reason: "no_company_id" });
        setLeaveDebugHeader(res, "tenant_denied", { reason: "no_company_id" });
        return res.status(403).json({ code: "TENANT_REQUIRED", message: "Select an authorised company workspace before accessing client data." });
      }
      req.tenant = { companyId };
      debugLeave(req, "tenant_ok", { companyId });
      return runWithTenant(companyId, next);
    })
    .catch((error) => {
      debugLeave(req, "tenant_error", { error: error.message });
      setLeaveDebugHeader(res, "tenant_error", { error: error.message });
      console.error("requireTenant error:", error);
      return res.status(500).json({ code: "TENANT_RESOLUTION_FAILED", message: "Unable to resolve company workspace." });
    });
}

async function validateSupportContext(req, res, next) {
  if (!req.user?.supportGrantId) return next();
  const [rows] = await pool.execute(
    `SELECT grant_id, access_mode, status, expires_at FROM support_access_grants
     WHERE grant_id = ? AND company_id = ? AND operator_user_id = ? LIMIT 1`,
    [req.user.supportGrantId, req.user.companyId, req.user.userId]
  );
  const grant = rows[0];
  if (!grant || grant.status !== "active" || new Date(grant.expires_at).getTime() <= Date.now()) {
    debugLeave(req, "support_denied", { reason: "expired_or_missing" });
    setLeaveDebugHeader(res, "support_denied", { reason: "expired_or_missing" });
    return res.status(403).json({ code: "SUPPORT_ACCESS_EXPIRED", message: "This support session is no longer authorised." });
  }
  req.supportContext = { grantId: grant.grant_id, mode: grant.access_mode };
  if (HIGH_RISK_PATTERNS.some((pattern) => pattern.test(`${req.method} ${req.originalUrl}`))) {
    debugLeave(req, "support_denied", { reason: "high_risk" });
    setLeaveDebugHeader(res, "support_denied", { reason: "high_risk" });
    return res.status(403).json({ code: "SUPPORT_ACTION_RESTRICTED", message: "This high-risk action is unavailable during PayNivo support access." });
  }
  if (grant.access_mode === "read_only" && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    debugLeave(req, "support_denied", { reason: "read_only" });
    setLeaveDebugHeader(res, "support_denied", { reason: "read_only" });
    return res.status(403).json({ code: "SUPPORT_READ_ONLY", message: "This support grant is read-only." });
  }
  next();
}

module.exports = { requireTenant, validateSupportContext };
