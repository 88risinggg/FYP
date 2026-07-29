/**
 * EVALUATION HEADER
 * FEATURE: SHARED / APPLICATION CORE
 * PURPOSE: Provides reusable data business or integration operations.
 * LAYER: Backend service - contains reusable business rules or external integrations.
 * FIND RELATED CODE: Use Find All References to locate controllers, workers, or services that call it.
 */
const staffProfiles = [];

const payrollRuns = [];

const payslips = [];

// In-memory audit log for development/testing
const auditLogs = [];

// Payroll rate configuration (HR keeps CPF/SDL rates only)
const payrollRateConfig = {
  employeeCpfRate: 0.2,
  employerCpfRate: 0.17,
  sdlRate: 0.002,
  defaultAllowanceRate: 0,
  defaultDeductionRate: 0,
  updatedAt: new Date().toISOString()
};

// Donation fund mapping (configured by Admin module):
// islam         → MBMF
// hindu         → SINDA
// buddhism      → CDAC
// taoism        → CDAC
// christianity  → CDAC
// others/foreign → none

// Note: audit logs and payroll records are handled by Admin/Finance modules
// via the real `audit_log` and payroll tables. Removed in-memory copies from HR.

// Payslip status workflow: draft → finance_pending → finance_approved → sent_to_staff
const PAYSLIP_STATUSES = {
  DRAFT: 'draft',
  FINANCE_PENDING: 'finance_pending',
  FINANCE_APPROVED: 'finance_approved',
  SENT_TO_STAFF: 'sent_to_staff',
  REJECTED: 'rejected'
};

module.exports = {
  staffProfiles,  // temporary until DB is connected
  payrollRuns,    // temporary until DB is connected
  payslips,       // temporary until DB is connected
  payrollRateConfig, // CPF and SDL rates only
  PAYSLIP_STATUSES,
  auditLogs
};
