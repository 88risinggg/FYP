/**
 * EVALUATION HEADER
 * FEATURE: SECURITY / ACCESS
 * PURPOSE: Provides reusable company Scope helper functions.
 * LAYER: Application support code used by other modules.
 * FIND RELATED CODE: Use Find All References on its exports to locate connected features.
 */
function getCompanyId(req) {
  const value = Number(req?.user?.companyId);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function requireCompanyId(req) {
  const companyId = getCompanyId(req);
  if (!companyId) throw Object.assign(new Error("A company-scoped session is required."), { code: "TENANT_REQUIRED", status: 403 });
  return companyId;
}

function companyWhere(alias = "") {
  const prefix = alias ? `${alias}.` : "";
  return `${prefix}company_id = ?`;
}

module.exports = {
  companyWhere,
  getCompanyId,
  requireCompanyId
};
