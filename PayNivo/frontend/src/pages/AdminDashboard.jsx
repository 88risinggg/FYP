import DashboardShell from "../components/DashboardShell.jsx";

export default function AdminDashboard() {
  return (
    <DashboardShell
      role="Admin"
      title="Admin Control Centre"
      description="Admin oversees users, role access, audit logs, payroll rates, and invoice governance without mixing payroll and invoice settings into one panel."
      metrics={[
        { label: "User roles", value: "5", hint: "Admin, Finance, HR, Staff, Customer" },
        { label: "Audit coverage", value: "7", hint: "Login, upload, emails, rates, payments" },
        { label: "Payroll rates", value: "CPF", hint: "Employee and employer rates configurable" },
        { label: "Invoice controls", value: "CSV", hint: "Vaniday-style invoice upload supported" }
      ]}
      workspaces={[
        {
          type: "Payroll workspace",
          tone: "pink",
          title: "Payroll governance",
          owner: "Admin + HR",
          description: "Controls system-computed payroll rules, CPF rates, allowance defaults, deduction defaults, and payslip delivery settings.",
          actions: [
            { title: "Configure CPF rates", text: "Set employee CPF, employer CPF, SDL, default allowance, and default deduction rates." },
            { title: "Review payroll reports", text: "Track processed staff, total payroll amount, payslips generated, and failed upload records." },
            { title: "Audit payroll events", text: "Review payroll uploads, manual entries, payslip generation, and email actions." },
            { title: "Approve HR setup", text: "Confirm staff records and payroll upload templates before processing." }
          ],
          settings: [
            { label: "Employee CPF", value: "20%", tone: "pink", hint: "Prototype default follows CPFB full-rate example for age 55 and below." },
            { label: "Employer CPF", value: "17%", tone: "pink", hint: "Admin can update this in the payroll rate configuration." },
            { label: "Payslip email schedule", value: "Day 28", tone: "blue", hint: "Payroll-specific automation; not mixed with invoice reminders." }
          ]
        },
        {
          type: "Invoice workspace",
          tone: "blue",
          title: "Invoice governance",
          owner: "Admin + Finance",
          description: "Controls invoice upload standards, payment methods, proof approval, overdue reminders, and finance reporting.",
          actions: [
            { title: "Upload Vaniday CSV", text: "Import seller, shop, order, customer, service, revenue, commission, and salon share fields." },
            { title: "Manage payment methods", text: "Keep Stripe, PayNow, and bank transfer as supported prototype methods." },
            { title: "Track reminders", text: "Configure Reminder 1 and Reminder 2 timing for overdue invoices." },
            { title: "Review payment approval", text: "Audit payment proof uploads, individual approvals, and bulk approval actions." }
          ],
          settings: [
            { label: "Invoice email schedule", value: "Day 1", tone: "blue", hint: "Invoice-specific automation setting." },
            { label: "Reminder 1", value: "+3 days", tone: "amber", hint: "First overdue reminder after due date." },
            { label: "Reminder 2", value: "+7 days", tone: "amber", hint: "Second overdue reminder after due date." }
          ]
        }
      ]}
      checklist={[
        "Admin creates minimum user accounts",
        "Rate configuration is payroll-only",
        "Invoice reminders are invoice-only",
        "Audit logs cover both feature areas"
      ]}
    />
  );
}
