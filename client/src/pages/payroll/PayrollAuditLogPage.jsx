/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - SHARED
 * PURPOSE: Implements the Payroll Audit Log Page screen and its page-level interactions.
 * LAYER: Frontend page - renders a complete screen and coordinates its user interactions.
 * FIND RELATED CODE: Trace its imports for UI components and frontend services used by this screen.
 */
import ModuleAuditLogPage from "../../components/common/ModuleAuditLogPage.jsx";

export default function PayrollAuditLogPage() {
  return (
    <ModuleAuditLogPage
      module=""
      title="System Audit Trail"
      description="Technical activity across access, configuration, payroll workflows, exports and system operations."
    />
  );
}
