import DashboardShell from "../components/DashboardShell.jsx";

export default function HRDashboard() {
  return (
    <DashboardShell
      role="HR"
      title="HR Payroll Workspace"
      description="HR owns staff records, payroll Excel uploads, manual payroll entry, validation, payslip generation, and payslip email workflows."
      metrics={[
        { label: "Payroll source", value: "Excel", hint: "Multer + ExcelJS upload" },
        { label: "Manual entry", value: "Yes", hint: "Admin/HR can enter payroll rows" },
        { label: "Payslip output", value: "PDF", hint: "Printable and downloadable" },
        { label: "Email", value: "Auto", hint: "Payslip email schedule supported" }
      ]}
      workspaces={[
        {
          type: "Payroll workspace",
          tone: "pink",
          title: "Payroll preparation",
          owner: "HR team",
          description: "All payroll preparation features are grouped together instead of being mixed into invoice settings.",
          actions: [
            { title: "Manage staff profiles", text: "Create and maintain staff records before payroll processing." },
            { title: "Upload payroll Excel", text: "Validate required fields such as staff ID, name, email, salary, commission, and deductions." },
            { title: "Manual payroll entry", text: "Enter payroll data directly when a spreadsheet is not available." },
            { title: "Validate payroll rows", text: "Catch missing names, emails, salary values, negative amounts, and invalid working days." }
          ],
          settings: [
            { label: "Default allowance", value: "$100", tone: "pink", hint: "Payroll-specific default used during computation." },
            { label: "Default deduction", value: "$50", tone: "pink", hint: "Payroll-specific deduction default." },
            { label: "CPF computation", value: "System", tone: "blue", hint: "System computes CPF and net pay from configured rates." }
          ]
        },
        {
          type: "Payslip workspace",
          tone: "green",
          title: "Payslip delivery",
          owner: "HR team",
          description: "Payslip generation and email settings are separated from invoice email settings.",
          actions: [
            { title: "Generate PDF payslip", text: "Create a Puppeteer PDF with earnings, deductions, CPF, and net pay." },
            { title: "Send payslip email", text: "Email payslips to staff automatically or by manual trigger." },
            { title: "Review salary breakdown", text: "Check total earnings, employee CPF, loan deduction, other deduction, and net pay." },
            { title: "Restrict staff view", text: "Staff users can only view their own payslip records." }
          ],
          settings: [
            { label: "Payslip auto email", value: "Enabled", tone: "green", hint: "Payroll-specific email automation." },
            { label: "Payslip email day", value: "Day 28", tone: "green", hint: "Separate from invoice auto email date." },
            { label: "PDF download", value: "Enabled", tone: "blue", hint: "Staff can download generated payslips." }
          ]
        }
      ]}
    />
  );
}
