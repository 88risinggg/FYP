/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - SHARED
 * PURPOSE: Implements the Invoice Audit Log Page screen and its page-level interactions.
 * LAYER: Frontend page - renders a complete screen and coordinates its user interactions.
 * FIND RELATED CODE: Trace its imports for UI components and frontend services used by this screen.
 */
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
