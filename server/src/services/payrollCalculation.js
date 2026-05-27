/**
 * Payroll Calculation Service
 * Handles all payslip calculations including CPF, SDL, deductions, and net pay
 */

/**
 * Calculate a single payslip from uploaded payroll row data
 * @param {Object} row - Payroll row from upload (contains salary components)
 * @param {Object} staffProfile - Staff profile object with base_salary
 * @param {Object} rateConfig - Payroll rate configuration (CPF, SDL rates)
 * @param {string} payrollRunId - Associated payroll run ID
 * @param {string} createdBy - Email of user creating the payslip
 * @returns {Object} Calculated payslip object
 */
function calculatePayslipFromRow(row, staffProfile, rateConfig, payrollRunId, createdBy) {
  const now = new Date().toISOString();

  // Extract salary components from row (with defaults)
  const basicSalary = parseFloat(row.basic_salary) || parseFloat(staffProfile.base_salary) || 0;
  const servicesCommission = parseFloat(row.services_commission) || 0;
  const productCommission = parseFloat(row.product_commission) || 0;
  const creditCommission = parseFloat(row.credit_commission) || 0;
  const allowance = parseFloat(row.allowance) || 0;
  const loanDeduction = parseFloat(row.loan_deduction) || 0;
  const otherDeduction = parseFloat(row.other_deduction) || 0;

  // Calculate gross salary (before deductions)
  const grossSalary = basicSalary + servicesCommission + productCommission + creditCommission + allowance;

  // Calculate CPF (employee contribution - deducted from employee)
  const cpfEmployeeDeduction = grossSalary * rateConfig.employeeCpfRate;

  // Calculate CPF employer contribution (informational, not deducted from employee)
  const cpfEmployerContribution = grossSalary * rateConfig.employerCpfRate;

  // Calculate SDL (Skills Development Levy - on employer contribution)
  const sdlAmount = cpfEmployerContribution * rateConfig.sdlRate;

  // Total deductions from employee pay
  const totalDeductions = cpfEmployeeDeduction + loanDeduction + otherDeduction;

  // Net pay after all deductions
  const netPay = grossSalary - totalDeductions;

  // Payslip ID generation (format: PS-YYYYMMDD-STAFFID-RUNID)
  const now_date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const payslipId = `PS-${now_date}-${staffProfile.staff_id}-${payrollRunId.slice(-6)}`;

  // Extract period from row if available, otherwise use current month
  const periodMonth = row.payroll_month || new Date().toLocaleString('en-US', { month: 'long' });
  const periodYear = new Date().getFullYear();

  return {
    payslip_id: payslipId,
    staff_id: staffProfile.staff_id,
    staff_email: staffProfile.email || "",
    staff_name: staffProfile.staff_name,
    payroll_run_id: payrollRunId,
    period_month: periodMonth,
    period_year: periodYear,
    
    // Salary components
    basic_salary: basicSalary,
    services_commission: servicesCommission,
    product_commission: productCommission,
    credit_commission: creditCommission,
    allowance: allowance,
    gross_salary: grossSalary,
    
    // Deductions
    cpf_employee_deduction: parseFloat(cpfEmployeeDeduction.toFixed(2)),
    cpf_employer_contribution: parseFloat(cpfEmployerContribution.toFixed(2)),
    sdl: parseFloat(sdlAmount.toFixed(2)),
    loan_deduction: loanDeduction,
    other_deduction: otherDeduction,
    total_deductions: parseFloat(totalDeductions.toFixed(2)),
    
    // Net pay
    net_pay: parseFloat(netPay.toFixed(2)),
    
    // Status tracking
    status: 'draft',
    
    // Finance approval
    finance_approval: false,
    finance_approved_at: null,
    finance_approved_by: null,
    finance_rejection_reason: null,
    
    // Admin approval
    admin_approval: false,
    admin_approved_at: null,
    admin_approved_by: null,
    admin_rejection_reason: null,
    
    // Sent to staff
    sent_to_staff_at: null,
    
    // Metadata
    created_at: now,
    created_by: createdBy,
    updated_at: now
  };
}

/**
 * Calculate payslips from multiple payroll rows
 * @param {Array} rows - Array of payroll row data
 * @param {Array} staffProfiles - Array of staff profiles to match against
 * @param {Object} rateConfig - Payroll rate configuration
 * @param {string} payrollRunId - Associated payroll run ID
 * @param {string} createdBy - Email of user creating the payslips
 * @returns {Object} { created: Array, skipped: Array }
 */
function calculatePayslipsFromRows(rows, staffProfiles, rateConfig, payrollRunId, createdBy) {
  const created = [];
  const skipped = [];

  rows.forEach((row) => {
    // Match staff by email or staff_id
    const staff = staffProfiles.find(
      s => s.email === row.email || s.staff_id === row.staff_id || s.staff_name.toLowerCase() === row.staff_name?.toLowerCase()
    );

    if (!staff) {
      skipped.push({
        row_identifier: row.email || row.staff_id || row.staff_name,
        reason: 'Staff profile not found'
      });
      return;
    }

    const payslip = calculatePayslipFromRow(row, staff, rateConfig, payrollRunId, createdBy);
    created.push(payslip);
  });

  return { created, skipped };
}

module.exports = {
  calculatePayslipFromRow,
  calculatePayslipsFromRows
};
