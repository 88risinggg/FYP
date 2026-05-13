import DashboardShell from "../components/DashboardShell.jsx";

export default function AdminDashboard() {
  return (
    <DashboardShell
      role="Admin"
      title="Admin Dashboard"
      description="Placeholder for user management, roles, audit logs, and payroll rate configuration."
      sections={[
        { title: "Users and roles", text: "Future Admin controls for creating accounts and assigning roles." },
        { title: "Rate settings", text: "Future CPF, contribution, and deduction configuration belongs here." },
        { title: "Audit trail", text: "Future system activity review and compliance logs belong here." }
      ]}
    />
  );
}
