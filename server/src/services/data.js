const staffProfiles = [];

const payrollRuns = [];

const payslips = [];

const payrollRateConfig = {
  employeeCpfRate: 0.2,
  employerCpfRate: 0.17,
  sdlRate: 0.002,
  defaultAllowanceRate: 0,
  defaultDeductionRate: 0,
  updatedAt: new Date().toISOString()
};

const auditLogs = [];
const payrollRecords = [];

// Payslip status workflow: draft → finance_pending → finance_approved → admin_pending → admin_approved → sent_to_staff
const PAYSLIP_STATUSES = {
  DRAFT: 'draft',
  FINANCE_PENDING: 'finance_pending',
  FINANCE_APPROVED: 'finance_approved',
  ADMIN_PENDING: 'admin_pending',
  ADMIN_APPROVED: 'admin_approved',
  SENT_TO_STAFF: 'sent_to_staff',
  REJECTED: 'rejected'
};

module.exports = {
  staffProfiles,
  payrollRuns,
  payslips,
  payrollRateConfig,
  auditLogs,
  payrollRecords,
  PAYSLIP_STATUSES
};
