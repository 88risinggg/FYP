import DashboardShell from "../components/DashboardShell.jsx";

export default function StaffDashboard() {
  return (
    <DashboardShell
      role="Staff"
      title="Staff Self-Service"
      description="Staff only sees personal payroll outputs: own payslips, salary breakdown, and contact details."
      metrics={[
        { label: "Access scope", value: "Own", hint: "Only own payslip records" },
        { label: "Download", value: "PDF", hint: "Payslip download" },
        { label: "Breakdown", value: "Net pay", hint: "Earnings and deductions" },
        { label: "Profile", value: "Contact", hint: "Update email and phone" }
      ]}
      workspaces={[
        {
          type: "Payroll workspace",
          tone: "pink",
          title: "My payroll records",
          owner: "Staff user",
          description: "Staff-facing payroll features are kept separate from invoice and finance features.",
          actions: [
            { title: "View salary breakdown", text: "Review basic salary, commissions, allowance, CPF, loan deduction, and net pay." },
            { title: "View payslip history", text: "See generated payslips by payroll month." },
            { title: "Download PDF", text: "Download printable payslip PDFs when HR has generated them." },
            { title: "Update contact", text: "Maintain email and phone details for payroll communication." }
          ],
          settings: [
            { label: "Visibility", value: "Own only", tone: "pink", hint: "Staff must not view other staff payroll records." },
            { label: "Payslip email", value: "Enabled", tone: "green", hint: "Payslip email belongs to payroll settings." },
            { label: "Invoice access", value: "None", tone: "slate", hint: "Staff does not manage invoice workflows." }
          ]
        }
      ]}
    />
  );
}
