export function toMoney(value) {
  const number = Number(value || 0);
  return Math.round(number * 100) / 100;
}

export function calculatePayroll(record, rates) {
  const basicSalary = toMoney(record.basic_salary);
  const servicesCommission = toMoney(record.services_commission);
  const productCommission = toMoney(record.product_commission);
  const creditCommission = toMoney(record.credit_commission);
  const allowance = toMoney(record.allowance);
  const loanDeduction = toMoney(record.loan_deduction);
  const otherDeduction = toMoney(record.other_deduction);
  const employeeCpf = toMoney(basicSalary * Number(rates.employeeCpfRate || 0));
  const employerCpf = toMoney(basicSalary * Number(rates.employerCpfRate || 0));
  const totalEarnings = toMoney(basicSalary + servicesCommission + productCommission + creditCommission + allowance);
  const totalDeductions = toMoney(loanDeduction + otherDeduction + employeeCpf);
  const netPay = toMoney(totalEarnings - totalDeductions);

  return {
    ...record,
    basic_salary: basicSalary,
    services_commission: servicesCommission,
    product_commission: productCommission,
    credit_commission: creditCommission,
    allowance,
    loan_deduction: loanDeduction,
    other_deduction: otherDeduction,
    employee_cpf: employeeCpf,
    employer_cpf: employerCpf,
    total_earnings: totalEarnings,
    total_deductions: totalDeductions,
    net_pay: netPay
  };
}

export function validatePayrollRecord(record) {
  const errors = [];
  if (!record.staff_name) errors.push("Missing staff name");
  if (!record.email) errors.push("Missing email");
  if (!Number(record.basic_salary)) errors.push("Missing basic salary");
  if (Number(record.basic_salary) < 0) errors.push("Negative salary amount");
  if (!Number.isFinite(Number(record.working_days)) || Number(record.working_days) < 0 || Number(record.working_days) > 31) {
    errors.push("Invalid working days");
  }
  return errors;
}
