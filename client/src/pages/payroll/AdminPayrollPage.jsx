import {
  CheckCircle2,
  ClipboardList,
  Eye,
  FileBarChart,
  FileText,
  History,
  LayoutDashboard,
  Palette,
  PlayCircle,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Upload,
  UserCog,
  Users
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import {
  addPayslipLayout,
  getAdminPayrollDashboard,
  resetUserPassword,
  setDefaultPayslipLayout,
  updatePayrollSetting,
  updateUserRole,
  updateUserStatus
} from "../../services/adminPayrollService.js";
import { getStoredSession } from "../../services/sessionService.js";

const pageTitle = "Automated Payroll System - Admin Dashboard";

const payrollSidebarSections = [
  {
    label: "MAIN",
    items: [
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        path: "/dashboard/payroll/admin",
        end: true
      },
      {
        label: "Users & Roles",
        icon: Users,
        path: "/dashboard/payroll/admin/users-roles"
      },
      {
        label: "Payroll Settings",
        icon: Settings,
        path: "/dashboard/payroll/admin/settings"
      },
      {
        label: "Payslip Layouts",
        icon: Palette,
        path: "/dashboard/payroll/admin/payslip-layouts"
      },
      {
        label: "Payroll Monitor",
        icon: UserCog,
        path: "/dashboard/payroll/admin/payroll-monitor"
      },
      {
        label: "Audit Logs",
        icon: History,
        path: "/dashboard/payroll/admin/audit-logs"
      },
      {
        label: "Reports",
        icon: FileBarChart,
        path: "/dashboard/payroll/admin/reports"
      }
    ]
  }
];

const workflowSteps = [
  {
    title: "Configure Payroll Rules",
    icon: Settings,
    status: "Configured",
    owner: "Admin",
    updatedKey: "default_pay_cycle",
    details: ["Employee master data", "Salary, pay type, allowance and deduction rules", "CPF, leave and overtime settings"],
    action: "Open Rules"
  },
  {
    title: "Manage Users & Roles",
    icon: Users,
    status: "Active",
    owner: "Admin",
    updatedKey: "users",
    details: ["Admin, HR and Finance access", "Payroll module permissions", "Active and inactive user accounts"],
    action: "Manage Access"
  },
  {
    title: "Import Payslip Layout",
    icon: Palette,
    status: "Not Configured",
    owner: "Admin",
    updatedKey: "layouts",
    details: ["Upload layout file", "Set default template", "Preview sample payslip output"],
    action: "Import Design"
  },
  {
    title: "Maintain Staff Setup",
    icon: ClipboardList,
    status: "Needs Data",
    owner: "Admin / HR",
    updatedKey: "users",
    details: ["Department assignment", "Base salary reference", "Employee account link"],
    action: "View Staff Setup"
  },
  {
    title: "Monitor Payroll Status",
    icon: ShieldCheck,
    status: "View Only",
    owner: "Finance",
    updatedKey: "payrollRuns",
    details: ["Finance payroll progress", "Generated payslip status", "System exception visibility"],
    action: "Open Monitor"
  },
  {
    title: "Audit & Reports",
    icon: History,
    status: "Tracking",
    owner: "System",
    updatedKey: "auditLogs",
    details: ["Admin changes", "Template updates", "System access records"],
    action: "View Logs"
  }
];

const cpfCalculationSettings = [
  {
    key: "cpf_calculation_basis",
    label: "CPF Calculation Basis",
    description: "Choose whether CPF is calculated by percentage of wages or fixed amount.",
    placeholder: "% of Wages"
  },
  {
    key: "cpf_rate_view_mode",
    label: "CPF Rate View",
    description: "Default rate view shown to Finance when reviewing CPF settings.",
    placeholder: "Age Group"
  },
  {
    key: "cpf_additional_wage_basis",
    label: "Additional Wage Basis",
    description: "Rule for bonuses and additional wages when included in CPF.",
    placeholder: "Apply CPF ceiling"
  }
];

const cpfRateRows = [
  ["55 and below", "20.00", "20.00", "17.00", "17.00"],
  ["Above 55 to 60", "19.00", "19.00", "16.00", "16.00"],
  ["Above 60 to 65", "15.50", "15.50", "13.00", "13.00"],
  ["Above 65 to 70", "12.00", "12.00", "10.00", "10.00"],
  ["Above 70", "7.50", "7.50", "7.50", "7.50"]
].map(([ageGroup, employeeOrdinary, employeeAdditional, employerOrdinary, employerAdditional]) => ({
  ageGroup,
  slug: ageGroup.toLowerCase().replaceAll(" ", "_").replaceAll(".", "").replaceAll("to", "to"),
  employeeOrdinary,
  employeeAdditional,
  employerOrdinary,
  employerAdditional
}));

const wageComponentRows = [
  ["Basic Salary", "Yes", "Ordinary Wage", "Always included"],
  ["Fixed Allowance", "Yes", "Ordinary Wage", "Included"],
  ["Overtime", "Yes", "Ordinary Wage", "Included"],
  ["Commission", "No", "-", "Excluded"],
  ["Bonus", "Yes", "Additional Wage", "Included if above ceiling"],
  ["Director Fees", "No", "-", "Excluded"]
].map(([component, includeCpf, wageType, remarks]) => ({
  component,
  slug: component.toLowerCase().replaceAll(" ", "_"),
  includeCpf,
  wageType,
  remarks
}));

const cpfCeilingSettings = [
  {
    key: "cpf_wage_ceiling_effective_from",
    label: "Effective From",
    description: "Date the monthly wage ceiling takes effect.",
    placeholder: "01/01/2024"
  },
  {
    key: "cpf_monthly_wage_ceiling",
    label: "Monthly Wage Ceiling (SGD)",
    description: "Monthly CPF wage ceiling applied based on pay period.",
    placeholder: "6800.00"
  }
];

const cpfCeilingHistory = [
  ["01/01/2024", "6,800.00"],
  ["01/01/2023", "6,300.00"],
  ["01/01/2022", "6,000.00"]
];

const cpfAccountMappings = [
  {
    key: "cpf_account_employee_payable",
    label: "CPF Payable (Employee)",
    description: "Liability account for employee CPF payable.",
    placeholder: "2100 - CPF Payable (Employee)"
  },
  {
    key: "cpf_account_employer_payable",
    label: "CPF Payable (Employer)",
    description: "Liability account for employer CPF payable.",
    placeholder: "2110 - CPF Payable (Employer)"
  },
  {
    key: "cpf_account_employer_expense",
    label: "Employer CPF Expense",
    description: "Expense account for employer CPF cost.",
    placeholder: "5200 - CPF Expense"
  }
];

const otherCpfSettings = [
  {
    key: "cpf_payment_due_day",
    label: "Payment Due Day",
    description: "CPF payment due day, for example 14th of next month.",
    placeholder: "14th of next month"
  },
  {
    key: "cpf_payment_method",
    label: "Payment Method",
    description: "CPF payment method used by Finance.",
    placeholder: "GIRO / PayNow"
  },
  {
    key: "cpf_notification_enabled",
    label: "Notification",
    description: "Enable reminders for CPF payment and submission.",
    placeholder: "Enabled"
  },
  {
    key: "cpf_submission_tracking",
    label: "CPF Submission",
    description: "Track CPF submission files and statuses.",
    placeholder: "Enabled"
  }
];

function ActionButton({ icon: Icon, children, variant = "primary", onClick, disabled = false }) {
  const className =
    variant === "secondary"
      ? "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
      : "neon-button inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold";

  return (
    <button type="button" className={`${className} disabled:cursor-not-allowed disabled:opacity-60`} onClick={onClick} disabled={disabled}>
      <Icon size={17} />
      {children}
    </button>
  );
}

function formatDate(value) {
  if (!value) return "Not available";

  return new Intl.DateTimeFormat("en-SG", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return "Not available";

  return new Intl.DateTimeFormat("en-SG", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    second: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

function formatPayrollPeriod(run) {
  if (!run?.payroll_month || !run?.payroll_year) return "No period";

  return new Intl.DateTimeFormat("en-SG", {
    month: "long",
    year: "numeric"
  }).format(new Date(run.payroll_year, run.payroll_month - 1, 1));
}

function formatMoney(value) {
  if (value === null || value === undefined) return "Not linked";

  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD"
  }).format(Number(value));
}

function EmptyState({ message }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-[#d8c6e8]">
      {message}
    </div>
  );
}

function PageShell({ heading, children, actions }) {
  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#C77DFF]/80">
            Admin Payroll Workflow
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{heading}</h2>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function getLatestTimestamp(items = []) {
  return items
    .map((item) => item?.updated_at || item?.created_at)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0];
}

function getStepMeta(step, data) {
  if (step.updatedKey === "users") {
    return {
      count: `${data?.users?.length || 0} user(s)`,
      lastUpdated: getLatestTimestamp(data?.users)
    };
  }

  if (step.updatedKey === "layouts") {
    const defaultLayout = data?.layouts?.find((layout) => Number(layout.is_default) === 1);

    return {
      count: `${data?.layouts?.length || 0} layout(s)`,
      lastUpdated: getLatestTimestamp(data?.layouts),
      status: defaultLayout ? "Default Set" : step.status
    };
  }

  if (step.updatedKey === "payrollRuns") {
    return {
      count: `${data?.payrollRuns?.length || 0} run(s)`,
      lastUpdated: getLatestTimestamp(data?.payrollRuns)
    };
  }

  if (step.updatedKey === "auditLogs") {
    return {
      count: `${data?.auditLogs?.length || 0} event(s)`,
      lastUpdated: getLatestTimestamp(data?.auditLogs)
    };
  }

  const setting = data?.settings?.find((item) => item.setting_key === step.updatedKey);

  return {
    count: setting ? "Settings saved" : "No saved value",
    lastUpdated: setting?.updated_at
  };
}

function getStatusBadgeClass(status) {
  const normalizedStatus = status.toLowerCase();

  if (["active", "configured", "default set", "tracking"].includes(normalizedStatus)) {
    return "border-[#7CFFB2]/25 bg-[#7CFFB2]/10 text-[#7CFFB2]";
  }

  if (["not configured", "needs data"].includes(normalizedStatus)) {
    return "border-[#FFB86B]/25 bg-[#FFB86B]/10 text-[#FFE2B8]";
  }

  if (normalizedStatus === "view only") {
    return "border-[#7DD3FC]/25 bg-[#7DD3FC]/10 text-[#BAE6FD]";
  }

  return "border-white/10 bg-white/[0.06] text-[#d8c6e8]";
}

function WorkflowCard({ data, step }) {
  const Icon = step.icon;
  const meta = getStepMeta(step, data);
  const status = meta.status || step.status;

  return (
    <article className="neon-glass neon-border rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#C77DFF]/12 text-[#C77DFF] ring-1 ring-[#C77DFF]/25">
          <Icon size={24} />
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(status)}`}>
          {status}
        </span>
      </div>
      <h3 className="mt-5 text-base font-semibold text-white">{step.title}</h3>
      <div className="mt-3 grid gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs text-[#d8c6e8]">
        <div className="flex items-center justify-between gap-3">
          <span>Owner</span>
          <span className="font-semibold text-white">{step.owner}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Records</span>
          <span className="font-semibold text-white">{meta.count}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Last Updated</span>
          <span className="font-semibold text-white">{meta.lastUpdated ? formatDateTime(meta.lastUpdated) : "Not updated"}</span>
        </div>
      </div>
      <ul className="mt-3 space-y-2 text-sm text-[#d8c6e8]">
        {step.details.map((detail) => (
          <li key={detail} className="flex gap-2">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#C77DFF]" />
            <span>{detail}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="mt-5 w-full rounded-xl border border-[#C77DFF]/25 bg-[#C77DFF]/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#C77DFF]/18"
      >
        {step.action}
      </button>
    </article>
  );
}

function DashboardView({ data, onImportLayout, onSetDefaultLayout }) {
  const stats = data?.stats || {};
  const dashboardStats = [
    { label: "Active Users", value: stats.activeUsers ?? 0, tone: "text-[#C77DFF]" },
    { label: "Payroll Rules", value: stats.payrollRules ?? 0, tone: "text-white" },
    { label: "Payslip Layouts", value: stats.payslipLayouts ?? 0, tone: "text-[#7CFFB2]" },
    { label: "Admin Logs", value: stats.adminLogs ?? 0, tone: "text-[#FFB86B]" }
  ];
  const defaultLayout = data?.layouts?.find((layout) => Number(layout.is_default) === 1);

  return (
    <PageShell
      heading="Dashboard"
      actions={
        <>
          <ActionButton icon={Plus}>Add Payroll Rule</ActionButton>
          <ActionButton icon={Upload} variant="secondary" onClick={onImportLayout}>Import Payslip Design</ActionButton>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dashboardStats.map((stat) => (
          <div key={stat.label} className="neon-glass rounded-2xl p-5">
            <p className="text-sm text-[#d8c6e8]">{stat.label}</p>
            <p className={`mt-3 text-3xl font-semibold ${stat.tone}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {workflowSteps.map((step) => (
              <WorkflowCard key={step.title} data={data} step={step} />
            ))}
          </div>
        </div>

        <aside className="neon-glass neon-border rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#7B2FF7]/20 text-[#C77DFF]">
              <Palette size={21} />
            </div>
            <div>
              <h3 className="font-semibold text-white">Payslip Layout Control</h3>
              <p className="text-sm text-[#d8c6e8]">Admin manages the templates Finance uses when generating payslips.</p>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            <ActionButton icon={Upload} onClick={onImportLayout}>Import New Layout</ActionButton>
            <ActionButton icon={Eye} variant="secondary" disabled={!defaultLayout} onClick={() => defaultLayout?.file_path && window.open(defaultLayout.file_path, "_blank")}>
              Preview Default Layout
            </ActionButton>
            <ActionButton icon={ShieldCheck} variant="secondary" disabled={!data?.layouts?.length} onClick={() => onSetDefaultLayout(data.layouts[0].layout_id)}>
              Set Latest as Default
            </ActionButton>
          </div>
          <div className="mt-6 rounded-xl border border-[#C77DFF]/25 bg-[#C77DFF]/10 p-4 text-sm text-[#eadcff]">
            Finance keeps payroll data submission. Admin only controls setup, access and reusable payslip designs.
          </div>
        </aside>
      </div>
    </PageShell>
  );
}

function UsersRolesView({
  currentUserId,
  onResetPassword,
  onUpdateRole,
  onUpdateStatus,
  roleSummary = [],
  users = []
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [managedUser, setManagedUser] = useState(null);

  const roles = useMemo(
    () => ["All", ...roleSummary.map((role) => role.role_name)],
    [roleSummary]
  );
  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return users.filter((user) => {
      const statusLabel = Number(user.status) === 1 ? "Active" : "Inactive";
      const matchesSearch =
        !normalizedSearch ||
        user.name?.toLowerCase().includes(normalizedSearch) ||
        user.email?.toLowerCase().includes(normalizedSearch) ||
        user.role_name?.toLowerCase().includes(normalizedSearch) ||
        user.employee_code?.toLowerCase().includes(normalizedSearch) ||
        user.department_name?.toLowerCase().includes(normalizedSearch);
      const matchesRole = roleFilter === "All" || user.role_name === roleFilter;
      const matchesStatus = statusFilter === "All" || statusLabel === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [roleFilter, searchTerm, statusFilter, users]);

  return (
    <PageShell
      heading="Users & Roles"
      actions={
        <>
          <ActionButton icon={Users}>Add User</ActionButton>
          <ActionButton icon={ShieldCheck} variant="secondary">Manage Role Access</ActionButton>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-4">
          {roleSummary.map((role) => (
            <div key={role.role_id} className="neon-glass rounded-2xl p-5">
              <p className="text-sm text-[#d8c6e8]">{role.role_name}</p>
              <p className="mt-3 text-3xl font-semibold text-white">{role.user_count}</p>
              <p className="mt-2 text-sm text-[#d8c6e8]/80">{role.description || "Role access"}</p>
            </div>
          ))}
        </div>

        <div className="neon-glass neon-border rounded-2xl p-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">User & Staff Directory</h3>
              <p className="mt-1 text-sm text-[#d8c6e8]">
                {filteredUsers.length} of {users.length} user(s) shown
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:w-[46rem]">
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5">
                <Search size={16} className="text-[#C77DFF]" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search users..."
                  className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#d8c6e8]/60"
                />
              </label>

              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="rounded-xl border border-white/10 bg-[#1d0b2f] px-3 py-2.5 text-sm font-semibold text-white outline-none"
              >
                {roles.map((role) => (
                  <option key={role} value={role}>{role} roles</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-xl border border-white/10 bg-[#1d0b2f] px-3 py-2.5 text-sm font-semibold text-white outline-none"
              >
                {["All", "Active", "Inactive"].map((status) => (
                  <option key={status} value={status}>{status} status</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-[#C77DFF]/80">
                <tr>
                  <th className="border-b border-white/10 px-4 py-3 font-semibold">User</th>
                  <th className="border-b border-white/10 px-4 py-3 font-semibold">Role</th>
                  <th className="border-b border-white/10 px-4 py-3 font-semibold">Employee Code</th>
                  <th className="border-b border-white/10 px-4 py-3 font-semibold">Department</th>
                  <th className="border-b border-white/10 px-4 py-3 font-semibold">Base Salary</th>
                  <th className="border-b border-white/10 px-4 py-3 font-semibold">Status</th>
                  <th className="border-b border-white/10 px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const isActive = Number(user.status) === 1;

                  return (
                    <tr
                      key={user.user_id}
                      className="cursor-pointer text-[#d8c6e8] transition hover:bg-white/[0.04]"
                      onClick={() => setManagedUser(user)}
                    >
                      <td className="border-b border-white/10 px-4 py-4">
                        <p className="font-semibold text-white">{user.name}</p>
                        <p className="mt-1 text-xs text-[#d8c6e8]/75">{user.email}</p>
                      </td>
                      <td className="border-b border-white/10 px-4 py-4">{user.role_name}</td>
                      <td className="border-b border-white/10 px-4 py-4">{user.employee_code || "Not linked"}</td>
                      <td className="border-b border-white/10 px-4 py-4">{user.department_name || "Not linked"}</td>
                      <td className="border-b border-white/10 px-4 py-4">{formatMoney(user.base_salary)}</td>
                      <td className="border-b border-white/10 px-4 py-4">
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${isActive ? "border-[#7CFFB2]/25 bg-[#7CFFB2]/10 text-[#7CFFB2]" : "border-[#FFB86B]/25 bg-[#FFB86B]/10 text-[#FFE2B8]"}`}>
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="border-b border-white/10 px-4 py-4">
                        <button
                          type="button"
                          className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
                          onClick={(event) => {
                            event.stopPropagation();
                            setManagedUser(user);
                          }}
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {!filteredUsers.length ? (
              <div className="mt-4">
                <EmptyState message="No users match the current filters." />
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {managedUser ? (
        <UserManagementModal
          currentUserId={currentUserId}
          roles={roleSummary}
          user={managedUser}
          onClose={() => setManagedUser(null)}
          onResetPassword={onResetPassword}
          onUpdateRole={onUpdateRole}
          onUpdateStatus={onUpdateStatus}
        />
      ) : null}
    </PageShell>
  );
}

function ProfileField({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#C77DFF]/75">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value || "Not linked"}</p>
    </div>
  );
}

function UserManagementModal({
  currentUserId,
  onClose,
  onResetPassword,
  onUpdateRole,
  onUpdateStatus,
  roles,
  user
}) {
  const isActive = Number(user.status) === 1;
  const hasStaffProfile = Boolean(user.employee_id);
  const isCurrentUser = Number(user.user_id) === Number(currentUserId);
  const [selectedRoleId, setSelectedRoleId] = useState(String(user.role_id));
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleResetPassword = async () => {
    setIsSubmitting(true);
    setTemporaryPassword("");

    try {
      const result = await onResetPassword(user.user_id);
      setTemporaryPassword(result.temporaryPassword);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusUpdate = async () => {
    setIsSubmitting(true);

    try {
      await onUpdateStatus(user.user_id, isActive ? 0 : 1);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleUpdate = async () => {
    setIsSubmitting(true);

    try {
      await onUpdateRole(user.user_id, Number(selectedRoleId));
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090014]/80 px-4 backdrop-blur-sm">
      <section className="neon-glass neon-border max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl p-6">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#C77DFF]/15 text-[#C77DFF] ring-1 ring-[#C77DFF]/25">
              <UserCog size={26} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">Manage {user.name}</h3>
              <p className="mt-1 text-sm text-[#d8c6e8]">{user.email}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-[#d8c6e8]">
                  {user.role_name}
                </span>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${isActive ? "border-[#7CFFB2]/25 bg-[#7CFFB2]/10 text-[#7CFFB2]" : "border-[#FFB86B]/25 bg-[#FFB86B]/10 text-[#FFE2B8]"}`}>
                  {isActive ? "Active account" : "Inactive account"}
                </span>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${hasStaffProfile ? "border-[#C77DFF]/25 bg-[#C77DFF]/10 text-[#eadcff]" : "border-[#FFB86B]/25 bg-[#FFB86B]/10 text-[#FFE2B8]"}`}>
                  {hasStaffProfile ? "Staff profile linked" : "No staff profile"}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-6 space-y-6">
          <div>
            <h4 className="font-semibold text-white">Admin Actions</h4>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-sm font-semibold text-white">Reset Password</p>
                <p className="mt-2 text-sm text-[#d8c6e8]">
                  Generates a temporary password for the user. Share it through a secure channel.
                </p>
                <button
                  type="button"
                  className="mt-4 rounded-xl border border-[#C77DFF]/25 bg-[#C77DFF]/10 px-4 py-2 text-sm font-semibold text-white hover:bg-[#C77DFF]/18 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleResetPassword}
                  disabled={isSubmitting}
                >
                  Reset Password
                </button>
                {temporaryPassword ? (
                  <div className="mt-4 rounded-xl border border-[#7CFFB2]/25 bg-[#7CFFB2]/10 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#7CFFB2]">Temporary Password</p>
                    <p className="mt-2 break-all font-mono text-sm text-white">{temporaryPassword}</p>
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-sm font-semibold text-white">Account Status</p>
                <p className="mt-2 text-sm text-[#d8c6e8]">
                  Disable access for inactive users. Self-deactivation is blocked.
                </p>
                <button
                  type="button"
                  className="mt-4 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleStatusUpdate}
                  disabled={isSubmitting || isCurrentUser}
                >
                  {isActive ? "Deactivate Account" : "Activate Account"}
                </button>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-sm font-semibold text-white">Role Access</p>
                <p className="mt-2 text-sm text-[#d8c6e8]">
                  Change module access by assigning a different role. Self-role changes are blocked.
                </p>
                <div className="mt-4 flex gap-2">
                  <select
                    value={selectedRoleId}
                    onChange={(event) => setSelectedRoleId(event.target.value)}
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#1d0b2f] px-3 py-2 text-sm font-semibold text-white outline-none"
                    disabled={isCurrentUser}
                  >
                    {roles.map((role) => (
                      <option key={role.role_id} value={role.role_id}>{role.role_name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="rounded-xl border border-[#C77DFF]/25 bg-[#C77DFF]/10 px-4 py-2 text-sm font-semibold text-white hover:bg-[#C77DFF]/18 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={handleRoleUpdate}
                    disabled={isSubmitting || isCurrentUser || Number(selectedRoleId) === Number(user.role_id)}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-white">Account Details</h4>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ProfileField label="User ID" value={user.user_id} />
              <ProfileField label="Role" value={user.role_name} />
              <ProfileField label="Created" value={formatDate(user.created_at)} />
              <ProfileField label="Updated" value={formatDate(user.updated_at)} />
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-white">Employee Details</h4>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <ProfileField label="Employee ID" value={user.employee_id} />
              <ProfileField label="Employee Code" value={user.employee_code} />
              <ProfileField label="Phone" value={user.phone} />
              <ProfileField label="Department" value={user.department_name} />
              <ProfileField label="Hire Date" value={formatDate(user.hire_date)} />
              <ProfileField label="Base Salary" value={formatMoney(user.base_salary)} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function PayslipLayoutsView({ layouts = [], onImportLayout, onSetDefaultLayout }) {
  return (
    <PageShell
      heading="Payslip Layouts"
      actions={
        <>
          <ActionButton icon={Upload} onClick={onImportLayout}>Import Layout</ActionButton>
          <ActionButton icon={Eye} variant="secondary">Preview Sample</ActionButton>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="neon-glass neon-border rounded-2xl p-6 lg:col-span-2">
          {layouts.length ? (
            <div className="grid gap-4 md:grid-cols-3">
              {layouts.map((layout) => (
              <article key={layout.layout_id} className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#C77DFF]/12 text-[#C77DFF] ring-1 ring-[#C77DFF]/25">
                  <FileText size={22} />
                </div>
                <h3 className="mt-4 font-semibold text-white">{layout.layout_name}</h3>
                <p className="mt-2 text-sm text-[#d8c6e8]">{layout.file_type} template</p>
                <div className="mt-4 flex items-center justify-between gap-3 text-xs">
                  <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 font-semibold text-[#d8c6e8]">
                    {Number(layout.is_default) === 1 ? "Default" : layout.status}
                  </span>
                  <span className="text-[#d8c6e8]/80">{formatDate(layout.updated_at)}</span>
                </div>
                <div className="mt-5 flex gap-2">
                  <button type="button" className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-semibold text-white hover:bg-white/10" onClick={() => window.open(layout.file_path, "_blank")}>
                    Preview
                  </button>
                  <button type="button" className="rounded-xl border border-[#C77DFF]/25 bg-[#C77DFF]/10 px-3 py-2 text-sm font-semibold text-white hover:bg-[#C77DFF]/18" onClick={() => onSetDefaultLayout(layout.layout_id)}>
                    Set Default
                  </button>
                </div>
              </article>
              ))}
            </div>
          ) : (
            <EmptyState message="No payslip layouts have been imported yet." />
          )}
        </div>

        <aside className="neon-glass neon-border rounded-2xl p-6">
          <Palette size={26} className="text-[#C77DFF]" />
          <h3 className="mt-4 font-semibold text-white">Layout Import Requirements</h3>
          <ul className="mt-4 space-y-3 text-sm text-[#d8c6e8]">
            <li className="flex gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#C77DFF]" />
              <span>Template name and version</span>
            </li>
            <li className="flex gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#C77DFF]" />
              <span>PDF or HTML layout file</span>
            </li>
            <li className="flex gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#C77DFF]" />
              <span>Sample data preview before activation</span>
            </li>
          </ul>
        </aside>
      </div>
    </PageShell>
  );
}

function SettingEditor({ definition, setting, onSave }) {
  const [value, setValue] = useState(setting?.setting_value || "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setValue(setting?.setting_value || "");
  }, [setting?.setting_value]);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      await onSave(definition.key, {
        settingValue: value,
        description: definition.description
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="neon-glass neon-border rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C77DFF]/12 text-[#C77DFF] ring-1 ring-[#C77DFF]/25">
          <Settings size={20} />
        </div>
        <div>
          <h4 className="font-semibold text-white">{definition.label}</h4>
          <p className="mt-1 text-sm text-[#d8c6e8]">{definition.description}</p>
        </div>
      </div>

      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={definition.placeholder}
        className="mt-5 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#d8c6e8]/50 focus:border-[#C77DFF]/50"
      />

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-[#d8c6e8]/70">
          {setting?.updated_at ? `Updated ${formatDate(setting.updated_at)}` : "Not configured"}
        </p>
        <button
          type="button"
          className="rounded-xl border border-[#C77DFF]/25 bg-[#C77DFF]/10 px-4 py-2 text-sm font-semibold text-white hover:bg-[#C77DFF]/18 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleSave}
          disabled={isSaving || !value.trim()}
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

function SettingsSection({ definitions, settingsByKey, title, subtitle, onSave }) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="mt-1 text-sm text-[#d8c6e8]">{subtitle}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {definitions.map((definition) => (
          <SettingEditor
            key={definition.key}
            definition={definition}
            setting={settingsByKey[definition.key]}
            onSave={onSave}
          />
        ))}
      </div>
    </section>
  );
}

function SettingInput({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none placeholder:text-[#d8c6e8]/50 focus:border-[#C77DFF]/50"
    />
  );
}

function CpfRateTable({ onSave, settingsByKey }) {
  const [rows, setRows] = useState(() =>
    cpfRateRows.map((row) => ({
      ...row,
      employeeOrdinary: settingsByKey[`cpf_rate_${row.slug}_employee_ordinary`]?.setting_value || row.employeeOrdinary,
      employeeAdditional: settingsByKey[`cpf_rate_${row.slug}_employee_additional`]?.setting_value || row.employeeAdditional,
      employerOrdinary: settingsByKey[`cpf_rate_${row.slug}_employer_ordinary`]?.setting_value || row.employerOrdinary,
      employerAdditional: settingsByKey[`cpf_rate_${row.slug}_employer_additional`]?.setting_value || row.employerAdditional
    }))
  );
  const [savingSlug, setSavingSlug] = useState("");

  useEffect(() => {
    setRows(
      cpfRateRows.map((row) => ({
        ...row,
        employeeOrdinary: settingsByKey[`cpf_rate_${row.slug}_employee_ordinary`]?.setting_value || row.employeeOrdinary,
        employeeAdditional: settingsByKey[`cpf_rate_${row.slug}_employee_additional`]?.setting_value || row.employeeAdditional,
        employerOrdinary: settingsByKey[`cpf_rate_${row.slug}_employer_ordinary`]?.setting_value || row.employerOrdinary,
        employerAdditional: settingsByKey[`cpf_rate_${row.slug}_employer_additional`]?.setting_value || row.employerAdditional
      }))
    );
  }, [settingsByKey]);

  const updateRow = (slug, field, value) => {
    setRows((currentRows) =>
      currentRows.map((row) => (row.slug === slug ? { ...row, [field]: value } : row))
    );
  };

  const saveRow = async (row) => {
    setSavingSlug(row.slug);

    try {
      await Promise.all([
        onSave(`cpf_rate_${row.slug}_employee_ordinary`, {
          settingValue: row.employeeOrdinary,
          description: `${row.ageGroup} employee CPF ordinary wage rate.`
        }),
        onSave(`cpf_rate_${row.slug}_employee_additional`, {
          settingValue: row.employeeAdditional,
          description: `${row.ageGroup} employee CPF additional wage rate.`
        }),
        onSave(`cpf_rate_${row.slug}_employer_ordinary`, {
          settingValue: row.employerOrdinary,
          description: `${row.ageGroup} employer CPF ordinary wage rate.`
        }),
        onSave(`cpf_rate_${row.slug}_employer_additional`, {
          settingValue: row.employerAdditional,
          description: `${row.ageGroup} employer CPF additional wage rate.`
        })
      ]);
    } finally {
      setSavingSlug("");
    }
  };

  return (
    <section className="neon-glass neon-border overflow-hidden rounded-2xl">
      <div className="border-b border-white/10 px-5 py-4">
        <h3 className="text-lg font-semibold text-white">CPF Rate Configuration by Age Group</h3>
        <p className="mt-1 text-sm text-[#d8c6e8]">Set employee and employer CPF rates for ordinary and additional wages.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[58rem] w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-[#C77DFF]/80">
            <tr>
              <th className="border-b border-white/10 px-4 py-3">Age Group</th>
              <th className="border-b border-white/10 px-4 py-3">Employee Ordinary %</th>
              <th className="border-b border-white/10 px-4 py-3">Employee Additional %</th>
              <th className="border-b border-white/10 px-4 py-3">Employer Ordinary %</th>
              <th className="border-b border-white/10 px-4 py-3">Employer Additional %</th>
              <th className="border-b border-white/10 px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.slug}>
                <td className="border-b border-white/10 px-4 py-4 font-semibold text-white">{row.ageGroup}</td>
                <td className="border-b border-white/10 px-4 py-4">
                  <SettingInput value={row.employeeOrdinary} onChange={(value) => updateRow(row.slug, "employeeOrdinary", value)} />
                </td>
                <td className="border-b border-white/10 px-4 py-4">
                  <SettingInput value={row.employeeAdditional} onChange={(value) => updateRow(row.slug, "employeeAdditional", value)} />
                </td>
                <td className="border-b border-white/10 px-4 py-4">
                  <SettingInput value={row.employerOrdinary} onChange={(value) => updateRow(row.slug, "employerOrdinary", value)} />
                </td>
                <td className="border-b border-white/10 px-4 py-4">
                  <SettingInput value={row.employerAdditional} onChange={(value) => updateRow(row.slug, "employerAdditional", value)} />
                </td>
                <td className="border-b border-white/10 px-4 py-4">
                  <button
                    type="button"
                    className="rounded-xl border border-[#C77DFF]/25 bg-[#C77DFF]/10 px-4 py-2 text-sm font-semibold text-white hover:bg-[#C77DFF]/18 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => saveRow(row)}
                    disabled={savingSlug === row.slug}
                  >
                    {savingSlug === row.slug ? "Saving..." : "Save"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function WageComponentTable({ onSave, settingsByKey }) {
  const [rows, setRows] = useState(() =>
    wageComponentRows.map((row) => ({
      ...row,
      includeCpf: settingsByKey[`cpf_component_${row.slug}_included`]?.setting_value || row.includeCpf,
      wageType: settingsByKey[`cpf_component_${row.slug}_wage_type`]?.setting_value || row.wageType
    }))
  );
  const [savingSlug, setSavingSlug] = useState("");

  useEffect(() => {
    setRows(
      wageComponentRows.map((row) => ({
        ...row,
        includeCpf: settingsByKey[`cpf_component_${row.slug}_included`]?.setting_value || row.includeCpf,
        wageType: settingsByKey[`cpf_component_${row.slug}_wage_type`]?.setting_value || row.wageType
      }))
    );
  }, [settingsByKey]);

  const updateRow = (slug, field, value) => {
    setRows((currentRows) =>
      currentRows.map((row) => (row.slug === slug ? { ...row, [field]: value } : row))
    );
  };

  const saveRow = async (row) => {
    setSavingSlug(row.slug);

    try {
      await Promise.all([
        onSave(`cpf_component_${row.slug}_included`, {
          settingValue: row.includeCpf,
          description: `${row.component} CPF inclusion setting.`
        }),
        onSave(`cpf_component_${row.slug}_wage_type`, {
          settingValue: row.wageType,
          description: `${row.component} CPF wage type setting.`
        })
      ]);
    } finally {
      setSavingSlug("");
    }
  };

  return (
    <section className="neon-glass neon-border overflow-hidden rounded-2xl">
      <div className="border-b border-white/10 px-5 py-4">
        <h3 className="text-lg font-semibold text-white">Wage Components for CPF</h3>
        <p className="mt-1 text-sm text-[#d8c6e8]">Define which pay components are included in CPF and how they are classified.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[48rem] w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-[#C77DFF]/80">
            <tr>
              <th className="border-b border-white/10 px-4 py-3">Pay Component</th>
              <th className="border-b border-white/10 px-4 py-3">Include in CPF</th>
              <th className="border-b border-white/10 px-4 py-3">Wage Type</th>
              <th className="border-b border-white/10 px-4 py-3">Remarks</th>
              <th className="border-b border-white/10 px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.slug}>
                <td className="border-b border-white/10 px-4 py-4 font-semibold text-white">{row.component}</td>
                <td className="border-b border-white/10 px-4 py-4">
                  <select
                    value={row.includeCpf}
                    onChange={(event) => updateRow(row.slug, "includeCpf", event.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-[#1d0b2f] px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </td>
                <td className="border-b border-white/10 px-4 py-4">
                  <select
                    value={row.wageType}
                    onChange={(event) => updateRow(row.slug, "wageType", event.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-[#1d0b2f] px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="-">-</option>
                    <option value="Ordinary Wage">Ordinary Wage</option>
                    <option value="Additional Wage">Additional Wage</option>
                  </select>
                </td>
                <td className="border-b border-white/10 px-4 py-4 text-[#d8c6e8]">{row.remarks}</td>
                <td className="border-b border-white/10 px-4 py-4">
                  <button
                    type="button"
                    className="rounded-xl border border-[#C77DFF]/25 bg-[#C77DFF]/10 px-4 py-2 text-sm font-semibold text-white hover:bg-[#C77DFF]/18 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => saveRow(row)}
                    disabled={savingSlug === row.slug}
                  >
                    {savingSlug === row.slug ? "Saving..." : "Save"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CpfCeilingPanel({ onSave, settingsByKey }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_0.75fr]">
      <SettingsSection
        definitions={cpfCeilingSettings}
        settingsByKey={settingsByKey}
        title="CPF Wage Ceiling"
        subtitle="Set the effective date and monthly wage ceiling used for payroll calculations."
        onSave={onSave}
      />
      <section className="neon-glass neon-border rounded-2xl p-5">
        <h3 className="text-lg font-semibold text-white">Wage Ceiling History</h3>
        <div className="mt-4 space-y-3">
          {cpfCeilingHistory.map(([effectiveFrom, ceiling]) => (
            <div key={effectiveFrom} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm">
              <span className="text-[#d8c6e8]">{effectiveFrom}</span>
              <span className="font-semibold text-white">SGD {ceiling}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-xl border border-[#FFB86B]/25 bg-[#FFB86B]/10 p-3 text-sm text-[#FFE2B8]">
          System should apply the ceiling based on the payroll period date.
        </p>
      </section>
    </div>
  );
}

function SettingsView({ onUpdateSetting, settings = [] }) {
  const settingsByKey = useMemo(
    () => Object.fromEntries(settings.map((setting) => [setting.setting_key, setting])),
    [settings]
  );

  return (
    <PageShell
      heading="Payroll Settings"
      actions={
        <>
          <ActionButton icon={Settings}>Payroll Configurations</ActionButton>
          <ActionButton icon={PlayCircle} variant="secondary">Test Rules</ActionButton>
        </>
      }
    >
      <div className="space-y-8">
        <SettingsSection
          definitions={cpfCalculationSettings}
          settingsByKey={settingsByKey}
          title="CPF Calculation Basis"
          subtitle="Choose the basis for CPF calculation and how CPF rates are viewed."
          onSave={onUpdateSetting}
        />
        <CpfRateTable settingsByKey={settingsByKey} onSave={onUpdateSetting} />
        <WageComponentTable settingsByKey={settingsByKey} onSave={onUpdateSetting} />
        <CpfCeilingPanel settingsByKey={settingsByKey} onSave={onUpdateSetting} />
        <SettingsSection
          definitions={cpfAccountMappings}
          settingsByKey={settingsByKey}
          title="CPF Account Mappings"
          subtitle="Map CPF liabilities and employer CPF expenses to accounting accounts."
          onSave={onUpdateSetting}
        />
        <SettingsSection
          definitions={otherCpfSettings}
          settingsByKey={settingsByKey}
          title="Other CPF Related Settings"
          subtitle="Configure CPF payment, notification and submission settings."
          onSave={onUpdateSetting}
        />
      </div>
    </PageShell>
  );
}

function PayrollMonitorView({ payrollRuns = [] }) {
  return (
    <PageShell
      heading="Payroll Monitor"
      actions={
        <>
          <ActionButton icon={Eye}>View Finance Status</ActionButton>
          <ActionButton icon={FileBarChart} variant="secondary">Export Status</ActionButton>
        </>
      }
    >
      <div className="neon-glass neon-border overflow-hidden rounded-2xl">
        <div className="grid grid-cols-4 gap-4 border-b border-white/10 px-6 py-4 text-xs font-semibold uppercase tracking-wide text-[#C77DFF]/80">
          <span>Pay Period</span>
          <span>Employees</span>
          <span>Status</span>
          <span>Action</span>
        </div>
        {payrollRuns.length ? (
          payrollRuns.map((run) => (
            <div key={run.payroll_run_id} className="grid grid-cols-4 gap-4 border-b border-white/10 px-6 py-4 text-sm last:border-b-0">
              <div>
                <p className="font-semibold text-white">{formatPayrollPeriod(run)}</p>
                <p className="mt-1 text-[#d8c6e8]">Created by {run.created_by_name || "Unknown"}</p>
              </div>
              <p className="text-[#d8c6e8]">{run.employee_count}</p>
              <p className="text-white">{run.status}</p>
              <button type="button" className="justify-self-start rounded-xl bg-white/[0.06] px-4 py-2 font-semibold text-white hover:bg-white/10">
                Review
              </button>
            </div>
          ))
        ) : (
          <div className="px-6 py-4">
            <EmptyState message="No payroll runs found." />
          </div>
        )}
      </div>
    </PageShell>
  );
}

function AuditLogsView({ auditLogs = [] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [entityFilter, setEntityFilter] = useState("All");

  const entityTypes = useMemo(
    () => ["All", ...Array.from(new Set(auditLogs.map((log) => log.entity_type).filter(Boolean)))],
    [auditLogs]
  );
  const filteredLogs = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return auditLogs.filter((log) => {
      const matchesEntity = entityFilter === "All" || log.entity_type === entityFilter;
      const matchesSearch =
        !normalizedSearch ||
        log.action?.toLowerCase().includes(normalizedSearch) ||
        log.entity_type?.toLowerCase().includes(normalizedSearch) ||
        String(log.entity_id || "").includes(normalizedSearch) ||
        log.user_name?.toLowerCase().includes(normalizedSearch);

      return matchesEntity && matchesSearch;
    });
  }, [auditLogs, entityFilter, searchTerm]);

  return (
    <PageShell
      heading="Audit Logs"
      actions={<ActionButton icon={FileBarChart} variant="secondary">Export Logs</ActionButton>}
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="neon-glass rounded-2xl p-5">
            <p className="text-sm text-[#d8c6e8]">Total Events</p>
            <p className="mt-3 text-3xl font-semibold text-white">{auditLogs.length}</p>
          </div>
          <div className="neon-glass rounded-2xl p-5">
            <p className="text-sm text-[#d8c6e8]">Visible Events</p>
            <p className="mt-3 text-3xl font-semibold text-[#C77DFF]">{filteredLogs.length}</p>
          </div>
          <div className="neon-glass rounded-2xl p-5">
            <p className="text-sm text-[#d8c6e8]">Latest Timestamp</p>
            <p className="mt-3 text-base font-semibold text-white">
              {formatDateTime(auditLogs[0]?.created_at)}
            </p>
          </div>
        </div>

        <div className="neon-glass neon-border rounded-2xl p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Activity Trail</h3>
              <p className="mt-1 text-sm text-[#d8c6e8]">Search and filter admin changes with exact timestamps.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_14rem] lg:w-[38rem]">
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5">
                <Search size={16} className="text-[#C77DFF]" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search action, user, entity..."
                  className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#d8c6e8]/60"
                />
              </label>

              <select
                value={entityFilter}
                onChange={(event) => setEntityFilter(event.target.value)}
                className="rounded-xl border border-white/10 bg-[#1d0b2f] px-3 py-2.5 text-sm font-semibold text-white outline-none"
              >
                {entityTypes.map((entityType) => (
                  <option key={entityType} value={entityType}>{entityType} entities</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-[56rem] w-full border-separate border-spacing-0 text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-[#C77DFF]/80">
                <tr>
                  <th className="border-b border-white/10 px-4 py-3 font-semibold">Timestamp</th>
                  <th className="border-b border-white/10 px-4 py-3 font-semibold">Action</th>
                  <th className="border-b border-white/10 px-4 py-3 font-semibold">Entity</th>
                  <th className="border-b border-white/10 px-4 py-3 font-semibold">Entity ID</th>
                  <th className="border-b border-white/10 px-4 py-3 font-semibold">Performed By</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.log_id} className="text-[#d8c6e8] transition hover:bg-white/[0.04]">
                    <td className="border-b border-white/10 px-4 py-4 font-semibold text-white">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="border-b border-white/10 px-4 py-4">{log.action || "System activity"}</td>
                    <td className="border-b border-white/10 px-4 py-4">
                      <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-[#d8c6e8]">
                        {log.entity_type || "system"}
                      </span>
                    </td>
                    <td className="border-b border-white/10 px-4 py-4">{log.entity_id || "-"}</td>
                    <td className="border-b border-white/10 px-4 py-4">{log.user_name || "System"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!filteredLogs.length ? (
              <div className="mt-4">
                <EmptyState message="No audit logs match the current filters." />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function escapePdfText(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function createPdfBlob(title, rows, periodLabel = "All available dates") {
  const commands = [];
  const text = (value, x, y, size = 10, color = "0.12 0.08 0.18") => {
    commands.push(
      "BT",
      `${color} rg`,
      `/F1 ${size} Tf`,
      `${x} ${y} Td`,
      `(${escapePdfText(value)}) Tj`,
      "ET"
    );
  };
  const rect = (x, y, width, height, color) => {
    commands.push("q", `${color} rg`, `${x} ${y} ${width} ${height} re`, "f", "Q");
  };
  const line = (x1, y1, x2, y2, color = "0.82 0.77 0.88") => {
    commands.push("q", `${color} RG`, "1 w", `${x1} ${y1} m`, `${x2} ${y2} l`, "S", "Q");
  };
  const wrapText = (value, maxLength = 78) => {
    const words = String(value).split(" ");
    const rows = [];
    let current = "";

    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;

      if (next.length > maxLength) {
        rows.push(current);
        current = word;
      } else {
        current = next;
      }
    });

    if (current) rows.push(current);
    return rows;
  };
  rect(0, 0, 612, 792, "0.98 0.97 1");
  rect(0, 728, 612, 64, "0.20 0.04 0.36");
  rect(0, 724, 612, 4, "0.78 0.30 1");
  text("AUTOMATED PAYROLL SYSTEM", 42, 764, 10, "0.90 0.80 1");
  text(title, 42, 742, 20, "1 1 1");
  text(`Generated: ${formatDateTime(new Date())}`, 420, 746, 9, "0.90 0.80 1");
  text(`Period: ${periodLabel}`, 42, 714, 9, "0.42 0.25 0.58");

  const normalizedRows = rows.map((row) => (typeof row === "string" ? { columns: [row] } : row));

  text("Report Details", 42, 670, 14, "0.12 0.08 0.18");
  line(42, 662, 570, 662);

  let y = 640;
  normalizedRows.slice(0, 24).forEach((item, index) => {
    const columns = item.columns || [item.summary || ""];
    const rowLines = columns.map((column) => wrapText(column, columns.length === 4 ? 22 : columns.length === 3 ? 26 : columns.length === 2 ? 36 : 78));
    const maxLines = Math.max(...rowLines.map((lines) => lines.length));
    const rowHeight = Math.max(34, maxLines * 13 + 14);
    rect(42, y - rowHeight + 8, 528, rowHeight, index % 2 === 0 ? "1 1 1" : "0.96 0.94 0.98");
    text(String(index + 1).padStart(2, "0"), 54, y - 10, 8, "0.42 0.25 0.58");
    const columnLayout =
      columns.length === 4
        ? [82, 228, 376, 482]
        : columns.length === 3
          ? [82, 260, 430]
          : columns.length === 2
            ? [82, 330]
          : [82];
    const labels =
      columns.length === 4
        ? ["Time", "Action", "Entity", "User"]
        : columns.length === 3
          ? ["Name", "Role", "Details"]
          : columns.length === 2
            ? ["Item", "Value"]
          : [];

    labels.forEach((label, columnIndex) => {
      text(label, columnLayout[columnIndex], y - 4, 6, "0.42 0.25 0.58");
    });
    rowLines.forEach((lines, columnIndex) => {
      lines.forEach((rowLine, rowIndex) => {
        text(rowLine, columnLayout[columnIndex], y - 16 - rowIndex * 12, 8, "0.12 0.08 0.18");
      });
    });
    y -= rowHeight + 4;
  });

  if (normalizedRows.length > 24) {
    text(`Showing first 24 of ${normalizedRows.length} records.`, 42, 58, 9, "0.42 0.25 0.58");
  }

  line(42, 42, 570, 42);
  text("Prepared for Admin review. Downloaded from Automated Payroll System.", 42, 26, 8, "0.42 0.25 0.58");

  const contentLines = commands;
  const content = contentLines.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

function isWithinReportPeriod(value, periodMode, fromDate, toDate) {
  if (!value || !fromDate) return true;

  const itemDate = new Date(value);
  const startDate = new Date(`${fromDate}T00:00:00`);
  const endDate = new Date(`${(periodMode === "single" ? fromDate : toDate || fromDate)}T23:59:59`);

  return itemDate >= startDate && itemDate <= endDate;
}

function getPeriodLabel(periodMode, fromDate, toDate) {
  if (!fromDate) return "All available dates";

  if (periodMode === "single") {
    return `On ${formatDate(fromDate)}`;
  }

  return `From ${formatDate(fromDate)} to ${formatDate(toDate || fromDate)}`;
}

function getReportLines(report, data = {}, periodMode = "range", fromDate = "", toDate = "") {
  const stats = data.stats || {};

  if (report === "Payroll Summary") {
    return [
      { summary: `Active users: ${stats.activeUsers ?? 0}`, columns: ["Active users", String(stats.activeUsers ?? 0)] },
      { summary: `Payroll rules: ${stats.payrollRules ?? 0}`, columns: ["Payroll rules configured", String(stats.payrollRules ?? 0)] },
      { summary: `Payroll runs: ${data.payrollRuns?.length || 0}`, columns: ["Payroll runs visible to Admin", String(data.payrollRuns?.length || 0)] },
      { summary: `Payslip layouts: ${stats.payslipLayouts ?? 0}`, columns: ["Payslip layouts configured", String(stats.payslipLayouts ?? 0)] },
      { columns: ["Audit events recorded", String(stats.adminLogs ?? 0)] }
    ];
  }

  if (report === "User & Staff Summary") {
    return (data.users || []).map((user) =>
      ({
        columns: [
          user.name,
          user.role_name,
          `${user.email} / ${user.department_name || "No department"} / ${user.employee_code || "No employee code"}`
        ]
      })
    );
  }

  if (report === "CPF Configuration Report") {
    return (data.settings || [])
      .filter((setting) => setting.setting_key.startsWith("cpf_"))
      .map((setting) => ({
        summary: `${setting.setting_key}: ${setting.setting_value}`,
        columns: [setting.setting_key, setting.setting_value, setting.description || "No description"]
      }));
  }

  return (data.auditLogs || []).map((log) =>
    log
  )
    .filter((log) => isWithinReportPeriod(log.created_at, periodMode, fromDate, toDate))
    .map((log) =>
    ({
      columns: [
        formatDateTime(log.created_at),
        log.action || "System activity",
        `${log.entity_type || "system"} #${log.entity_id || "-"}`,
        log.user_name || "System"
      ]
    })
  );
}

function ReportPreviewModal({ data, report, onClose }) {
  const [pdfUrl, setPdfUrl] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [periodMode, setPeriodMode] = useState("range");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);

  useEffect(() => {
    const periodLabel = getPeriodLabel(periodMode, fromDate, toDate);
    const lines = getReportLines(report, data, periodMode, fromDate, toDate);
    const blob = createPdfBlob(report, lines, periodLabel);
    const url = URL.createObjectURL(blob);
    setPdfUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [data, fromDate, periodMode, report, toDate]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090014]/80 px-4 backdrop-blur-sm">
      <section className="neon-glass neon-border flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl p-6">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#C77DFF]/80">PDF Preview</p>
            <h3 className="mt-2 text-xl font-semibold text-white">{report}</h3>
            <p className="mt-1 text-sm text-[#d8c6e8]">{getPeriodLabel(periodMode, fromDate, toDate)}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={pdfUrl}
              download={`${report.toLowerCase().replaceAll(" ", "-")}.pdf`}
              className="neon-button inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold"
            >
              <FileText size={17} />
              Download PDF
            </a>
            <button
              type="button"
              className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 md:grid-cols-3">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#C77DFF]/80">Period Type</span>
            <select
              value={periodMode}
              onChange={(event) => setPeriodMode(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#1d0b2f] px-3 py-2.5 text-sm font-semibold text-white outline-none"
            >
              <option value="range">From Date to Date</option>
              <option value="single">On This Day</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#C77DFF]/80">
              {periodMode === "single" ? "Date" : "From Date"}
            </span>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#1d0b2f] px-3 py-2.5 text-sm font-semibold text-white outline-none"
            />
          </label>
          {periodMode === "range" ? (
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#C77DFF]/80">To Date</span>
              <input
                type="date"
                value={toDate}
                min={fromDate}
                onChange={(event) => setToDate(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#1d0b2f] px-3 py-2.5 text-sm font-semibold text-white outline-none"
              />
            </label>
          ) : null}
        </div>
        <div className="mt-5 min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10 bg-white">
          {pdfUrl ? (
            <iframe title={`${report} preview`} src={pdfUrl} className="h-[68vh] w-full" />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ReportsView({ data }) {
  const [selectedReport, setSelectedReport] = useState("");
  const reportCards = [
    "Payroll Summary",
    "User & Staff Summary",
    "CPF Configuration Report",
    "Audit Activity Report"
  ];

  return (
    <PageShell
      heading="Reports"
      actions={
        <>
          <ActionButton icon={FileBarChart}>Generate Report</ActionButton>
          <ActionButton icon={FileText} variant="secondary">Payslip Layout Report</ActionButton>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {reportCards.map((report) => (
          <div key={report} className="neon-glass neon-border rounded-2xl p-6">
            <FileBarChart size={24} className="text-[#C77DFF]" />
            <h3 className="mt-4 font-semibold text-white">{report}</h3>
            <p className="mt-2 text-sm text-[#d8c6e8]">Preview the generated PDF and download it when ready.</p>
            <button
              type="button"
              className="mt-5 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              onClick={() => setSelectedReport(report)}
            >
              Open
            </button>
          </div>
        ))}
      </div>
      {selectedReport ? (
        <ReportPreviewModal
          data={data}
          report={selectedReport}
          onClose={() => setSelectedReport("")}
        />
      ) : null}
    </PageShell>
  );
}

function AdminPayrollContent({
  currentUserId,
  data,
  onImportLayout,
  onResetPassword,
  onSetDefaultLayout,
  onUpdateSetting,
  onUpdateRole,
  onUpdateStatus,
  pathname
}) {
  if (pathname.endsWith("/users-roles")) {
    return (
      <UsersRolesView
        currentUserId={currentUserId}
        roleSummary={data?.roleSummary}
        users={data?.users}
        onResetPassword={onResetPassword}
        onUpdateRole={onUpdateRole}
        onUpdateStatus={onUpdateStatus}
      />
    );
  }
  if (pathname.endsWith("/settings")) {
    return <SettingsView settings={data?.settings} onUpdateSetting={onUpdateSetting} />;
  }
  if (pathname.endsWith("/payslip-layouts")) {
    return (
      <PayslipLayoutsView
        layouts={data?.layouts}
        onImportLayout={onImportLayout}
        onSetDefaultLayout={onSetDefaultLayout}
      />
    );
  }
  if (pathname.endsWith("/payroll-monitor")) return <PayrollMonitorView payrollRuns={data?.payrollRuns} />;
  if (pathname.endsWith("/audit-logs")) return <AuditLogsView auditLogs={data?.auditLogs} />;
  if (pathname.endsWith("/reports")) return <ReportsView data={data} />;

  return (
    <DashboardView
      data={data}
      onImportLayout={onImportLayout}
      onSetDefaultLayout={onSetDefaultLayout}
    />
  );
}

export default function AdminPayrollPage() {
  const session = getStoredSession();
  const location = useLocation();
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadDashboard = async () => {
    try {
      setErrorMessage("");
      const data = await getAdminPayrollDashboard();
      setDashboardData(data);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleImportLayout = async () => {
    const layoutName = window.prompt("Payslip layout name");

    if (!layoutName) return;

    const filePath = window.prompt("Template file path or URL");

    if (!filePath) return;

    const fileType = window.prompt("File type: PDF or HTML", "PDF");

    if (!fileType) return;

    try {
      const result = await addPayslipLayout({ layoutName, filePath, fileType });
      setDashboardData((current) => ({
        ...current,
        layouts: result.layouts,
        stats: {
          ...(current?.stats || {}),
          payslipLayouts: result.layouts.filter((layout) => layout.status === "Active").length
        }
      }));
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const handleSetDefaultLayout = async (layoutId) => {
    try {
      const result = await setDefaultPayslipLayout(layoutId);
      setDashboardData((current) => ({
        ...current,
        layouts: result.layouts
      }));
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const applyUserManagementResult = (result) => {
    setDashboardData((current) => ({
      ...current,
      auditLogs: result.auditLogs,
      roleSummary: result.roleSummary,
      stats: {
        ...(current?.stats || {}),
        ...result.stats
      },
      users: result.users
    }));
  };

  const handleUpdateUserStatus = async (userId, status) => {
    try {
      const result = await updateUserStatus(userId, status);
      applyUserManagementResult(result);
    } catch (error) {
      setErrorMessage(error.message);
      throw error;
    }
  };

  const handleUpdateUserRole = async (userId, roleId) => {
    try {
      const result = await updateUserRole(userId, roleId);
      applyUserManagementResult(result);
    } catch (error) {
      setErrorMessage(error.message);
      throw error;
    }
  };

  const handleResetUserPassword = async (userId) => {
    try {
      const result = await resetUserPassword(userId);
      applyUserManagementResult(result);
      return result;
    } catch (error) {
      setErrorMessage(error.message);
      throw error;
    }
  };

  const handleUpdatePayrollSetting = async (settingKey, payload) => {
    try {
      const result = await updatePayrollSetting(settingKey, payload);
      setDashboardData((current) => ({
        ...current,
        auditLogs: result.auditLogs,
        settings: result.settings,
        stats: {
          ...(current?.stats || {}),
          ...result.stats
        }
      }));
    } catch (error) {
      setErrorMessage(error.message);
      throw error;
    }
  };

  return (
    <DashboardLayout
      pageTitle={pageTitle}
      user={session?.user}
      sidebarSections={payrollSidebarSections}
      sidebarTitle="Automated Payroll System"
      searchPlaceholder="Search payroll runs, employees, settings..."
    >
      {isLoading ? (
        <div className="neon-glass neon-border rounded-2xl p-6 text-sm text-[#d8c6e8]">
          Loading admin payroll data...
        </div>
      ) : null}
      {errorMessage ? (
        <div className="mb-4 rounded-xl border border-[#FFB86B]/25 bg-[#FFB86B]/10 p-4 text-sm text-[#FFE2B8]">
          {errorMessage}
        </div>
      ) : null}
      {!isLoading ? (
        <AdminPayrollContent
          currentUserId={session?.user?.userId}
          pathname={location.pathname}
          data={dashboardData}
          onImportLayout={handleImportLayout}
          onResetPassword={handleResetUserPassword}
          onSetDefaultLayout={handleSetDefaultLayout}
          onUpdateSetting={handleUpdatePayrollSetting}
          onUpdateRole={handleUpdateUserRole}
          onUpdateStatus={handleUpdateUserStatus}
        />
      ) : null}
    </DashboardLayout>
  );
}
