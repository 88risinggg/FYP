/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - ADMIN
 * PURPOSE: Implements the Admin Audit Logs Page screen and its page-level interactions.
 * LAYER: Frontend page - renders a complete screen and coordinates its user interactions.
 * FIND RELATED CODE: Trace its imports for UI components and frontend services used by this screen.
 */
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
