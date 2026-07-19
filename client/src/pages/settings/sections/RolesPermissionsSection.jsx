import { Check, Shield, X as XIcon } from "lucide-react";

const roles = ["Finance Admin", "Finance Manager", "Finance Staff", "HR", "Auditor"];

const permissions = [
  { module: "Invoices", actions: ["View", "Create", "Edit", "Delete", "Approve"] },
  { module: "Payroll", actions: ["View", "Process", "Edit", "Approve", "Export"] },
  { module: "Reports", actions: ["View", "Generate", "Export", "Schedule", "Share"] },
  { module: "Users", actions: ["View", "Create", "Edit", "Deactivate", "Assign Roles"] },
  { module: "Settings", actions: ["View", "Edit", "Admin", "Backup", "Audit"] }
];

const rolePermissions = {
  "Finance Admin": { Invoices: [1,1,1,1,1], Payroll: [1,1,1,1,1], Reports: [1,1,1,1,1], Users: [1,1,1,1,1], Settings: [1,1,1,1,1] },
  "Finance Manager": { Invoices: [1,1,1,0,1], Payroll: [1,1,1,1,1], Reports: [1,1,1,1,0], Users: [1,1,1,0,0], Settings: [1,1,0,0,1] },
  "Finance Staff": { Invoices: [1,1,1,0,0], Payroll: [1,0,0,0,0], Reports: [1,1,1,0,0], Users: [1,0,0,0,0], Settings: [1,0,0,0,0] },
  "HR": { Invoices: [1,0,0,0,0], Payroll: [1,1,1,1,1], Reports: [1,1,1,0,0], Users: [1,1,1,0,0], Settings: [1,1,0,0,0] },
  "Auditor": { Invoices: [1,0,0,0,0], Payroll: [1,0,0,0,0], Reports: [1,1,1,0,0], Users: [1,0,0,0,0], Settings: [1,0,0,0,1] }
};

export default function RolesPermissionsSection() {
  return (
    <div className="space-y-6">
      <div className="app-panel rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <Shield size={20} className="text-[#F38978]" />
          <h2 className="text-xl font-semibold text-white">Roles & Permissions</h2>
        </div>
        <p className="mt-1 text-sm text-[#7b6660]">View the permission matrix for each role. This is read-only.</p>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[#F38978]/80">Module / Action</th>
                {roles.map((role) => (
                  <th key={role} className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[#7b6660]">{role}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissions.map((perm) => (
                perm.actions.map((action, actionIdx) => (
                  <tr key={`${perm.module}-${action}`} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5">
                      {actionIdx === 0 && (
                        <span className="text-xs font-semibold text-[#F38978]/70">{perm.module} &middot; </span>
                      )}
                      <span className="text-white">{action}</span>
                    </td>
                    {roles.map((role) => {
                      const hasPermission = rolePermissions[role]?.[perm.module]?.[actionIdx];
                      return (
                        <td key={role} className="px-2 py-2.5 text-center">
                          {hasPermission ? (
                            <Check size={14} className="mx-auto text-emerald-400" />
                          ) : (
                            <XIcon size={14} className="mx-auto text-white/20" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}