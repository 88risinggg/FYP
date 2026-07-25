const asMoney = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

export function normalizePayrollItem(item, fallbackLabel = "Payroll item") {
  const source = item && typeof item === "object" ? item : {};
  return {
    ...source,
    label: String(source.label || source.name || source.type || fallbackLabel),
    rate: String(source.rate || "-"),
    amount: asMoney(source.amount)
  };
}

export function normalizeFinanceEmployee(employee, index = 0) {
  const source = employee && typeof employee === "object" ? employee : {};
  const id = source.id || source.employeeId || source.employee_code || source.staffEmployeeId || `EMP-${index + 1}`;
  return {
    ...source,
    id: String(id),
    name: String(source.name || source.staff_name || `Employee ${index + 1}`),
    department: String(source.department || source.department_name || ""),
    bankAccount: String(source.bankAccount || source.accountNo || source.account_no || ""),
    bankType: String(source.bankType || source.bank || ""),
    financeStatus: String(source.financeStatus || source.payslip_status || "Draft"),
    storedGrossPay: source.storedGrossPay == null ? undefined : asMoney(source.storedGrossPay),
    storedTotalDeductions: source.storedTotalDeductions == null ? undefined : asMoney(source.storedTotalDeductions),
    storedNetPay: source.storedNetPay == null ? undefined : asMoney(source.storedNetPay),
    complianceExceptions: Array.isArray(source.complianceExceptions) ? source.complianceExceptions.map(String) : [],
    earningItems: Array.isArray(source.earningItems) ? source.earningItems.map((item) => normalizePayrollItem(item, "Earning")) : [],
    deductionItems: Array.isArray(source.deductionItems) ? source.deductionItems.map((item) => normalizePayrollItem(item, "Deduction")) : [],
    employerItems: Array.isArray(source.employerItems) ? source.employerItems.map((item) => normalizePayrollItem(item, "Employer contribution")) : []
  };
}

export function normalizeFinancePayrollRun(run, index = 0) {
  const source = run && typeof run === "object" ? run : {};
  const month = Math.min(12, Math.max(1, Number(source.month) || new Date().getMonth() + 1));
  const year = Number(source.year) || new Date().getFullYear();
  return {
    ...source,
    id: String(source.id || `${month}_${year}` || `payroll-${index + 1}`),
    month,
    year,
    status: String(source.status || "Draft"),
    employees: Array.isArray(source.employees) ? source.employees.map(normalizeFinanceEmployee) : [],
    timeline: Array.isArray(source.timeline) ? source.timeline.filter(Boolean) : []
  };
}

export function normalizeFinancePayrollRuns(runs, fallback = []) {
  if (!Array.isArray(runs)) return fallback.map(normalizeFinancePayrollRun);
  const normalized = runs.filter((run) => run && typeof run === "object").map(normalizeFinancePayrollRun);
  return normalized.length ? normalized : fallback.map(normalizeFinancePayrollRun);
}
