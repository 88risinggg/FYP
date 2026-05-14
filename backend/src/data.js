export const roles = ["Admin", "Finance", "HR", "Staff"];

export const demoUsers = [
  { id: 1, email: "admin@paynivo.com", password: "password", role: "Admin", name: "Alicia Admin" },
  { id: 2, email: "finance@paynivo.com", password: "password", role: "Finance", name: "Farid Finance" },
  { id: 3, email: "hr@paynivo.com", password: "password", role: "HR", name: "Hana HR" },
  { id: 4, email: "staff@paynivo.com", password: "password", role: "Staff", name: "Siti Staff", staffId: "STF001" }
];

export const staffProfiles = [
  {
    staff_id: "STF001",
    staff_name: "Siti Staff",
    email: "staff@paynivo.com",
    phone: "+65 8123 4567",
    work_location: "Singapore HQ",
    department: "Operations"
  },
  {
    staff_id: "STF002",
    staff_name: "Marcus Tan",
    email: "marcus@example.com",
    phone: "+65 9234 5678",
    work_location: "Tampines Branch",
    department: "Sales"
  }
];

export const payrollRateConfig = {
  employeeCpfRate: 0.2,
  employerCpfRate: 0.17,
  sdlRate: 0.0025,
  defaultAllowanceRate: 100,
  defaultDeductionRate: 50,
  cpfSourceNote: "Prototype default follows CPFB 2026 full-rate example for Singapore Citizens/SPR third year and above, age 55 and below: employee 20%, employer 17%. Admin can configure rates.",
  updatedAt: new Date().toISOString()
};

export const automationSettings = {
  payslipAutoEmailEnabled: true,
  payslipEmailDay: 28,
  invoiceAutoEmailEnabled: true,
  invoiceEmailDay: 1,
  reminder1DaysAfterDue: 3,
  reminder2DaysAfterDue: 7,
  whatsappEnabled: false
};

export const payrollRecords = [
  {
    id: 1,
    staff_id: "STF001",
    staff_name: "Siti Staff",
    email: "staff@paynivo.com",
    payroll_month: "May 2026",
    working_days: 22,
    no_pay_leave_days: 0,
    basic_salary: 3200,
    services_commission: 300,
    product_commission: 180,
    credit_commission: 120,
    loan_deduction: 100,
    other_deduction: 30
  }
];

export const payslips = [];

export const customers = [
  { id: 1, name: "Acme Retail Pte Ltd", email: "billing@acmeretail.test" },
  { id: 2, name: "Bright Services LLP", email: "accounts@brightservices.test" }
];

export const invoices = [
  {
    id: 1,
    invoiceNumber: "INV-2026-001",
    customerName: "Acme Retail Pte Ltd",
    customerEmail: "billing@acmeretail.test",
    issueDate: "2026-05-01",
    dueDate: "2026-05-21",
    status: "Sent",
    paymentMethod: "PayNow",
    amount: 1850,
    items: [{ description: "Payroll processing service", quantity: 1, unitPrice: 1850 }]
  },
  {
    id: 2,
    invoiceNumber: "INV-2026-002",
    customerName: "Bright Services LLP",
    customerEmail: "accounts@brightservices.test",
    issueDate: "2026-05-04",
    dueDate: "2026-05-18",
    status: "Draft",
    paymentMethod: "Bank transfer",
    amount: 980,
    items: [{ description: "Invoice automation setup", quantity: 1, unitPrice: 980 }]
  }
];

export const payments = [
  { id: 1, invoiceId: 1, method: "PayNow", status: "Pending", proofUrl: "paynow-proof-demo.png", uploadedAt: new Date().toISOString() },
  { id: 2, invoiceId: 2, method: "Bank transfer", status: "Pending", proofUrl: "bank-transfer-proof-demo.pdf", uploadedAt: new Date().toISOString() }
];

export const auditLogs = [
  {
    id: 1,
    actor: "System",
    action: "Prototype seeded",
    module: "System",
    createdAt: new Date().toISOString()
  }
];

export const emailLogs = [];
export const uploadLogs = [];
