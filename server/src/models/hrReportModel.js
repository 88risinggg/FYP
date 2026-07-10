const { pool } = require("../config/db");

/**
 * Fetch organization-wide payroll report with optional filters.
 * @param {Object} filters
 * @param {string} [filters.month] - Period in YYYY-MM format
 * @param {number|string} [filters.year] - 4-digit year
 * @param {number|string} [filters.departmentId] - Department ID
 * @returns {Promise<Array>} Payslip rows joined with staff info
 */
async function fetchPayrollReport({ month, year, departmentId } = {}) {
  let sql = `
    SELECT
      ps.payslip_id, p.staff_employee_id AS employee_id, s.name AS employee_name,
      s.department_id, s.base_salary, p.total_allowances AS allowances,
      p.total_deductions AS deductions, p.net_salary AS net_pay, 
      p.payroll_month AS period_month, p.payroll_year AS period_year,
      ps.status
    FROM payslip ps
    JOIN payroll p ON p.payroll_id = ps.payroll_payroll_id
    JOIN staff s ON s.employee_id = p.staff_employee_id
    WHERE 1=1
  `;
  const params = [];

  if (month) {
    sql += " AND DATE_FORMAT(CONCAT(p.payroll_year, '-', LPAD(p.payroll_month,2,'0'), '-01'), '%Y-%m') = ?";
    params.push(month);
  }
  if (year) {
    sql += " AND p.payroll_year = ?";
    params.push(year);
  }
  if (departmentId) {
    sql += " AND s.department_id = ?";
    params.push(departmentId);
  }

  sql += " ORDER BY p.payroll_year DESC, p.payroll_month DESC, s.name ASC";
  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * Fetch payroll report scoped to a specific staff member.
 * @param {number|string} staffId - The employee_id of the staff member
 * @param {Object} filters
 * @param {string} [filters.month] - Period in YYYY-MM format
 * @param {number|string} [filters.year] - 4-digit year
 * @returns {Promise<Array>} Payslip rows for the specified staff
 */
async function fetchPayrollReportForStaff(staffId, { month, year } = {}) {
  let sql = `
    SELECT
      ps.payslip_id, p.staff_employee_id AS employee_id, s.name AS employee_name,
      s.department_id, s.base_salary, p.total_allowances AS allowances,
      p.total_deductions AS deductions, p.net_salary AS net_pay, 
      p.payroll_month AS period_month, p.payroll_year AS period_year,
      ps.status
    FROM payslip ps
    JOIN payroll p ON p.payroll_id = ps.payroll_payroll_id
    JOIN staff s ON s.employee_id = p.staff_employee_id
    WHERE p.staff_employee_id = ?
  `;
  const params = [staffId];

  if (month) {
    sql += " AND DATE_FORMAT(CONCAT(p.payroll_year, '-', LPAD(p.payroll_month,2,'0'), '-01'), '%Y-%m') = ?";
    params.push(month);
  }
  if (year) {
    sql += " AND p.payroll_year = ?";
    params.push(year);
  }

  sql += " ORDER BY p.payroll_year DESC, p.payroll_month DESC";
  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * Fetch organization-wide leave report with optional filters.
 * @param {Object} filters
 * @param {number|string} [filters.year] - 4-digit year
 * @param {number|string} [filters.departmentId] - Department ID
 * @param {string} [filters.leaveType] - Leave type name
 * @param {string} [filters.status] - Leave application status
 * @returns {Promise<Array>} Leave application rows with staff and type info
 */
async function fetchLeaveReport({ year, departmentId, leaveType, status } = {}) {
  let sql = `
    SELECT
      la.id AS leave_application_id, la.staff_id AS employee_id,
      s.name AS employee_name, s.department_id,
      lt.name AS leave_type,
      la.start_date, la.end_date, la.total_days,
      la.status, la.reason
    FROM leave_application la
    JOIN staff s ON s.employee_id = la.staff_id
    JOIN leave_type lt ON lt.id = la.leave_type_id
    WHERE 1=1
  `;
  const params = [];

  if (year) {
    sql += " AND YEAR(la.start_date) = ?";
    params.push(year);
  }
  if (departmentId) {
    sql += " AND s.department_id = ?";
    params.push(departmentId);
  }
  if (leaveType) {
    sql += " AND lt.name = ?";
    params.push(leaveType);
  }
  if (status) {
    sql += " AND la.status = ?";
    params.push(status);
  }

  sql += " ORDER BY la.start_date DESC";
  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * Fetch leave report scoped to a specific staff member.
 * @param {number|string} staffId - The employee_id of the staff member
 * @param {Object} filters
 * @param {number|string} [filters.year] - 4-digit year
 * @returns {Promise<Array>} Leave application rows for the specified staff
 */
async function fetchLeaveReportForStaff(staffId, { year } = {}) {
  let sql = `
    SELECT
      la.id AS leave_application_id, la.staff_id AS employee_id,
      s.name AS employee_name, s.department_id,
      lt.name AS leave_type,
      la.start_date, la.end_date, la.total_days,
      la.status, la.reason
    FROM leave_application la
    JOIN staff s ON s.employee_id = la.staff_id
    JOIN leave_type lt ON lt.id = la.leave_type_id
    WHERE la.staff_id = ?
  `;
  const params = [staffId];

  if (year) {
    sql += " AND YEAR(la.start_date) = ?";
    params.push(year);
  }

  sql += " ORDER BY la.start_date DESC";
  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * Fetch organization-wide employee roster report with optional filters.
 * @param {Object} filters
 * @param {number|string} [filters.departmentId] - Department ID
 * @param {string} [filters.status] - Employee status (e.g. "active", "inactive")
 * @returns {Promise<Array>} Employee rows with department info
 */
async function fetchEmployeeReport({ departmentId, status } = {}) {
  let sql = `
    SELECT
      s.employee_id, s.employee_code, s.name, s.email, s.phone,
      d.department_name AS department, s.hire_date, s.base_salary, s.status
    FROM staff s
    LEFT JOIN department d ON d.department_id = s.department_id
    WHERE 1=1
  `;
  const params = [];

  if (departmentId) {
    sql += " AND s.department_id = ?";
    params.push(departmentId);
  }
  if (status) {
    sql += " AND s.status = ?";
    params.push(status);
  }

  sql += " ORDER BY s.name ASC";
  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * Fetch organization-wide loan report with optional filters.
 * @param {Object} filters
 * @param {string} [filters.status] - Loan status (pending, approved, rejected)
 * @returns {Promise<Array>} Loan request rows with staff info
 */
async function fetchLoanReport({ status } = {}) {
  let sql = `
    SELECT
      lr.loan_id, lr.staff_employee_id AS employee_id,
      s.name AS employee_name,
      lr.requested_amount, lr.monthly_installment,
      lr.total_paid, lr.outstanding_balance,
      lr.repayment_months, lr.status,
      lr.created_at, lr.approved_at
    FROM loan_request lr
    JOIN staff s ON s.employee_id = lr.staff_employee_id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    sql += " AND lr.status = ?";
    params.push(status);
  }

  sql += " ORDER BY lr.created_at DESC";
  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * Fetch loan report scoped to a specific staff member.
 * @param {number|string} staffId - The employee_id of the staff member
 * @returns {Promise<Array>} Loan request rows for the specified staff
 */
async function fetchLoanReportForStaff(staffId) {
  const sql = `
    SELECT
      lr.loan_id, lr.staff_employee_id AS employee_id,
      s.name AS employee_name,
      lr.requested_amount, lr.monthly_installment,
      lr.total_paid, lr.outstanding_balance,
      lr.repayment_months, lr.status,
      lr.created_at, lr.approved_at
    FROM loan_request lr
    JOIN staff s ON s.employee_id = lr.staff_employee_id
    WHERE lr.staff_employee_id = ?
    ORDER BY lr.created_at DESC
  `;
  const [rows] = await pool.query(sql, [staffId]);
  return rows;
}

/**
 * Fetch organization-wide salary advance report with optional filters.
 * @param {Object} filters
 * @param {string} [filters.status] - Advance status (pending, approved, rejected)
 * @param {string} [filters.month] - Month filter in YYYY-MM format
 * @param {number|string} [filters.year] - 4-digit year
 * @returns {Promise<Array>} Advance request rows with staff info
 */
async function fetchAdvanceReport({ status, month, year } = {}) {
  let sql = `
    SELECT
      ar.request_id AS advance_id, ar.staff_employee_id AS employee_id,
      s.name AS employee_name,
      ar.requested_amount AS amount, ar.reason, ar.status,
      ar.created_at AS requested_at, ar.approved_at AS processed_at
    FROM advance_request ar
    JOIN staff s ON s.employee_id = ar.staff_employee_id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    sql += " AND ar.status = ?";
    params.push(status);
  }
  if (month) {
    sql += " AND DATE_FORMAT(ar.created_at, '%Y-%m') = ?";
    params.push(month);
  }
  if (year) {
    sql += " AND YEAR(ar.created_at) = ?";
    params.push(year);
  }

  sql += " ORDER BY ar.created_at DESC";
  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * Fetch advance report scoped to a specific staff member.
 * @param {number|string} staffId - The employee_id of the staff member
 * @returns {Promise<Array>} Advance request rows for the specified staff
 */
async function fetchAdvanceReportForStaff(staffId) {
  const sql = `
    SELECT
      ar.request_id AS advance_id, ar.staff_employee_id AS employee_id,
      s.name AS employee_name,
      ar.requested_amount AS amount, ar.reason, ar.status,
      ar.created_at AS requested_at, ar.approved_at AS processed_at
    FROM advance_request ar
    JOIN staff s ON s.employee_id = ar.staff_employee_id
    WHERE ar.staff_employee_id = ?
    ORDER BY ar.created_at DESC
  `;
  const [rows] = await pool.query(sql, [staffId]);
  return rows;
}

module.exports = {
  fetchPayrollReport,
  fetchPayrollReportForStaff,
  fetchLeaveReport,
  fetchLeaveReportForStaff,
  fetchEmployeeReport,
  fetchLoanReport,
  fetchLoanReportForStaff,
  fetchAdvanceReport,
  fetchAdvanceReportForStaff,
};
