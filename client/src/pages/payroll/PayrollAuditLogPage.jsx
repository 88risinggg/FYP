import ModuleAuditLogPage from "../../components/common/ModuleAuditLogPage.jsx";

export default function PayrollAuditLogPage() {
  return (
    <ModuleAuditLogPage
      module="Payroll"
      title="Payroll Audit Logs"
      description="All payroll-related activities: payroll generation, approval, salary updates, exports, and payroll configuration changes."
    />
  );
}
