import DashboardShell from "../components/DashboardShell.jsx";

export default function CustomerDashboard() {
  return (
    <DashboardShell
      role="Customer"
      title="Customer Dashboard"
      description="Placeholder for customer invoice viewing, payment status, and account details."
      sections={[
        { title: "Invoices", text: "Future customer invoice list and invoice detail views belong here." },
        { title: "Payment status", text: "Future payment confirmations and outstanding balances belong here." },
        { title: "Account", text: "Future customer profile and billing information belongs here." }
      ]}
    />
  );
}
