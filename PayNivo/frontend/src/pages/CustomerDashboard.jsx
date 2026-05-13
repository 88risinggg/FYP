import DashboardShell from "../components/DashboardShell.jsx";

export default function CustomerDashboard() {
  return (
    <DashboardShell
      role="Customer"
      title="Customer Invoice Portal"
      description="Customers only interact with invoice and payment features. Payroll settings are not shown here."
      metrics={[
        { label: "Invoice view", value: "Read", hint: "View invoice details" },
        { label: "Payment", value: "3 ways", hint: "Stripe, PayNow, bank transfer" },
        { label: "Proof upload", value: "Yes", hint: "PayNow/bank transfer" },
        { label: "Reminders", value: "Email", hint: "Invoice-only alerts" }
      ]}
      workspaces={[
        {
          type: "Invoice workspace",
          tone: "blue",
          title: "My invoices",
          owner: "Customer",
          description: "Customer features are invoice-focused: view balances, pay invoices, and upload proof where needed.",
          actions: [
            { title: "View invoice", text: "Check service, amount, due date, and status." },
            { title: "Pay by Stripe", text: "Use Stripe placeholder for future online checkout." },
            { title: "PayNow or bank transfer", text: "Upload proof after manual payment." },
            { title: "Receive reminders", text: "Get invoice reminder emails for unpaid or overdue invoices." }
          ],
          settings: [
            { label: "Payment proof", value: "Required", tone: "amber", hint: "For PayNow and bank transfer." },
            { label: "Invoice reminders", value: "2", tone: "blue", hint: "Reminder settings belong to invoice workflows." },
            { label: "Payroll access", value: "None", tone: "slate", hint: "Customers never access payroll records." }
          ]
        }
      ]}
    />
  );
}
