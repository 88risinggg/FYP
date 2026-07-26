const { pool } = require("../config/db");
const { runWithTenant } = require("../services/tenantContext");

const HIGH_RISK_PATTERNS = [
  /approve-payroll/i, /confirm-payment/i, /submit.*treasury/i, /send-payslip/i,
  /delete/i, /password/i, /export/i, /download/i
];

function requireTenant(req, res, next) {
  const companyId = Number(req.user?.companyId);
  if (!Number.isInteger(companyId) || companyId <= 0) {
    return res.status(403).json({ code: "TENANT_REQUIRED", message: "Select an authorised company workspace before accessing client data." });
  }
  req.tenant = { companyId };
  return runWithTenant(companyId, next);
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
    return res.status(403).json({ code: "SUPPORT_ACCESS_EXPIRED", message: "This support session is no longer authorised." });
  }
  req.supportContext = { grantId: grant.grant_id, mode: grant.access_mode };
  if (HIGH_RISK_PATTERNS.some((pattern) => pattern.test(`${req.method} ${req.originalUrl}`))) {
    return res.status(403).json({ code: "SUPPORT_ACTION_RESTRICTED", message: "This high-risk action is unavailable during PayNivo support access." });
  }
  if (grant.access_mode === "read_only" && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return res.status(403).json({ code: "SUPPORT_READ_ONLY", message: "This support grant is read-only." });
  }
  next();
}

module.exports = { requireTenant, validateSupportContext };
