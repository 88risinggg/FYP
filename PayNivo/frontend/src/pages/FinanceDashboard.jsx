import DashboardShell from "../components/DashboardShell.jsx";

export default function FinanceDashboard() {
  return (
    <DashboardShell
      role="Finance"
      title="Finance Dashboard"
      description="Placeholder for invoicing, payment tracking, PDF generation, and finance reports."
      sections={[
        { title: "Invoices", text: "Future invoice creation, approval, and export screens belong here." },
        { title: "Payments", text: "Future Stripe, PayNow, and bank transfer status tracking belongs here." },
        { title: "Reports", text: "Future finance summaries and downloadable reports belong here." }
      ]}
    />
  );
}
