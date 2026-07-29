/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - SHARED
 * PURPOSE: Implements the HRAudit Log Page screen and its page-level interactions.
 * LAYER: Frontend page - renders a complete screen and coordinates its user interactions.
 * FIND RELATED CODE: Trace its imports for UI components and frontend services used by this screen.
 */
import ModuleAuditLogPage from "../../components/common/ModuleAuditLogPage.jsx";

export default function HRAuditLogPage() {
  return (
    <ModuleAuditLogPage
      module="HR"
      title="HR Audit Logs"
      description="All HR activities: staff onboarding, profile updates, leave management, and employee record changes."
    />
  );
}
