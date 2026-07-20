import ModuleAuditLogPage from "../../components/common/ModuleAuditLogPage.jsx";

export default function InvoiceAuditLogPage() {
  return (
    <ModuleAuditLogPage
      module="Invoice"
      title="Invoice Audit Logs"
      description="All invoice-related activities: creation, updates, payments, imports, exports, PDF downloads, emails, and fraud detection events."
    />
  );
}
