export const adminUsers = [
  { id: "USR-001", name: "Admin User", email: "admin@paynivo.com", role: "Admin", status: "Active", mfa: "Enabled", lastLogin: "Today, 09:10" },
  { id: "USR-002", name: "Finance User", email: "finance@paynivo.com", role: "Finance", status: "Active", mfa: "Enabled", lastLogin: "Today, 08:42" },
  { id: "USR-003", name: "HR User", email: "hr@paynivo.com", role: "HR", status: "Active", mfa: "Enabled", lastLogin: "Yesterday, 17:35" }
];

export const adminRoles = [
  { role: "Admin", users: 1, permissions: ["User accounts", "Role access", "System settings", "Audit logs"] },
  { role: "Finance", users: 1, permissions: ["Invoices", "Payment approvals", "Customers", "Invoice reports"] },
  { role: "HR", users: 1, permissions: ["Payroll processing", "Staff records", "Payslips"] }
];

export const payrollRates = [
  { id: "CPF_55_BELOW", label: "55 and below", totalRate: "37%", employerRate: "17%", employeeRate: "20%", wageBand: "Monthly wages > $750", effectiveFrom: "1 Jan 2026" },
  { id: "CPF_55_TO_60", label: "Above 55 to 60", totalRate: "34%", employerRate: "16%", employeeRate: "18%", wageBand: "Monthly wages > $750", effectiveFrom: "1 Jan 2026" },
  { id: "CPF_60_TO_65", label: "Above 60 to 65", totalRate: "25%", employerRate: "12.5%", employeeRate: "12.5%", wageBand: "Monthly wages > $750", effectiveFrom: "1 Jan 2026" },
  { id: "CPF_65_TO_70", label: "Above 65 to 70", totalRate: "16.5%", employerRate: "9%", employeeRate: "7.5%", wageBand: "Monthly wages > $750", effectiveFrom: "1 Jan 2026" },
  { id: "CPF_ABOVE_70", label: "Above 70", totalRate: "12.5%", employerRate: "7.5%", employeeRate: "5%", wageBand: "Monthly wages > $750", effectiveFrom: "1 Jan 2026" },
  { id: "SDL", label: "SDL", value: "0.25%", scope: "Minimum $2, maximum $11.25" }
];

export const invoiceSettings = [
  { id: "EMAIL", label: "Invoice email", value: "Enabled", detail: "Email invoices when Finance issues them." },
  { id: "CSV", label: "CSV import", value: "Vaniday", detail: "Accept Vaniday invoice CSV fields." },
  { id: "PROOF", label: "Payment proof", value: "Required", detail: "Required for PayNow and bank transfer." }
];

export const reminderSettings = [
  { id: "REM1", label: "Reminder 1", value: "+3 days", detail: "First overdue reminder after due date." },
  { id: "REM2", label: "Reminder 2", value: "+7 days", detail: "Second overdue reminder after due date." },
  { id: "WA", label: "WhatsApp reminder", value: "Enabled", detail: "Use Meta WhatsApp Cloud API for reminders." }
];

export const systemSettings = {
  verificationCodeLogin: "Enabled",
  sessionTimeout: "8 hours",
  emailNotifications: "Monitored",
  whatsappNotifications: "Enabled",
  invoiceCsvFormat: "Vaniday"
};

export const reports = [
  { id: "RPT-001", name: "User access report", period: "May 2026", format: "Excel", status: "Ready" },
  { id: "RPT-002", name: "Invoice settings report", period: "May 2026", format: "PDF", status: "Ready" }
];

export const auditLogs = [
  { id: "AUD-9001", actor: "Admin User", action: "Updated payroll CPF rates", area: "Payroll rates", time: "Today, 09:18" },
  { id: "AUD-9002", actor: "Admin User", action: "Changed invoice reminder settings", area: "Invoice settings", time: "Yesterday, 11:30" }
];

export const emailLogs = [
  { id: "MAIL-7001", recipient: "billing@luxenails.sg", subject: "Invoice INV-2026-0108", status: "Delivered", sentAt: "Today, 09:00" },
  { id: "MAIL-7002", recipient: "accounts@glowbeauty.sg", subject: "Payment reminder", status: "Queued", sentAt: "Today, 09:15" }
];

export function addAudit(actor, action, area) {
  auditLogs.unshift({ id: `AUD-${9000 + auditLogs.length + 1}`, actor, action, area, time: "Just now" });
}
