import DashboardShell from "../components/DashboardShell.jsx";

export default function StaffDashboard() {
  return (
    <DashboardShell
      role="Staff"
      title="Staff Dashboard"
      description="Placeholder for staff self-service, profile access, and payslip viewing."
      sections={[
        { title: "My profile", text: "Future personal and employment profile display belongs here." },
        { title: "Payslips", text: "Future payslip list, PDF download, and payroll history belongs here." },
        { title: "Notifications", text: "Future payroll and company notices belong here." }
      ]}
    />
  );
}
