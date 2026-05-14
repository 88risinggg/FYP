export const adminUsers = [
  { id: "USR-001", name: "Admin User", email: "admin@paynivo.com", role: "Admin", status: "Active", lastLogin: "Today, 09:10", mfa: "Enabled" },
  { id: "USR-002", name: "Finance User", email: "finance@paynivo.com", role: "Finance", status: "Active", lastLogin: "Today, 08:42", mfa: "Enabled" },
  { id: "USR-003", name: "HR User", email: "hr@paynivo.com", role: "HR", status: "Active", lastLogin: "Yesterday, 17:35", mfa: "Enabled" },
  { id: "USR-004", name: "Staff User", email: "staff@paynivo.com", role: "Staff", status: "Active", lastLogin: "13 May, 13:22", mfa: "Pending" },
  { id: "USR-005", name: "Customer User", email: "customer@paynivo.com", role: "Customer", status: "Active", lastLogin: "12 May, 16:04", mfa: "Pending" }
];

export const adminRoles = [
  { role: "Admin", users: 1, permissions: ["User accounts", "Role access", "System settings", "Audit logs", "Payment approvals"] },
  { role: "Finance", users: 1, permissions: ["Invoices", "Payments", "Customers", "Invoice reports"] },
  { role: "HR", users: 1, permissions: ["Payroll processing", "Staff records", "Payslips"] },
  { role: "Staff", users: 1, permissions: ["Own payslips", "Profile"] },
  { role: "Customer", users: 1, permissions: ["Invoices", "Payment proof"] }
];

export const payrollRates = [
  { label: "Employee CPF", value: "20%", scope: "Age 55 and below" },
  { label: "Employer CPF", value: "17%", scope: "Age 55 and below" },
  { label: "SDL", value: "0.25%", scope: "Minimum $2, maximum $11.25" },
  { label: "Default allowance", value: "$100", scope: "Monthly payroll default" },
  { label: "Default deduction", value: "$0", scope: "Monthly payroll default" }
];

export const invoiceSettings = [
  { label: "Invoice email", value: "Enabled", detail: "Send invoices when Finance confirms issue." },
  { label: "Reminder 1", value: "+3 days", detail: "First overdue reminder after due date." },
  { label: "Reminder 2", value: "+7 days", detail: "Second overdue reminder after due date." },
  { label: "Payment proof", value: "Required", detail: "Required for PayNow and bank transfer." },
  { label: "CSV import", value: "Vaniday", detail: "Accepts seller, shop, order, service, revenue, commission, and salon share fields." }
];

export const manualPayments = [
  { id: "PAY-1042", invoiceNo: "INV-2026-0108", customer: "Luxe Nails Studio", method: "PayNow", amount: "$1,240.00", status: "Pending approval", proof: "paynow-proof-1042.png" },
  { id: "PAY-1043", invoiceNo: "INV-2026-0111", customer: "Glow Beauty Bar", method: "Bank Transfer", amount: "$820.50", status: "Pending approval", proof: "bank-transfer-1043.pdf" },
  { id: "PAY-1044", invoiceNo: "INV-2026-0114", customer: "Urban Spa", method: "PayNow", amount: "$468.00", status: "Approved", proof: "paynow-proof-1044.png" }
];

export const auditLogs = [
  { id: "AUD-9001", actor: "Admin User", action: "Updated payroll CPF rates", area: "Payroll rates", time: "Today, 09:18" },
  { id: "AUD-9002", actor: "Finance User", action: "Uploaded Vaniday invoice CSV", area: "Invoice import", time: "Today, 08:55" },
  { id: "AUD-9003", actor: "Admin User", action: "Approved manual PayNow payment", area: "Payments", time: "Yesterday, 16:44" },
  { id: "AUD-9004", actor: "Admin User", action: "Changed invoice reminder settings", area: "Invoice settings", time: "Yesterday, 11:30" },
  { id: "AUD-9005", actor: "HR User", action: "Generated payroll report", area: "Reports", time: "13 May, 15:12" }
];
