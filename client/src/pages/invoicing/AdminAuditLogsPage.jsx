import ModuleAuditLogPage from "../../components/common/ModuleAuditLogPage.jsx";

export default function AdminAuditLogsPage() {
  return (
    <ModuleAuditLogPage
      module="Invoice"
      title="Invoice Audit Logs"
      description="Invoice-only activities including invoice changes, Vaniday imports, payment status updates, reminder delivery, validation, and invoice settings changes."
    />
  );
}
