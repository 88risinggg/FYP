import DashboardShell from "../components/DashboardShell.jsx";

export default function FinanceDashboard() {
  return (
    <DashboardShell
      role="Finance"
      title="Finance Invoice Workspace"
      description="Finance focuses on invoice creation, Vaniday CSV imports, payment status, payment proof review, and overdue reminders."
      metrics={[
        { label: "Payment methods", value: "3", hint: "Stripe, PayNow, bank transfer" },
        { label: "Reminder stages", value: "2", hint: "Minimum required overdue reminders" },
        { label: "CSV source", value: "Vaniday", hint: "Booking/order sample format" },
        { label: "Approvals", value: "Bulk", hint: "Manual proof approval supported" }
      ]}
      workspaces={[
        {
          type: "Invoice workspace",
          tone: "blue",
          title: "Invoice operations",
          owner: "Finance team",
          description: "A dedicated invoice area for creating invoices manually or importing standardized Vaniday CSV data.",
          actions: [
            { title: "Create invoice", text: "Use standardized fields such as seller ID, shop title, order ID, service, revenue, commission, and salon share." },
            { title: "Upload invoice CSV", text: "Import Vaniday sample rows into invoice records for quicker processing." },
            { title: "Send invoice email", text: "Trigger a readable invoice email using Nodemailer placeholder settings." },
            { title: "Send reminders", text: "Send Reminder 1 and Reminder 2 for unpaid or overdue invoices." }
          ],
          settings: [
            { label: "Invoice auto email", value: "Enabled", tone: "blue", hint: "Controls invoice email scheduling only." },
            { label: "Reminder 1", value: "+3 days", tone: "amber", hint: "First overdue follow-up." },
            { label: "Reminder 2", value: "+7 days", tone: "amber", hint: "Second overdue follow-up." }
          ]
        },
        {
          type: "Payment workspace",
          tone: "green",
          title: "Payment tracking",
          owner: "Finance team",
          description: "Payment features stay with invoices so Finance can review proof, update statuses, and approve transfers.",
          actions: [
            { title: "Review proof", text: "Customers can upload proof for PayNow or bank transfer payment." },
            { title: "Approve payment", text: "Manually approve proof and mark the invoice as paid." },
            { title: "Bulk approval", text: "Approve multiple pending proof records at once for prototype workflow." },
            { title: "Stripe placeholder", text: "Keep Stripe visible as a future integration path." }
          ],
          settings: [
            { label: "Stripe", value: "Placeholder", tone: "slate", hint: "Full integration is a future feature." },
            { label: "PayNow", value: "Proof", tone: "green", hint: "Payment success is confirmed through proof upload." },
            { label: "Bank transfer", value: "Manual", tone: "green", hint: "Finance approves transfer proof." }
          ]
        }
      ]}
    />
  );
}
