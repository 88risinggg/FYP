/**
 * Legacy in-memory data store.
 *
 * DEPRECATED — All new code should use the database directly.
 * Retained temporarily for:
 *   - staffProfiles[]: fallback in hrRoutes.js when DB query fails
 *   - payrollRuns[]: referenced by HR search (to be removed)
 *   - payslips[]: fallback payslip retrieval (to be removed)
 *   - payrollRateConfig: GET/PUT /api/payroll/rates (to be migrated to payroll_configuration table)
 *
 * PAYSLIP_STATUSES moved to utils/constants.js
 * auditLogs removed — use auditService.js writeAuditLog() instead
 */

const staffProfiles = [];

const payrollRuns = [];

const payslips = [];

// Payroll rate configuration (HR keeps CPF/SDL rates only)
const payrollRateConfig = {
  employeeCpfRate: 0.2,
  employerCpfRate: 0.17,
  sdlRate: 0.002,
  defaultAllowanceRate: 0,
  defaultDeductionRate: 0,
  updatedAt: new Date().toISOString()
};

module.exports = {
  staffProfiles,
  payrollRuns,
  payslips,
  payrollRateConfig,
};
