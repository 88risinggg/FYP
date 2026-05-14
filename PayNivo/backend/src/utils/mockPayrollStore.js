export const payrollRateConfig = {
  employeeCpfRate: 0.2,
  employerCpfRate: 0.17,
  sdlRate: 0.0025,
  defaultAllowanceRate: 100,
  defaultDeductionRate: 50
};

export const payrollRecords = [
  {
    id: 1,
    staff_id: "STF001",
    staff_name: "Siti Staff",
    email: "siti.staff@paynivo.demo",
    payroll_month: "May 2026",
    basic_salary: 3000,
    services_commission: 100,
    product_commission: 0,
    credit_commission: 0,
    allowance: 100,
    loan_deduction: 50,
    other_deduction: 0,
    employee_cpf: 600,
    employer_cpf: 510,
    total_earnings: 3200,
    total_deductions: 650,
    net_pay: 2550,
    payslipGenerated: true,
    payslipId: 1
  },
  {
    id: 2,
    staff_id: "STF002",
    staff_name: "Marcus Tan",
    email: "marcus.tan@paynivo.demo",
    payroll_month: "May 2026",
    basic_salary: 3500,
    services_commission: 120,
    product_commission: 80,
    credit_commission: 20,
    allowance: 150,
    loan_deduction: 80,
    other_deduction: 0,
    employee_cpf: 700,
    employer_cpf: 595,
    total_earnings: 3870,
    total_deductions: 780,
    net_pay: 3090,
    payslipGenerated: true,
    payslipId: 2
  },
  {
    id: 3,
    staff_id: "STF003",
    staff_name: "Aina Rahman",
    email: "aina.rahman@paynivo.demo",
    payroll_month: "May 2026",
    basic_salary: 4200,
    services_commission: 200,
    product_commission: 0,
    credit_commission: 0,
    allowance: 100,
    loan_deduction: 90,
    other_deduction: 0,
    employee_cpf: 840,
    employer_cpf: 714,
    total_earnings: 4500,
    total_deductions: 930,
    net_pay: 3570,
    payslipGenerated: true,
    payslipId: 3
  }
];

export const payslips = [
  {
    id: 1,
    payrollId: 1,
    staff_id: "STF001",
    staff_name: "Siti Staff",
    payroll_month: "May 2026",
    basic_salary: 3000,
    services_commission: 100,
    product_commission: 0,
    credit_commission: 0,
    allowance: 100,
    employee_cpf: 600,
    employer_cpf: 510,
    total_earnings: 3200,
    total_deductions: 650,
    net_pay: 2550,
    fileUrl: "/generated/payslips/payslip-STF001-May-2026.pdf",
    approval_status: "pending",
    approved_by: null,
    approved_at: null,
    sent_at: null,
    createdAt: "2026-05-14T08:00:00.000Z"
  },
  {
    id: 2,
    payrollId: 2,
    staff_id: "STF002",
    staff_name: "Marcus Tan",
    payroll_month: "May 2026",
    basic_salary: 3500,
    services_commission: 120,
    product_commission: 80,
    credit_commission: 20,
    allowance: 150,
    employee_cpf: 700,
    employer_cpf: 595,
    total_earnings: 3870,
    total_deductions: 780,
    net_pay: 3090,
    fileUrl: "/generated/payslips/payslip-STF002-May-2026.pdf",
    approval_status: "pending",
    approved_by: null,
    approved_at: null,
    sent_at: null,
    createdAt: "2026-05-14T08:01:00.000Z"
  },
  {
    id: 3,
    payrollId: 3,
    staff_id: "STF003",
    staff_name: "Aina Rahman",
    payroll_month: "May 2026",
    basic_salary: 4200,
    services_commission: 200,
    product_commission: 0,
    credit_commission: 0,
    allowance: 100,
    employee_cpf: 840,
    employer_cpf: 714,
    total_earnings: 4500,
    total_deductions: 930,
    net_pay: 3570,
    fileUrl: "/generated/payslips/payslip-STF003-May-2026.pdf",
    approval_status: "pending",
    approved_by: null,
    approved_at: null,
    sent_at: null,
    createdAt: "2026-05-14T08:02:00.000Z"
  }
];

let nextPayrollId = 4;
let nextPayslipId = 4;

export function allocatePayrollId() {
  return nextPayrollId++;
}

export function allocatePayslipId() {
  return nextPayslipId++;
}

export function toMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

export function calculatePayroll(record) {
  const basicSalary = toMoney(record.basic_salary);
  const servicesCommission = toMoney(record.services_commission);
  const productCommission = toMoney(record.product_commission);
  const creditCommission = toMoney(record.credit_commission);
  const allowance = toMoney(record.allowance ?? payrollRateConfig.defaultAllowanceRate);
  const loanDeduction = toMoney(record.loan_deduction);
  const otherDeduction = toMoney(record.other_deduction ?? payrollRateConfig.defaultDeductionRate);
  const employeeCpf = toMoney(basicSalary * payrollRateConfig.employeeCpfRate);
  const employerCpf = toMoney(basicSalary * payrollRateConfig.employerCpfRate);
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

export function buildMockUploadRows() {
  return [
    calculatePayroll({
      id: allocatePayrollId(),
      staff_id: "STF004",
      staff_name: "Nadia Lim",
      email: "nadia.lim@paynivo.demo",
      payroll_month: "May 2026",
      basic_salary: 3000,
      services_commission: 100,
      product_commission: 0,
      credit_commission: 0,
      allowance: 100,
      loan_deduction: 50,
      other_deduction: 0
    }),
    calculatePayroll({
      id: allocatePayrollId(),
      staff_id: "STF005",
      staff_name: "Daniel Ong",
      email: "daniel.ong@paynivo.demo",
      payroll_month: "May 2026",
      basic_salary: 3600,
      services_commission: 150,
      product_commission: 60,
      credit_commission: 0,
      allowance: 120,
      loan_deduction: 70,
      other_deduction: 0
    }),
    calculatePayroll({
      id: allocatePayrollId(),
      staff_id: "STF006",
      staff_name: "Priya Nair",
      email: "priya.nair@paynivo.demo",
      payroll_month: "May 2026",
      basic_salary: 2800,
      services_commission: 80,
      product_commission: 40,
      credit_commission: 20,
      allowance: 100,
      loan_deduction: 40,
      other_deduction: 0
    })
  ].map((row) => ({ ...row, validationErrors: [] }));
}

export function createPayslipFromPayroll(payroll) {
  const existing = payslips.find((payslip) => payslip.payrollId === payroll.id);
  if (existing) return existing;

  const payslip = {
    id: allocatePayslipId(),
    payrollId: payroll.id,
    staff_id: payroll.staff_id,
    staff_name: payroll.staff_name,
    payroll_month: payroll.payroll_month,
    basic_salary: payroll.basic_salary,
    services_commission: payroll.services_commission,
    product_commission: payroll.product_commission,
    credit_commission: payroll.credit_commission,
    allowance: payroll.allowance,
    employee_cpf: payroll.employee_cpf,
    employer_cpf: payroll.employer_cpf,
    total_earnings: payroll.total_earnings,
    total_deductions: payroll.total_deductions,
    net_pay: payroll.net_pay,
    fileUrl: `/generated/payslips/payslip-${payroll.staff_id}-${String(payroll.payroll_month).replace(/\s+/g, "-")}.pdf`,
    approval_status: "pending",
    approved_by: null,
    approved_at: null,
    sent_at: null,
    createdAt: new Date().toISOString()
  };

  payslips.unshift(payslip);
  return payslip;
}
