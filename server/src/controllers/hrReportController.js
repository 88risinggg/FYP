/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - HR
 * PURPOSE: Handles HR Report Controller API requests, validation, status codes, and responses.
 * LAYER: Backend controller - validates HTTP input and returns the API response.
 * FIND RELATED CODE: Follow service/model calls to find business rules and database work.
 */
/**
 * HR Report Controller
 *
 * Orchestrates report generation for HR organizational reports.
 * Validates filter parameters, calls model for data retrieval,
 * and computes summary aggregations.
 */

const hrReportModel = require("../models/hrReportModel");
const { exportToExcel, exportToCsv } = require("../services/hrReportExportService");

// --- Validation Constants ---

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

const VALID_LEAVE_STATUSES = ["pending", "approved", "rejected", "cancelled"];
const VALID_LOAN_STATUSES = ["pending", "approved", "rejected"];
const VALID_ADVANCE_STATUSES = ["pending", "approved", "rejected"];
const VALID_EMPLOYEE_STATUSES = ["active", "inactive"];

const VALID_LEAVE_TYPES = [
  "Annual Leave",
  "Sick Leave",
  "Hospitalisation Leave",
  "Unpaid Leave",
  "Maternity Leave",
  "Paternity Leave",
  "Compassionate Leave",
];

// --- Validation Helpers ---

/**
 * Validate month filter parameter (YYYY-MM format).
 * @param {string} month
 * @returns {string|null} Error message or null if valid
 */
function validateMonth(month) {
  if (month && !MONTH_REGEX.test(month)) {
    return "Invalid month format. Expected YYYY-MM (e.g. 2024-03)";
  }
  return null;
}

/**
 * Validate year filter parameter (4-digit integer between 2000 and 2100).
 * @param {string|number} year
 * @returns {string|null} Error message or null if valid
 */
function validateYear(year) {
  if (year !== undefined && year !== null && year !== "") {
    const parsed = Number(year);
    if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100) {
      return "Invalid year. Expected a 4-digit integer between 2000 and 2100";
    }
  }
  return null;
}

/**
 * Validate departmentId filter parameter (positive integer).
 * @param {string|number} departmentId
 * @returns {string|null} Error message or null if valid
 */
function validateDepartmentId(departmentId) {
  if (departmentId !== undefined && departmentId !== null && departmentId !== "") {
    const parsed = Number(departmentId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return "Invalid departmentId. Expected a positive integer";
    }
  }
  return null;
}

/**
 * Validate status filter parameter against an allowed list.
 * @param {string} status
 * @param {string[]} allowedValues
 * @param {string} reportType
 * @returns {string|null} Error message or null if valid
 */
function validateStatus(status, allowedValues, reportType) {
  if (status !== undefined && status !== null && status !== "") {
    if (!allowedValues.includes(status)) {
      return `Invalid status for ${reportType} report. Allowed values: ${allowedValues.join(", ")}`;
    }
  }
  return null;
}

/**
 * Validate leaveType filter parameter.
 * @param {string} leaveType
 * @returns {string|null} Error message or null if valid
 */
function validateLeaveType(leaveType) {
  if (leaveType !== undefined && leaveType !== null && leaveType !== "") {
    if (!VALID_LEAVE_TYPES.includes(leaveType)) {
      return `Invalid leaveType. Allowed values: ${VALID_LEAVE_TYPES.join(", ")}`;
    }
  }
  return null;
}

/**
 * Validate format query parameter for export endpoints.
 * @param {string} format
 * @returns {string|null} Error message or null if valid
 */
function validateFormat(format) {
  const VALID_FORMATS = ["excel", "csv"];
  if (format && !VALID_FORMATS.includes(format)) {
    return `Invalid format. Supported formats: excel, csv`;
  }
  return null;
}

// --- Organizational Report Endpoints ---

/**
 * GET /api/hr/reports/payroll
 *
 * Generates organization-wide payroll summary report.
 * Supports filters: month (YYYY-MM), year (4-digit), departmentId (positive int).
 */
async function getPayrollReport(req, res) {
  const { month, year, departmentId } = req.query;

  // Validate filters
  const errors = [];
  const monthErr = validateMonth(month);
  if (monthErr) errors.push(monthErr);
  const yearErr = validateYear(year);
  if (yearErr) errors.push(yearErr);
  const deptErr = validateDepartmentId(departmentId);
  if (deptErr) errors.push(deptErr);

  if (errors.length > 0) {
    return res.status(400).json({ message: "Invalid filter parameters", details: errors });
  }

  try {
    const filters = {};
    if (month) filters.month = month;
    if (year) filters.year = Number(year);
    if (departmentId) filters.departmentId = Number(departmentId);

    const rows = await hrReportModel.fetchPayrollReport(filters);

    // Compute summary
    const employeeIds = new Set();
    let totalGrossPay = 0;
    let totalDeductions = 0;
    let totalNetPay = 0;

    for (const row of rows) {
      totalGrossPay += Number(row.base_salary || 0) + Number(row.allowances || 0);
      totalDeductions += Number(row.deductions || 0);
      totalNetPay += Number(row.net_pay || 0);
      employeeIds.add(row.employee_id);
    }

    const summary = {
      totalGrossPay,
      totalDeductions,
      totalNetPay,
      employeeCount: employeeIds.size,
      payslipCount: rows.length,
    };

    // Format rows for response
    const formattedRows = rows.map((row) => ({
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      department: row.department_id,
      baseSalary: Number(row.base_salary || 0),
      allowances: Number(row.allowances || 0),
      deductions: Number(row.deductions || 0),
      netPay: Number(row.net_pay || 0),
      month: row.period_month,
      year: row.period_year,
    }));

    return res.status(200).json({ summary, rows: formattedRows });
  } catch (error) {
    return res.status(500).json({ message: "Failed to generate report" });
  }
}

/**
 * GET /api/hr/reports/leave
 *
 * Generates organization-wide leave usage report.
 * Supports filters: year (4-digit), departmentId, leaveType, status.
 */
async function getLeaveReport(req, res) {
  const { year, departmentId, leaveType, status } = req.query;

  // Validate filters
  const errors = [];
  const yearErr = validateYear(year);
  if (yearErr) errors.push(yearErr);
  const deptErr = validateDepartmentId(departmentId);
  if (deptErr) errors.push(deptErr);
  const leaveTypeErr = validateLeaveType(leaveType);
  if (leaveTypeErr) errors.push(leaveTypeErr);
  const statusErr = validateStatus(status, VALID_LEAVE_STATUSES, "leave");
  if (statusErr) errors.push(statusErr);

  if (errors.length > 0) {
    return res.status(400).json({ message: "Invalid filter parameters", details: errors });
  }

  try {
    const filters = {};
    if (year) filters.year = Number(year);
    if (departmentId) filters.departmentId = Number(departmentId);
    if (leaveType) filters.leaveType = leaveType;
    if (status) filters.status = status;

    const rows = await hrReportModel.fetchLeaveReport(filters);

    // Compute summary
    let approved = 0;
    let rejected = 0;
    let pending = 0;
    let totalDaysTaken = 0;

    for (const row of rows) {
      if (row.status === "approved") {
        approved++;
        totalDaysTaken += Number(row.total_days || 0);
      } else if (row.status === "rejected") {
        rejected++;
      } else if (row.status === "pending") {
        pending++;
      }
    }

    const summary = {
      totalApplications: rows.length,
      approved,
      rejected,
      pending,
      totalDaysTaken,
    };

    // Compute byType breakdown
    const typeMap = {};
    for (const row of rows) {
      const type = row.leave_type;
      if (!typeMap[type]) {
        typeMap[type] = { leaveType: type, count: 0, totalDays: 0 };
      }
      typeMap[type].count++;
      if (row.status === "approved") {
        typeMap[type].totalDays += Number(row.total_days || 0);
      }
    }
    const byType = Object.values(typeMap);

    // Format rows for response
    const formattedRows = rows.map((row) => ({
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      department: row.department_id,
      leaveType: row.leave_type,
      startDate: row.start_date,
      endDate: row.end_date,
      days: Number(row.total_days || 0),
      status: row.status,
      reason: row.reason,
    }));

    return res.status(200).json({ summary, byType, rows: formattedRows });
  } catch (error) {
    return res.status(500).json({ message: "Failed to generate report" });
  }
}

/**
 * GET /api/hr/reports/employees
 *
 * Generates organization-wide employee roster report.
 * Supports filters: departmentId, status (active/inactive).
 */
async function getEmployeeReport(req, res) {
  const { departmentId, status } = req.query;

  // Validate filters
  const errors = [];
  const deptErr = validateDepartmentId(departmentId);
  if (deptErr) errors.push(deptErr);
  const statusErr = validateStatus(status, VALID_EMPLOYEE_STATUSES, "employee");
  if (statusErr) errors.push(statusErr);

  if (errors.length > 0) {
    return res.status(400).json({ message: "Invalid filter parameters", details: errors });
  }

  try {
    const filters = {};
    if (departmentId) filters.departmentId = Number(departmentId);
    if (status) filters.status = status;

    const rows = await hrReportModel.fetchEmployeeReport(filters);

    // Compute summary
    let activeCount = 0;
    let inactiveCount = 0;
    const deptMap = {};

    for (const row of rows) {
      if (row.status === "active") {
        activeCount++;
      } else if (row.status === "inactive") {
        inactiveCount++;
      }

      const dept = row.department || "Unassigned";
      if (!deptMap[dept]) {
        deptMap[dept] = { department: dept, count: 0 };
      }
      deptMap[dept].count++;
    }

    const summary = {
      totalEmployees: rows.length,
      activeCount,
      inactiveCount,
      departmentBreakdown: Object.values(deptMap),
    };

    // Format rows for response
    const formattedRows = rows.map((row) => ({
      employeeId: row.employee_id,
      employeeCode: row.employee_code,
      name: row.name,
      email: row.email,
      phone: row.phone,
      department: row.department,
      hireDate: row.hire_date,
      baseSalary: Number(row.base_salary || 0),
      status: row.status,
    }));

    return res.status(200).json({ summary, rows: formattedRows });
  } catch (error) {
    return res.status(500).json({ message: "Failed to generate report" });
  }
}

/**
 * GET /api/hr/reports/loans
 *
 * Generates organization-wide loan status report.
 * Supports filters: status (pending/approved/rejected).
 */
async function getLoanReport(req, res) {
  const { status } = req.query;

  // Validate filters
  const errors = [];
  const statusErr = validateStatus(status, VALID_LOAN_STATUSES, "loan");
  if (statusErr) errors.push(statusErr);

  if (errors.length > 0) {
    return res.status(400).json({ message: "Invalid filter parameters", details: errors });
  }

  try {
    const filters = {};
    if (status) filters.status = status;

    const rows = await hrReportModel.fetchLoanReport(filters);

    // Compute summary
    let totalApproved = 0;
    let totalPending = 0;
    let totalRejected = 0;
    let totalDisbursed = 0;
    let totalOutstanding = 0;
    let totalRepaid = 0;

    for (const row of rows) {
      if (row.status === "approved") {
        totalApproved++;
        totalDisbursed += Number(row.requested_amount || 0);
      } else if (row.status === "pending") {
        totalPending++;
      } else if (row.status === "rejected") {
        totalRejected++;
      }
      totalOutstanding += Number(row.outstanding_balance || 0);
      totalRepaid += Number(row.total_paid || 0);
    }

    const summary = {
      totalLoans: rows.length,
      totalApproved,
      totalPending,
      totalRejected,
      totalDisbursed,
      totalOutstanding,
      totalRepaid,
    };

    // Format rows for response
    const formattedRows = rows.map((row) => ({
      loanId: row.loan_id,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      requestedAmount: Number(row.requested_amount || 0),
      monthlyInstallment: Number(row.monthly_installment || 0),
      totalPaid: Number(row.total_paid || 0),
      outstandingBalance: Number(row.outstanding_balance || 0),
      repaymentMonths: Number(row.repayment_months || 0),
      status: row.status,
      createdAt: row.created_at,
      approvedAt: row.approved_at || null,
    }));

    return res.status(200).json({ summary, rows: formattedRows });
  } catch (error) {
    return res.status(500).json({ message: "Failed to generate report" });
  }
}

/**
 * GET /api/hr/reports/advances
 *
 * Generates organization-wide salary advance report.
 * Supports filters: status (pending/approved/rejected), month (YYYY-MM), year (4-digit).
 */
async function getAdvanceReport(req, res) {
  const { status, month, year } = req.query;

  // Validate filters
  const errors = [];
  const statusErr = validateStatus(status, VALID_ADVANCE_STATUSES, "advance");
  if (statusErr) errors.push(statusErr);
  const monthErr = validateMonth(month);
  if (monthErr) errors.push(monthErr);
  const yearErr = validateYear(year);
  if (yearErr) errors.push(yearErr);

  if (errors.length > 0) {
    return res.status(400).json({ message: "Invalid filter parameters", details: errors });
  }

  try {
    const filters = {};
    if (status) filters.status = status;
    if (month) filters.month = month;
    if (year) filters.year = Number(year);

    const rows = await hrReportModel.fetchAdvanceReport(filters);

    // Compute summary
    let totalApproved = 0;
    let totalPending = 0;
    let totalRejected = 0;
    let totalAmount = 0;

    for (const row of rows) {
      if (row.status === "approved") {
        totalApproved++;
        totalAmount += Number(row.amount || 0);
      } else if (row.status === "pending") {
        totalPending++;
      } else if (row.status === "rejected") {
        totalRejected++;
      }
    }

    const summary = {
      totalRequests: rows.length,
      totalApproved,
      totalPending,
      totalRejected,
      totalAmount,
    };

    // Format rows for response
    const formattedRows = rows.map((row) => ({
      advanceId: row.advance_id,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      amount: Number(row.amount || 0),
      reason: row.reason,
      status: row.status,
      requestedAt: row.requested_at,
      processedAt: row.processed_at || null,
    }));

    return res.status(200).json({ summary, rows: formattedRows });
  } catch (error) {
    return res.status(500).json({ message: "Failed to generate report" });
  }
}

// --- Personal Report Endpoints (Staff-scoped) ---

/**
 * GET /api/hr/reports/my/payroll
 *
 * Generates personal payroll summary for the authenticated staff member.
 * Supports filters: month (YYYY-MM), year (4-digit).
 */
async function getMyPayrollReport(req, res) {
  const staffId = req.user.staffId;

  if (!staffId) {
    return res.status(400).json({ message: "Staff record not linked to user account" });
  }

  const { month, year } = req.query;

  // Validate filters
  const errors = [];
  const monthErr = validateMonth(month);
  if (monthErr) errors.push(monthErr);
  const yearErr = validateYear(year);
  if (yearErr) errors.push(yearErr);

  if (errors.length > 0) {
    return res.status(400).json({ message: "Invalid filter parameters", details: errors });
  }

  try {
    const filters = {};
    if (month) filters.month = month;
    if (year) filters.year = Number(year);

    const rows = await hrReportModel.fetchPayrollReportForStaff(staffId, filters);

    // Compute summary
    const employeeIds = new Set();
    let totalGrossPay = 0;
    let totalDeductions = 0;
    let totalNetPay = 0;

    for (const row of rows) {
      totalGrossPay += Number(row.base_salary || 0) + Number(row.allowances || 0);
      totalDeductions += Number(row.deductions || 0);
      totalNetPay += Number(row.net_pay || 0);
      employeeIds.add(row.employee_id);
    }

    const summary = {
      totalGrossPay,
      totalDeductions,
      totalNetPay,
      employeeCount: employeeIds.size,
      payslipCount: rows.length,
    };

    // Format rows for response
    const formattedRows = rows.map((row) => ({
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      department: row.department_id,
      baseSalary: Number(row.base_salary || 0),
      allowances: Number(row.allowances || 0),
      deductions: Number(row.deductions || 0),
      netPay: Number(row.net_pay || 0),
      month: row.period_month,
      year: row.period_year,
    }));

    return res.status(200).json({ summary, rows: formattedRows });
  } catch (error) {
    return res.status(500).json({ message: "Failed to generate report" });
  }
}

/**
 * GET /api/hr/reports/my/leave
 *
 * Generates personal leave summary for the authenticated staff member.
 * Supports filters: year (4-digit).
 */
async function getMyLeaveReport(req, res) {
  const staffId = req.user.staffId;

  if (!staffId) {
    return res.status(400).json({ message: "Staff record not linked to user account" });
  }

  const { year } = req.query;

  // Validate filters
  const errors = [];
  const yearErr = validateYear(year);
  if (yearErr) errors.push(yearErr);

  if (errors.length > 0) {
    return res.status(400).json({ message: "Invalid filter parameters", details: errors });
  }

  try {
    const filters = {};
    if (year) filters.year = Number(year);

    const rows = await hrReportModel.fetchLeaveReportForStaff(staffId, filters);

    // Compute summary
    let approved = 0;
    let rejected = 0;
    let pending = 0;
    let totalDaysTaken = 0;

    for (const row of rows) {
      if (row.status === "approved") {
        approved++;
        totalDaysTaken += Number(row.total_days || 0);
      } else if (row.status === "rejected") {
        rejected++;
      } else if (row.status === "pending") {
        pending++;
      }
    }

    const summary = {
      totalApplications: rows.length,
      approved,
      rejected,
      pending,
      totalDaysTaken,
    };

    // Compute byType breakdown
    const typeMap = {};
    for (const row of rows) {
      const type = row.leave_type;
      if (!typeMap[type]) {
        typeMap[type] = { leaveType: type, count: 0, totalDays: 0 };
      }
      typeMap[type].count++;
      if (row.status === "approved") {
        typeMap[type].totalDays += Number(row.total_days || 0);
      }
    }
    const byType = Object.values(typeMap);

    // Format rows for response
    const formattedRows = rows.map((row) => ({
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      department: row.department_id,
      leaveType: row.leave_type,
      startDate: row.start_date,
      endDate: row.end_date,
      days: Number(row.total_days || 0),
      status: row.status,
      reason: row.reason,
    }));

    return res.status(200).json({ summary, byType, rows: formattedRows });
  } catch (error) {
    return res.status(500).json({ message: "Failed to generate report" });
  }
}

/**
 * GET /api/hr/reports/my/loans
 *
 * Generates personal loan summary for the authenticated staff member.
 * No filters required.
 */
async function getMyLoanReport(req, res) {
  const staffId = req.user.staffId;

  if (!staffId) {
    return res.status(400).json({ message: "Staff record not linked to user account" });
  }

  try {
    const rows = await hrReportModel.fetchLoanReportForStaff(staffId);

    // Compute summary
    let totalApproved = 0;
    let totalPending = 0;
    let totalRejected = 0;
    let totalDisbursed = 0;
    let totalOutstanding = 0;
    let totalRepaid = 0;

    for (const row of rows) {
      if (row.status === "approved") {
        totalApproved++;
        totalDisbursed += Number(row.requested_amount || 0);
      } else if (row.status === "pending") {
        totalPending++;
      } else if (row.status === "rejected") {
        totalRejected++;
      }
      totalOutstanding += Number(row.outstanding_balance || 0);
      totalRepaid += Number(row.total_paid || 0);
    }

    const summary = {
      totalLoans: rows.length,
      totalApproved,
      totalPending,
      totalRejected,
      totalDisbursed,
      totalOutstanding,
      totalRepaid,
    };

    // Format rows for response
    const formattedRows = rows.map((row) => ({
      loanId: row.loan_id,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      requestedAmount: Number(row.requested_amount || 0),
      monthlyInstallment: Number(row.monthly_installment || 0),
      totalPaid: Number(row.total_paid || 0),
      outstandingBalance: Number(row.outstanding_balance || 0),
      repaymentMonths: Number(row.repayment_months || 0),
      status: row.status,
      createdAt: row.created_at,
      approvedAt: row.approved_at || null,
    }));

    return res.status(200).json({ summary, rows: formattedRows });
  } catch (error) {
    return res.status(500).json({ message: "Failed to generate report" });
  }
}

// --- Organizational Export Endpoints ---

/**
 * GET /api/hr/reports/payroll/export
 *
 * Exports organization-wide payroll report as Excel or CSV.
 * Supports filters: month (YYYY-MM), year (4-digit), departmentId (positive int).
 * Query param: format ("excel" or "csv", defaults to "excel").
 */
async function exportPayrollReport(req, res) {
  const format = req.query.format || "excel";

  // Validate format first (before any DB call)
  const formatErr = validateFormat(format);
  if (formatErr) {
    return res.status(400).json({ message: formatErr });
  }

  const { month, year, departmentId } = req.query;

  // Validate filters
  const errors = [];
  const monthErr = validateMonth(month);
  if (monthErr) errors.push(monthErr);
  const yearErr = validateYear(year);
  if (yearErr) errors.push(yearErr);
  const deptErr = validateDepartmentId(departmentId);
  if (deptErr) errors.push(deptErr);

  if (errors.length > 0) {
    return res.status(400).json({ message: "Invalid filter parameters", details: errors });
  }

  try {
    const filters = {};
    if (month) filters.month = month;
    if (year) filters.year = Number(year);
    if (departmentId) filters.departmentId = Number(departmentId);

    const rows = await hrReportModel.fetchPayrollReport(filters);

    // Format rows for export
    const formattedRows = rows.map((row) => ({
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      department: row.department_id,
      baseSalary: Number(row.base_salary || 0),
      allowances: Number(row.allowances || 0),
      deductions: Number(row.deductions || 0),
      netPay: Number(row.net_pay || 0),
      month: row.period_month,
      year: row.period_year,
    }));

    const columns = [
      { header: "Employee ID", key: "employeeId", width: 15 },
      { header: "Name", key: "employeeName", width: 25 },
      { header: "Department", key: "department", width: 20 },
      { header: "Base Salary", key: "baseSalary", width: 15 },
      { header: "Allowances", key: "allowances", width: 15 },
      { header: "Deductions", key: "deductions", width: 15 },
      { header: "Net Pay", key: "netPay", width: 15 },
      { header: "Month", key: "month", width: 10 },
      { header: "Year", key: "year", width: 10 },
    ];

    const fileName = `payroll-report-${month || "all"}`;

    if (format === "csv") {
      return exportToCsv(res, { columns, rows: formattedRows, fileName });
    }
    return await exportToExcel(res, { sheetName: "Payroll Report", columns, rows: formattedRows, fileName });
  } catch (error) {
    return res.status(500).json({ message: "Failed to export report" });
  }
}

/**
 * GET /api/hr/reports/leave/export
 *
 * Exports organization-wide leave report as Excel or CSV.
 * Supports filters: year (4-digit), departmentId, leaveType, status.
 * Query param: format ("excel" or "csv", defaults to "excel").
 */
async function exportLeaveReport(req, res) {
  const format = req.query.format || "excel";

  const formatErr = validateFormat(format);
  if (formatErr) {
    return res.status(400).json({ message: formatErr });
  }

  const { year, departmentId, leaveType, status } = req.query;

  // Validate filters
  const errors = [];
  const yearErr = validateYear(year);
  if (yearErr) errors.push(yearErr);
  const deptErr = validateDepartmentId(departmentId);
  if (deptErr) errors.push(deptErr);
  const leaveTypeErr = validateLeaveType(leaveType);
  if (leaveTypeErr) errors.push(leaveTypeErr);
  const statusErr = validateStatus(status, VALID_LEAVE_STATUSES, "leave");
  if (statusErr) errors.push(statusErr);

  if (errors.length > 0) {
    return res.status(400).json({ message: "Invalid filter parameters", details: errors });
  }

  try {
    const filters = {};
    if (year) filters.year = Number(year);
    if (departmentId) filters.departmentId = Number(departmentId);
    if (leaveType) filters.leaveType = leaveType;
    if (status) filters.status = status;

    const rows = await hrReportModel.fetchLeaveReport(filters);

    // Format rows for export
    const formattedRows = rows.map((row) => ({
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      department: row.department_id,
      leaveType: row.leave_type,
      startDate: row.start_date,
      endDate: row.end_date,
      days: Number(row.total_days || 0),
      status: row.status,
      reason: row.reason,
    }));

    const columns = [
      { header: "Employee ID", key: "employeeId", width: 15 },
      { header: "Name", key: "employeeName", width: 25 },
      { header: "Department", key: "department", width: 20 },
      { header: "Leave Type", key: "leaveType", width: 20 },
      { header: "Start Date", key: "startDate", width: 15 },
      { header: "End Date", key: "endDate", width: 15 },
      { header: "Days", key: "days", width: 10 },
      { header: "Status", key: "status", width: 12 },
      { header: "Reason", key: "reason", width: 30 },
    ];

    const fileName = `leave-report-${year || "all"}`;

    if (format === "csv") {
      return exportToCsv(res, { columns, rows: formattedRows, fileName });
    }
    return await exportToExcel(res, { sheetName: "Leave Report", columns, rows: formattedRows, fileName });
  } catch (error) {
    return res.status(500).json({ message: "Failed to export report" });
  }
}

/**
 * GET /api/hr/reports/employees/export
 *
 * Exports organization-wide employee roster as Excel or CSV.
 * Supports filters: departmentId, status (active/inactive).
 * Query param: format ("excel" or "csv", defaults to "excel").
 */
async function exportEmployeeReport(req, res) {
  const format = req.query.format || "excel";

  const formatErr = validateFormat(format);
  if (formatErr) {
    return res.status(400).json({ message: formatErr });
  }

  const { departmentId, status } = req.query;

  // Validate filters
  const errors = [];
  const deptErr = validateDepartmentId(departmentId);
  if (deptErr) errors.push(deptErr);
  const statusErr = validateStatus(status, VALID_EMPLOYEE_STATUSES, "employee");
  if (statusErr) errors.push(statusErr);

  if (errors.length > 0) {
    return res.status(400).json({ message: "Invalid filter parameters", details: errors });
  }

  try {
    const filters = {};
    if (departmentId) filters.departmentId = Number(departmentId);
    if (status) filters.status = status;

    const rows = await hrReportModel.fetchEmployeeReport(filters);

    // Format rows for export
    const formattedRows = rows.map((row) => ({
      employeeId: row.employee_id,
      employeeCode: row.employee_code,
      name: row.name,
      email: row.email,
      phone: row.phone,
      department: row.department,
      hireDate: row.hire_date,
      baseSalary: Number(row.base_salary || 0),
      status: row.status,
    }));

    const columns = [
      { header: "Employee ID", key: "employeeId", width: 15 },
      { header: "Code", key: "employeeCode", width: 15 },
      { header: "Name", key: "name", width: 25 },
      { header: "Email", key: "email", width: 30 },
      { header: "Phone", key: "phone", width: 15 },
      { header: "Department", key: "department", width: 20 },
      { header: "Hire Date", key: "hireDate", width: 15 },
      { header: "Base Salary", key: "baseSalary", width: 15 },
      { header: "Status", key: "status", width: 12 },
    ];

    const fileName = `employee-report-${status || "all"}`;

    if (format === "csv") {
      return exportToCsv(res, { columns, rows: formattedRows, fileName });
    }
    return await exportToExcel(res, { sheetName: "Employee Report", columns, rows: formattedRows, fileName });
  } catch (error) {
    return res.status(500).json({ message: "Failed to export report" });
  }
}

/**
 * GET /api/hr/reports/loans/export
 *
 * Exports organization-wide loan report as Excel or CSV.
 * Supports filters: status (pending/approved/rejected).
 * Query param: format ("excel" or "csv", defaults to "excel").
 */
async function exportLoanReport(req, res) {
  const format = req.query.format || "excel";

  const formatErr = validateFormat(format);
  if (formatErr) {
    return res.status(400).json({ message: formatErr });
  }

  const { status } = req.query;

  // Validate filters
  const errors = [];
  const statusErr = validateStatus(status, VALID_LOAN_STATUSES, "loan");
  if (statusErr) errors.push(statusErr);

  if (errors.length > 0) {
    return res.status(400).json({ message: "Invalid filter parameters", details: errors });
  }

  try {
    const filters = {};
    if (status) filters.status = status;

    const rows = await hrReportModel.fetchLoanReport(filters);

    // Format rows for export
    const formattedRows = rows.map((row) => ({
      loanId: row.loan_id,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      requestedAmount: Number(row.requested_amount || 0),
      monthlyInstallment: Number(row.monthly_installment || 0),
      totalPaid: Number(row.total_paid || 0),
      outstandingBalance: Number(row.outstanding_balance || 0),
      repaymentMonths: Number(row.repayment_months || 0),
      status: row.status,
      createdAt: row.created_at,
      approvedAt: row.approved_at || null,
    }));

    const columns = [
      { header: "Loan ID", key: "loanId", width: 12 },
      { header: "Employee ID", key: "employeeId", width: 15 },
      { header: "Name", key: "employeeName", width: 25 },
      { header: "Amount", key: "requestedAmount", width: 15 },
      { header: "Monthly Installment", key: "monthlyInstallment", width: 20 },
      { header: "Total Paid", key: "totalPaid", width: 15 },
      { header: "Outstanding", key: "outstandingBalance", width: 15 },
      { header: "Months", key: "repaymentMonths", width: 10 },
      { header: "Status", key: "status", width: 12 },
      { header: "Created", key: "createdAt", width: 20 },
      { header: "Approved", key: "approvedAt", width: 20 },
    ];

    const fileName = `loan-report-${status || "all"}`;

    if (format === "csv") {
      return exportToCsv(res, { columns, rows: formattedRows, fileName });
    }
    return await exportToExcel(res, { sheetName: "Loan Report", columns, rows: formattedRows, fileName });
  } catch (error) {
    return res.status(500).json({ message: "Failed to export report" });
  }
}

/**
 * GET /api/hr/reports/advances/export
 *
 * Exports organization-wide salary advance report as Excel or CSV.
 * Supports filters: status (pending/approved/rejected), month (YYYY-MM), year (4-digit).
 * Query param: format ("excel" or "csv", defaults to "excel").
 */
async function exportAdvanceReport(req, res) {
  const format = req.query.format || "excel";

  const formatErr = validateFormat(format);
  if (formatErr) {
    return res.status(400).json({ message: formatErr });
  }

  const { status, month, year } = req.query;

  // Validate filters
  const errors = [];
  const statusErr = validateStatus(status, VALID_ADVANCE_STATUSES, "advance");
  if (statusErr) errors.push(statusErr);
  const monthErr = validateMonth(month);
  if (monthErr) errors.push(monthErr);
  const yearErr = validateYear(year);
  if (yearErr) errors.push(yearErr);

  if (errors.length > 0) {
    return res.status(400).json({ message: "Invalid filter parameters", details: errors });
  }

  try {
    const filters = {};
    if (status) filters.status = status;
    if (month) filters.month = month;
    if (year) filters.year = Number(year);

    const rows = await hrReportModel.fetchAdvanceReport(filters);

    // Format rows for export
    const formattedRows = rows.map((row) => ({
      advanceId: row.advance_id,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      amount: Number(row.amount || 0),
      reason: row.reason,
      status: row.status,
      requestedAt: row.requested_at,
      processedAt: row.processed_at || null,
    }));

    const columns = [
      { header: "Advance ID", key: "advanceId", width: 12 },
      { header: "Employee ID", key: "employeeId", width: 15 },
      { header: "Name", key: "employeeName", width: 25 },
      { header: "Amount", key: "amount", width: 15 },
      { header: "Reason", key: "reason", width: 30 },
      { header: "Status", key: "status", width: 12 },
      { header: "Requested At", key: "requestedAt", width: 20 },
      { header: "Processed At", key: "processedAt", width: 20 },
    ];

    const fileName = `advance-report-${month || "all"}`;

    if (format === "csv") {
      return exportToCsv(res, { columns, rows: formattedRows, fileName });
    }
    return await exportToExcel(res, { sheetName: "Advance Report", columns, rows: formattedRows, fileName });
  } catch (error) {
    return res.status(500).json({ message: "Failed to export report" });
  }
}

// --- Personal Export Endpoints (Staff-scoped) ---

/**
 * GET /api/hr/reports/my/payroll/export
 *
 * Exports personal payroll report for the authenticated staff member.
 * Supports filters: month (YYYY-MM), year (4-digit).
 * Query param: format ("excel" or "csv", defaults to "excel").
 */
async function exportMyPayrollReport(req, res) {
  const staffId = req.user.staffId;

  if (!staffId) {
    return res.status(400).json({ message: "Staff record not linked to user account" });
  }

  const format = req.query.format || "excel";

  const formatErr = validateFormat(format);
  if (formatErr) {
    return res.status(400).json({ message: formatErr });
  }

  const { month, year } = req.query;

  // Validate filters
  const errors = [];
  const monthErr = validateMonth(month);
  if (monthErr) errors.push(monthErr);
  const yearErr = validateYear(year);
  if (yearErr) errors.push(yearErr);

  if (errors.length > 0) {
    return res.status(400).json({ message: "Invalid filter parameters", details: errors });
  }

  try {
    const filters = {};
    if (month) filters.month = month;
    if (year) filters.year = Number(year);

    const rows = await hrReportModel.fetchPayrollReportForStaff(staffId, filters);

    // Format rows for export
    const formattedRows = rows.map((row) => ({
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      department: row.department_id,
      baseSalary: Number(row.base_salary || 0),
      allowances: Number(row.allowances || 0),
      deductions: Number(row.deductions || 0),
      netPay: Number(row.net_pay || 0),
      month: row.period_month,
      year: row.period_year,
    }));

    const columns = [
      { header: "Employee ID", key: "employeeId", width: 15 },
      { header: "Name", key: "employeeName", width: 25 },
      { header: "Department", key: "department", width: 20 },
      { header: "Base Salary", key: "baseSalary", width: 15 },
      { header: "Allowances", key: "allowances", width: 15 },
      { header: "Deductions", key: "deductions", width: 15 },
      { header: "Net Pay", key: "netPay", width: 15 },
      { header: "Month", key: "month", width: 10 },
      { header: "Year", key: "year", width: 10 },
    ];

    const fileName = `my-payroll-report-${month || "all"}`;

    if (format === "csv") {
      return exportToCsv(res, { columns, rows: formattedRows, fileName });
    }
    return await exportToExcel(res, { sheetName: "My Payroll Report", columns, rows: formattedRows, fileName });
  } catch (error) {
    return res.status(500).json({ message: "Failed to export report" });
  }
}

/**
 * GET /api/hr/reports/my/leave/export
 *
 * Exports personal leave report for the authenticated staff member.
 * Supports filters: year (4-digit).
 * Query param: format ("excel" or "csv", defaults to "excel").
 */
async function exportMyLeaveReport(req, res) {
  const staffId = req.user.staffId;

  if (!staffId) {
    return res.status(400).json({ message: "Staff record not linked to user account" });
  }

  const format = req.query.format || "excel";

  const formatErr = validateFormat(format);
  if (formatErr) {
    return res.status(400).json({ message: formatErr });
  }

  const { year } = req.query;

  // Validate filters
  const errors = [];
  const yearErr = validateYear(year);
  if (yearErr) errors.push(yearErr);

  if (errors.length > 0) {
    return res.status(400).json({ message: "Invalid filter parameters", details: errors });
  }

  try {
    const filters = {};
    if (year) filters.year = Number(year);

    const rows = await hrReportModel.fetchLeaveReportForStaff(staffId, filters);

    // Format rows for export
    const formattedRows = rows.map((row) => ({
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      department: row.department_id,
      leaveType: row.leave_type,
      startDate: row.start_date,
      endDate: row.end_date,
      days: Number(row.total_days || 0),
      status: row.status,
      reason: row.reason,
    }));

    const columns = [
      { header: "Employee ID", key: "employeeId", width: 15 },
      { header: "Name", key: "employeeName", width: 25 },
      { header: "Department", key: "department", width: 20 },
      { header: "Leave Type", key: "leaveType", width: 20 },
      { header: "Start Date", key: "startDate", width: 15 },
      { header: "End Date", key: "endDate", width: 15 },
      { header: "Days", key: "days", width: 10 },
      { header: "Status", key: "status", width: 12 },
      { header: "Reason", key: "reason", width: 30 },
    ];

    const fileName = `my-leave-report-${year || "all"}`;

    if (format === "csv") {
      return exportToCsv(res, { columns, rows: formattedRows, fileName });
    }
    return await exportToExcel(res, { sheetName: "My Leave Report", columns, rows: formattedRows, fileName });
  } catch (error) {
    return res.status(500).json({ message: "Failed to export report" });
  }
}

/**
 * GET /api/hr/reports/my/loans/export
 *
 * Exports personal loan report for the authenticated staff member.
 * Query param: format ("excel" or "csv", defaults to "excel").
 */
async function exportMyLoanReport(req, res) {
  const staffId = req.user.staffId;

  if (!staffId) {
    return res.status(400).json({ message: "Staff record not linked to user account" });
  }

  const format = req.query.format || "excel";

  const formatErr = validateFormat(format);
  if (formatErr) {
    return res.status(400).json({ message: formatErr });
  }

  try {
    const rows = await hrReportModel.fetchLoanReportForStaff(staffId);

    // Format rows for export
    const formattedRows = rows.map((row) => ({
      loanId: row.loan_id,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      requestedAmount: Number(row.requested_amount || 0),
      monthlyInstallment: Number(row.monthly_installment || 0),
      totalPaid: Number(row.total_paid || 0),
      outstandingBalance: Number(row.outstanding_balance || 0),
      repaymentMonths: Number(row.repayment_months || 0),
      status: row.status,
      createdAt: row.created_at,
      approvedAt: row.approved_at || null,
    }));

    const columns = [
      { header: "Loan ID", key: "loanId", width: 12 },
      { header: "Employee ID", key: "employeeId", width: 15 },
      { header: "Name", key: "employeeName", width: 25 },
      { header: "Amount", key: "requestedAmount", width: 15 },
      { header: "Monthly Installment", key: "monthlyInstallment", width: 20 },
      { header: "Total Paid", key: "totalPaid", width: 15 },
      { header: "Outstanding", key: "outstandingBalance", width: 15 },
      { header: "Months", key: "repaymentMonths", width: 10 },
      { header: "Status", key: "status", width: 12 },
      { header: "Created", key: "createdAt", width: 20 },
      { header: "Approved", key: "approvedAt", width: 20 },
    ];

    const fileName = `my-loan-report-all`;

    if (format === "csv") {
      return exportToCsv(res, { columns, rows: formattedRows, fileName });
    }
    return await exportToExcel(res, { sheetName: "My Loan Report", columns, rows: formattedRows, fileName });
  } catch (error) {
    return res.status(500).json({ message: "Failed to export report" });
  }
}

module.exports = {
  getPayrollReport,
  getLeaveReport,
  getEmployeeReport,
  getLoanReport,
  getAdvanceReport,
  getMyPayrollReport,
  getMyLeaveReport,
  getMyLoanReport,
  exportPayrollReport,
  exportLeaveReport,
  exportEmployeeReport,
  exportLoanReport,
  exportAdvanceReport,
  exportMyPayrollReport,
  exportMyLeaveReport,
  exportMyLoanReport,
};
