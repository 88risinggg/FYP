/**
 * EVALUATION HEADER
 * FEATURE: SECURITY / ACCESS
 * PURPOSE: Provides reusable tenant Context business or integration operations.
 * LAYER: Backend service - contains reusable business rules or external integrations.
 * FIND RELATED CODE: Use Find All References to locate controllers, workers, or services that call it.
 */
const { AsyncLocalStorage } = require("async_hooks");
const storage = new AsyncLocalStorage();

function runWithTenant(companyId, callback) { return storage.run({ companyId: Number(companyId) }, callback); }
function currentCompanyId() {
  const companyId = Number(storage.getStore()?.companyId);
  if (!Number.isInteger(companyId) || companyId <= 0) throw Object.assign(new Error("Tenant context is required."), { code: "TENANT_REQUIRED", status: 403 });
  return companyId;
}

module.exports = { currentCompanyId, runWithTenant };
