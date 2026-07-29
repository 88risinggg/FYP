/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - SHARED
 * PURPOSE: Provides reusable payroll Calculation business or integration operations.
 * LAYER: Backend service - contains reusable business rules or external integrations.
 * FIND RELATED CODE: Use Find All References to locate controllers, workers, or services that call it.
 */
const { calculateEmployeePayroll } = require("./statutoryPayrollEngine");

const MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function resolveMonth(value) {
  const number = Number(value);
  if (Number.isInteger(number) && number >= 1 && number <= 12) return number;
  const index = MONTH_NAMES.indexOf(String(value || "").toLowerCase());
  return index >= 0 ? index + 1 : new Date().getMonth() + 1;
}

function money(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function calculatePayslipFromRow(row, staffProfile, ruleConfig, payrollRunId, createdBy) {
  const month = resolveMonth(row.payroll_month || row.period_month);
  const year = Number(row.payroll_year || row.period_year || new Date().getFullYear());
  const basicSalary = Number(row.basic_salary || staffProfile.base_salary || 0);
  const allowances = [
    ["Services Commission", row.services_commission],
    ["Product Commission", row.product_commission],
    ["Credit Commission", row.credit_commission],
    ["Allowance", row.allowance]
  ].filter(([, amount]) => Number(amount) > 0).map(([label, amount]) => ({ label, amount: Number(amount) }));
  const otherDeductions = [
    ["Loan", row.loan_deduction],
    ["Other deduction", row.other_deduction]
  ].filter(([, amount]) => Number(amount) > 0).map(([label, amount]) => ({ label, amount: Number(amount) }));
  const calculation = calculateEmployeePayroll({
    staff: { ...staffProfile, base_salary: basicSalary },
    month,
    year,
    allowances,
    otherDeductions,
    configuration: ruleConfig || {}
  });
  const now = new Date().toISOString();
  const donationAmount = calculation.selfHelpGroups.reduce((sum, item) => sum + item.amount, 0);

  return {
    payslip_id: `PS-${year}${String(month).padStart(2, "0")}-${staffProfile.employee_id}-${String(payrollRunId).slice(-6)}`,
    employee_id: staffProfile.employee_id,
    staff_email: staffProfile.email || "",
    staff_name: staffProfile.name,
    payroll_run_id: payrollRunId,
    period_month: month,
    period_year: year,
    basic_salary: calculation.basicSalary,
    services_commission: money(row.services_commission),
    product_commission: money(row.product_commission),
    credit_commission: money(row.credit_commission),
    allowance: money(row.allowance),
    gross_salary: calculation.grossSalary,
    cpf_employee_deduction: calculation.cpfEmployee,
    cpf_employer_contribution: calculation.cpfEmployer,
    sdl: calculation.sdl,
    loan_deduction: money(row.loan_deduction),
    other_deduction: money(row.other_deduction),
    donation_fund: calculation.selfHelpGroups.map((item) => item.fund).join(" + "),
    donation_amount: money(donationAmount),
    mbmf_amount: calculation.mbmfAmount,
    total_deductions: calculation.totalDeductions,
    net_pay: calculation.netSalary,
    deduction_breakdown: {
      ...calculation.deductionBreakdown,
      complianceExceptions: calculation.complianceExceptions,
      cpfTier: calculation.cpfTier,
      cpfWageBase: calculation.cpfWageBase,
      sdl: calculation.sdl
    },
    compliance_exceptions: calculation.complianceExceptions,
    status: calculation.complianceExceptions.length ? "Hold" : "Draft",
    created_at: now,
    created_by: createdBy,
    updated_at: now
  };
}

function calculatePayslipsFromRows(rows, staffProfiles, rateConfig, payrollRunId, createdBy) {
  const created = [];
  const skipped = [];
  for (const row of rows) {
    const staff = staffProfiles.find((item) =>
      String(item.email || "").toLowerCase() === String(row.email || "").toLowerCase() ||
      Number(item.employee_id) === Number(row.employee_id) ||
      (item.name && row.staff_name && item.name.toLowerCase() === row.staff_name.toLowerCase())
    );
    if (!staff) {
      skipped.push({ row_identifier: row.email || row.staff_id || row.staff_name, reason: "Staff profile not found" });
      continue;
    }
    created.push(calculatePayslipFromRow(row, staff, rateConfig, payrollRunId, createdBy));
  }
  return { created, skipped };
}

module.exports = { calculatePayslipFromRow, calculatePayslipsFromRows };
