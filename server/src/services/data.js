const staffProfiles = [];
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
const payslips = [];

module.exports = {
  staffProfiles,
  payrollRateConfig,
  auditLogs,
  payrollRecords,
  payslips
};
