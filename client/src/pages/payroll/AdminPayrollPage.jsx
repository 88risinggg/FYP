import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Eye,
  FileBarChart,
  FileText,
  Filter,
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
  Users,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";

import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import {
  addPayslipLayout,
  createUser,
  getAdminPayrollDashboard,
  resetUserPassword,
  setDefaultPayslipLayout,
  updatePayrollSetting,
  updateUserRole,
  updateUserStatus,
} from "../../services/adminPayrollService.js";

import { getStoredSession } from "../../services/sessionService.js";

import {
  buildSettingsByKey,
  cpfAgeTierRows,
  cpfCalculationSettings,
  cpfCeilingHistory,
  cpfCeilingSettings,
  deductionComponentRows,
  earningComponentRows,
  employerContributionRows,
  slugify,
} from "../../utils/payrollRules.js";

const pageTitle = "Automated Payroll System – Admin Payroll Dashboard";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const payrollSidebarSections = [
  {
    label: "ADMIN",
    items: [
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        path: "/dashboard/payroll/admin",
        end: true
      },
      {
        label: "Payslips Approval",
        icon: CheckCircle2,
        path: "/dashboard/payroll/admin/payslips-approval"
      },
      {
        label: "Staff Management",
        icon: Users,
        path: "/dashboard/payroll/admin/staff-management"
      },
      {
        label: "System Settings",
        icon: Settings,
        path: "/dashboard/payroll/admin/settings"
      },
      {
        label: "Compliance Rules",
        icon: ShieldCheck,
        path: "/dashboard/payroll/admin/compliance-rules"
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
    action: "Open Rules",
    path: "/dashboard/payroll/admin/settings"
  },
  {
    title: "Manage Users & Roles",
    icon: Users,
    status: "Active",
    owner: "Admin",
    updatedKey: "users",
    details: ["Admin, HR and Finance access", "Payroll module permissions", "Active and inactive user accounts"],
    action: "Manage Access",
    path: "/dashboard/payroll/admin/users-roles"
  },
  {
    title: "Import Payslip Layout",
    icon: Palette,
    status: "Not Configured",
    owner: "Admin",
    updatedKey: "layouts",
    details: ["Upload layout file", "Set default template", "Preview sample payslip output"],
    action: "Import Design",
    path: "/dashboard/payroll/admin/payslip-layouts"
  },
  {
    title: "Maintain Staff Setup",
    icon: ClipboardList,
    status: "Needs Data",
    owner: "Admin / HR",
    updatedKey: "users",
    details: ["Department assignment", "Base salary reference", "Employee account link"],
    action: "View Staff Setup",
    path: "/dashboard/payroll/admin/users-roles"
  },
  {
    title: "Monitor Payroll Status",
    icon: ShieldCheck,
    status: "View Only",
    owner: "Finance",
    updatedKey: "payrollRuns",
    details: ["Finance payroll progress", "Generated payslip status", "System exception visibility"],
    action: "Open Monitor",
    path: "/dashboard/payroll/admin/payroll-monitor"
  },
  {
    title: "Audit & Reports",
    icon: History,
    status: "Tracking",
    owner: "System",
    updatedKey: "auditLogs",
    details: ["Admin changes", "Template updates", "System access records"],
    action: "View Logs",
    path: "/dashboard/payroll/admin/audit-logs"
  }
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

const mbmfDefaultSettings = {
  enabled: "Enabled",
  effectiveFrom: "2026-01-01",
  rateType: "Percentage of Gross Salary",
  employeeRate: "0.50",
  employerRate: "0.50",
  monthlyWageCeiling: "7000.00",
  employerExpenseAccount: "6810 - MBMF Employer Expense",
  employeePayableAccount: "2110 - MBMF Payable (Employee)",
  clearingAccount: "2140 - MBMF Payable Clearing",
  paymentBankAccount: "1210 - Bank - MBMF",
  applicableReligion: "Muslim"
};

const selfHelpGroupConfigs = [
  {
    key: "mbmf",
    label: "MBMF",
    eligibilityField: "religion",
    eligibilityValue: "Muslim",
    description: "Mosque Building and Mendaki Fund contribution for Muslim employees."
  },
  {
    key: "cdac",
    label: "CDAC",
    eligibilityField: "race",
    eligibilityValue: "Chinese",
    description: "Chinese Development Assistance Council contribution for Chinese employees."
  },
  {
    key: "sinda",
    label: "SINDA",
    eligibilityField: "race",
    eligibilityValue: "Indian",
    description: "Singapore Indian Development Association contribution for Indian employees."
  },
  {
    key: "ecf",
    label: "ECF",
    eligibilityField: "race",
    eligibilityValue: "Eurasian",
    description: "Eurasian Community Fund contribution for Eurasian employees."
  }
];

const statutorySchemeSettings = [
  {
    key: "sdl_enabled",
    label: "SDL Enabled",
    description: "Enable Skills Development Levy tracking for employees working in Singapore.",
    placeholder: "Enabled"
  },
  {
    key: "sdl_rate_rule",
    label: "SDL Rate Rule",
    description: "SDL is employer-side and based on monthly remuneration.",
    placeholder: "0.25%, minimum SGD 2, maximum SGD 11.25"
  },
  {
    key: "foreign_worker_levy_enabled",
    label: "Foreign Worker Levy Enabled",
    description: "Track employer-side levy for Work Permit and S Pass holders where applicable.",
    placeholder: "Enabled"
  },
  {
    key: "foreign_worker_levy_basis",
    label: "Foreign Worker Levy Basis",
    description: "MOM levy depends on sector, quota, skill tier and pass type.",
    placeholder: "MOM sector/quota/pass type"
  },
  {
    key: "iras_ais_enabled",
    label: "IRAS AIS Enabled",
    description: "Enable annual employment income reporting preparation.",
    placeholder: "Enabled"
  },
  {
    key: "iras_ais_reporting_year",
    label: "IRAS AIS Reporting Year",
    description: "Year of Assessment or reporting cycle used for payroll reports.",
    placeholder: "YA2027"
  },
  {
    key: "ir21_tax_clearance_tracking",
    label: "IR21 Tax Clearance",
    description: "Track tax clearance requirement for foreign employees leaving employment or Singapore.",
    placeholder: "Review required for foreign employees"
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

function PageShell({ heading, children, actions, updatedAt }) {
  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#C77DFF]/80">
            Admin Payroll Workflow
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{heading}</h2>
          <p className="mt-2 flex items-center gap-2 text-sm text-[#d8c6e8]">
            <CalendarDays size={15} className="text-[#C77DFF]" />
            Last updated: {updatedAt ? formatDateTime(updatedAt) : "Not updated"}
          </p>
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

function getPayrollRunDate(run) {
  if (run?.payroll_year && run?.payroll_month) {
    return new Date(run.payroll_year, run.payroll_month - 1, 1);
  }

  return run?.created_at ? new Date(run.created_at) : null;
}

function getDashboardUpdateSegments(data = {}) {
  const source = data || {};

  return [
    {
      label: "Compliance Rules",
      records: `${source.settings?.length || 0} rule(s)`,
      updatedAt: getLatestTimestamp(source.settings)
    },
    {
      label: "Users & Roles",
      records: `${source.users?.length || 0} user(s)`,
      updatedAt: getLatestTimestamp(source.users)
    },
    {
      label: "Payroll Monitor",
      records: `${source.payrollRuns?.length || 0} run(s)`,
      updatedAt: getLatestTimestamp(source.payrollRuns)
    },
    {
      label: "Payslip Layouts",
      records: `${source.layouts?.length || 0} layout(s)`,
      updatedAt: getLatestTimestamp(source.layouts)
    },
    {
      label: "Audit Trail",
      records: `${source.auditLogs?.length || 0} event(s)`,
      updatedAt: getLatestTimestamp(source.auditLogs)
    }
  ];
}

function getOverallUpdatedAt(data = {}) {
  const source = data || {};

  return getLatestTimestamp([
    ...(source.settings || []),
    ...(source.users || []),
    ...(source.payrollRuns || []),
    ...(source.layouts || []),
    ...(source.auditLogs || [])
  ]);
}

function parseCustomComplianceRule(setting) {
  try {
    const value = JSON.parse(setting.setting_value || "{}");

    return {
      category: value.category || "Payroll Compliance",
      effectiveFrom: value.effectiveFrom || "",
      ruleText: value.ruleText || "",
      source: value.source || "",
      status: value.status || "Active",
      title: value.title || setting.setting_key.replace(/^custom_compliance_rule_/, "").replaceAll("_", " "),
      updatedAt: setting.updated_at,
      updatedByName: setting.updated_by_name,
      settingKey: setting.setting_key
    };
  } catch {
    return {
      category: "Payroll Compliance",
      effectiveFrom: "",
      ruleText: setting.setting_value || "",
      source: "",
      status: "Active",
      title: setting.setting_key.replace(/^custom_compliance_rule_/, "").replaceAll("_", " "),
      updatedAt: setting.updated_at,
      updatedByName: setting.updated_by_name,
      settingKey: setting.setting_key
    };
  }
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

function WorkflowCard({ data, onNavigate, step }) {
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
        onClick={() => onNavigate(step.path)}
      >
        {step.action}
      </button>
    </article>
  );
}

function DashboardView({ data, onImportLayout, onNavigate, onSetDefaultLayout }) {
  const stats = data?.stats || {};
  const dashboardUpdates = getDashboardUpdateSegments(data);
  const dashboardStats = [
    { label: "Active Users", value: stats.activeUsers ?? 0, tone: "text-[#C77DFF]", updatedAt: getLatestTimestamp(data?.users) },
    { label: "Payroll Rules", value: stats.payrollRules ?? 0, tone: "text-white", updatedAt: getLatestTimestamp(data?.settings) },
    { label: "Payslip Layouts", value: stats.payslipLayouts ?? 0, tone: "text-[#7CFFB2]", updatedAt: getLatestTimestamp(data?.layouts) },
    { label: "Admin Logs", value: stats.adminLogs ?? 0, tone: "text-[#FFB86B]", updatedAt: getLatestTimestamp(data?.auditLogs) }
  ];
  const defaultLayout = data?.layouts?.find((layout) => Number(layout.is_default) === 1);

  return (
    <PageShell
      heading="Dashboard"
      updatedAt={getOverallUpdatedAt(data)}
      actions={
        <>
          <ActionButton icon={Plus} onClick={() => onNavigate("/dashboard/payroll/admin/settings")}>Add Payroll Rule</ActionButton>
          <ActionButton icon={Upload} variant="secondary" onClick={onImportLayout}>Import Payslip Design</ActionButton>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dashboardStats.map((stat) => (
          <div key={stat.label} className="neon-glass rounded-2xl p-5">
            <p className="text-sm text-[#d8c6e8]">{stat.label}</p>
            <p className={`mt-3 text-3xl font-semibold ${stat.tone}`}>{stat.value}</p>
            <p className="mt-3 flex items-center gap-2 text-xs text-[#d8c6e8]/80">
              <CalendarDays size={14} className="text-[#C77DFF]" />
              {stat.updatedAt ? `Updated ${formatDateTime(stat.updatedAt)}` : "No update date"}
            </p>
          </div>
        ))}
      </div>

      <section className="mt-6 neon-glass neon-border rounded-2xl p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Overall Update Timeline</h3>
            <p className="mt-1 text-sm text-[#d8c6e8]">Last changed date for each admin payroll segment.</p>
          </div>
          <p className="text-sm font-semibold text-[#C77DFF]">
            Latest: {formatDateTime(getLatestTimestamp(dashboardUpdates.map((item) => ({ updated_at: item.updatedAt }))))}
          </p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-5">
          {dashboardUpdates.map((item) => (
            <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm font-semibold text-white">{item.label}</p>
              <p className="mt-1 text-xs text-[#d8c6e8]">{item.records}</p>
              <p className="mt-3 text-xs font-semibold text-[#C77DFF]">
                {item.updatedAt ? formatDateTime(item.updatedAt) : "Not updated"}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {workflowSteps.map((step) => (
              <WorkflowCard key={step.title} data={data} onNavigate={onNavigate} step={step} />
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
  availableStaff = [],
  onCreateUser,
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
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);

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
  const openFirstManageableUser = () => {
    const firstManageableUser = filteredUsers.find((user) => user.user_id !== currentUserId) || filteredUsers[0];

    if (firstManageableUser) setManagedUser(firstManageableUser);
  };
  return (
    <PageShell
      heading="Users & Roles"
      updatedAt={getLatestTimestamp(users)}
      actions={
        <>
          <ActionButton icon={Users} onClick={() => setIsAddUserOpen(true)}>Add User</ActionButton>
          <ActionButton icon={ShieldCheck} variant="secondary" onClick={openFirstManageableUser} disabled={!filteredUsers.length}>Manage Role Access</ActionButton>
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
      {isAddUserOpen ? (
        <AddUserModal
          availableStaff={availableStaff}
          roles={roleSummary}
          onClose={() => setIsAddUserOpen(false)}
          onCreateUser={onCreateUser}
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

function AddUserModal({ availableStaff = [], onClose, onCreateUser, roles = [] }) {
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    roleId: String(roles[0]?.role_id || ""),
    staffEmployeeId: "",
    status: "1"
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (field, value) => {
    setFormData((current) => ({
      ...current,
      [field]: value
    }));
  };

  const handleStaffChange = (employeeId) => {
    const selectedStaff = availableStaff.find((staff) => String(staff.employee_id) === String(employeeId));

    setFormData((current) => ({
      ...current,
      staffEmployeeId: employeeId,
      name: selectedStaff?.name || current.name,
      email: selectedStaff?.email || current.email
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setTemporaryPassword("");
    setIsSubmitting(true);

    try {
      const result = await onCreateUser({
        email: formData.email,
        name: formData.name,
        roleId: Number(formData.roleId),
        staffEmployeeId: formData.staffEmployeeId ? Number(formData.staffEmployeeId) : null,
        status: Number(formData.status)
      });

      setTemporaryPassword(result.temporaryPassword);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090014]/80 px-4 backdrop-blur-sm">
      <section className="neon-glass neon-border max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl p-6">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#C77DFF]/80">Admin User Access</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Add New User</h3>
            <p className="mt-1 text-sm text-[#d8c6e8]">Create a login account and link it to an existing staff profile when needed.</p>
          </div>
          <button
            type="button"
            className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-white">Link Staff Profile</span>
            <select
              value={formData.staffEmployeeId}
              onChange={(event) => handleStaffChange(event.target.value)}
              className="rounded-xl border border-white/10 bg-[#1d0b2f] px-3 py-2.5 text-sm font-semibold text-white outline-none"
            >
              <option value="">No staff link</option>
              {availableStaff.map((staff) => (
                <option key={staff.employee_id} value={staff.employee_id}>
                  {staff.name} / {staff.email}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-white">Name</span>
              <input
                type="text"
                value={formData.name}
                onChange={(event) => updateField("name", event.target.value)}
                className="rounded-xl border border-white/10 bg-[#1d0b2f] px-3 py-2.5 text-sm font-semibold text-white outline-none"
                required
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-white">Email</span>
              <input
                type="email"
                value={formData.email}
                onChange={(event) => updateField("email", event.target.value)}
                className="rounded-xl border border-white/10 bg-[#1d0b2f] px-3 py-2.5 text-sm font-semibold text-white outline-none"
                required
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-white">Role</span>
              <select
                value={formData.roleId}
                onChange={(event) => updateField("roleId", event.target.value)}
                className="rounded-xl border border-white/10 bg-[#1d0b2f] px-3 py-2.5 text-sm font-semibold text-white outline-none"
                required
              >
                {roles.map((role) => (
                  <option key={role.role_id} value={role.role_id}>{role.role_name}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-white">Status</span>
              <select
                value={formData.status}
                onChange={(event) => updateField("status", event.target.value)}
                className="rounded-xl border border-white/10 bg-[#1d0b2f] px-3 py-2.5 text-sm font-semibold text-white outline-none"
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </label>
          </div>

          {errorMessage ? (
            <div className="rounded-xl border border-[#FFB86B]/25 bg-[#FFB86B]/10 p-4 text-sm text-[#FFE2B8]">
              {errorMessage}
            </div>
          ) : null}

          {temporaryPassword ? (
            <div className="rounded-xl border border-[#7CFFB2]/25 bg-[#7CFFB2]/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#7CFFB2]">Temporary Password</p>
              <p className="mt-2 break-all font-mono text-sm text-white">{temporaryPassword}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3 border-t border-white/10 pt-5">
            <button
              type="button"
              className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              onClick={onClose}
            >
              Done
            </button>
            <button
              type="submit"
              className="neon-button px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting || !roles.length}
            >
              {isSubmitting ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </section>
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
              <ProfileField label="Race" value={user.race} />
              <ProfileField label="Religion" value={user.religion} />
              <ProfileField label="Hire Date" value={formatDate(user.hire_date)} />
              <ProfileField label="Base Salary" value={formatMoney(user.base_salary)} />
              <ProfileField label="Race" value={user.race} />
              <ProfileField label="Religion" value={user.religion} />
              <ProfileField label="Bank" value={user.bank} />
              <ProfileField label="Account No." value={user.account_no} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function PayslipLayoutsView({ layouts = [], onImportLayout, onSetDefaultLayout }) {
  const defaultLayout = layouts.find((layout) => Number(layout.is_default) === 1) || layouts[0];

  return (
    <PageShell
      heading="Payslip Layouts"
      updatedAt={getLatestTimestamp(layouts)}
      actions={
        <>
          <ActionButton icon={Upload} onClick={onImportLayout}>Import Layout</ActionButton>
          <ActionButton
            icon={Eye}
            variant="secondary"
            disabled={!defaultLayout?.file_path}
            onClick={() => window.open(defaultLayout.file_path, "_blank")}
          >
            Preview Sample
          </ActionButton>
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
    cpfAgeTierRows.map((row) => ({
      ...row,
      employeeRate: settingsByKey[`cpf_rate_${row.slug}_employee_percent`]?.setting_value || settingsByKey[`cpf_rate_${row.slug}_employee_ordinary`]?.setting_value || row.employeeRate,
      employerRate: settingsByKey[`cpf_rate_${row.slug}_employer_percent`]?.setting_value || settingsByKey[`cpf_rate_${row.slug}_employer_ordinary`]?.setting_value || row.employerRate
    }))
  );
  const [savingSlug, setSavingSlug] = useState("");

  useEffect(() => {
    setRows(
      cpfAgeTierRows.map((row) => ({
        ...row,
        employeeRate: settingsByKey[`cpf_rate_${row.slug}_employee_percent`]?.setting_value || settingsByKey[`cpf_rate_${row.slug}_employee_ordinary`]?.setting_value || row.employeeRate,
        employerRate: settingsByKey[`cpf_rate_${row.slug}_employer_percent`]?.setting_value || settingsByKey[`cpf_rate_${row.slug}_employer_ordinary`]?.setting_value || row.employerRate
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
        onSave(`cpf_rate_${row.slug}_employee_percent`, {
          settingValue: row.employeeRate,
          description: `${row.ageGroup} employee CPF rate.`
        }),
        onSave(`cpf_rate_${row.slug}_employer_percent`, {
          settingValue: row.employerRate,
          description: `${row.ageGroup} employer CPF rate.`
        })
      ]);
    } finally {
      setSavingSlug("");
    }
  };

  return (
    <section className="neon-glass neon-border overflow-hidden rounded-2xl">
      <div className="border-b border-white/10 px-5 py-4">
        <h3 className="text-lg font-semibold text-white">CPF Age-Tier Rates</h3>
        <p className="mt-1 text-sm text-[#d8c6e8]">Set employee and employer CPF percentage rates by age tier.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[44rem] w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-[#C77DFF]/80">
            <tr>
              <th className="border-b border-white/10 px-4 py-3">Age Group</th>
              <th className="border-b border-white/10 px-4 py-3">Employee CPF %</th>
              <th className="border-b border-white/10 px-4 py-3">Employer CPF %</th>
              <th className="border-b border-white/10 px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.slug}>
                <td className="border-b border-white/10 px-4 py-4 font-semibold text-white">{row.ageGroup}</td>
                <td className="border-b border-white/10 px-4 py-4">
                  <SettingInput value={row.employeeRate} onChange={(value) => updateRow(row.slug, "employeeRate", value)} />
                </td>
                <td className="border-b border-white/10 px-4 py-4">
                  <SettingInput value={row.employerRate} onChange={(value) => updateRow(row.slug, "employerRate", value)} />
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
    earningComponentRows.map((row) => ({
      ...row,
      includeCpf: settingsByKey[`earning_component_${row.slug}_cpf_applicable`]?.setting_value || settingsByKey[`cpf_component_${row.slug}_included`]?.setting_value || row.includeCpf,
      wageType: settingsByKey[`earning_component_${row.slug}_wage_type`]?.setting_value || settingsByKey[`cpf_component_${row.slug}_wage_type`]?.setting_value || row.wageType,
      remarks: settingsByKey[`earning_component_${row.slug}_remarks`]?.setting_value || row.remarks
    }))
  );
  const [savingSlug, setSavingSlug] = useState("");

  useEffect(() => {
    setRows(
      earningComponentRows.map((row) => ({
        ...row,
        includeCpf: settingsByKey[`earning_component_${row.slug}_cpf_applicable`]?.setting_value || settingsByKey[`cpf_component_${row.slug}_included`]?.setting_value || row.includeCpf,
        wageType: settingsByKey[`earning_component_${row.slug}_wage_type`]?.setting_value || settingsByKey[`cpf_component_${row.slug}_wage_type`]?.setting_value || row.wageType,
        remarks: settingsByKey[`earning_component_${row.slug}_remarks`]?.setting_value || row.remarks
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
        onSave(`earning_component_${row.slug}_cpf_applicable`, {
          settingValue: row.includeCpf,
          description: `${row.component} CPF applicability setting.`
        }),
        onSave(`earning_component_${row.slug}_wage_type`, {
          settingValue: row.wageType,
          description: `${row.component} CPF wage type setting.`
        }),
        onSave(`earning_component_${row.slug}_remarks`, {
          settingValue: row.remarks,
          description: `${row.component} earning component remarks.`
        })
      ]);
    } finally {
      setSavingSlug("");
    }
  };

  return (
    <section className="neon-glass neon-border overflow-hidden rounded-2xl">
      <div className="border-b border-white/10 px-5 py-4">
        <h3 className="text-lg font-semibold text-white">Earning Component Classification</h3>
        <p className="mt-1 text-sm text-[#d8c6e8]">Define which earning components feed CPF and how each wage type is classified.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[58rem] w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-[#C77DFF]/80">
            <tr>
              <th className="border-b border-white/10 px-4 py-3">Component Name</th>
              <th className="border-b border-white/10 px-4 py-3">CPF Applicable</th>
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
                    <option value="Ordinary Wage">Ordinary Wage</option>
                    <option value="Additional Wage">Additional Wage</option>
                    <option value="Non-CPF">Non-CPF</option>
                  </select>
                </td>
                <td className="border-b border-white/10 px-4 py-4">
                  <SettingInput value={row.remarks} onChange={(value) => updateRow(row.slug, "remarks", value)} />
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

function DeductionComponentTable({ onSave, settingsByKey }) {
  const [rows, setRows] = useState(() =>
    deductionComponentRows.map((row) => ({
      ...row,
      type: settingsByKey[`deduction_component_${row.slug}_type`]?.setting_value || row.type,
      affectsNetPay: settingsByKey[`deduction_component_${row.slug}_affects_net_pay`]?.setting_value || row.affectsNetPay,
      affectsCpfWageBase: settingsByKey[`deduction_component_${row.slug}_affects_cpf_wage_base`]?.setting_value || row.affectsCpfWageBase,
      remarks: settingsByKey[`deduction_component_${row.slug}_remarks`]?.setting_value || row.remarks
    }))
  );
  const [savingSlug, setSavingSlug] = useState("");

  useEffect(() => {
    setRows(
      deductionComponentRows.map((row) => ({
        ...row,
        type: settingsByKey[`deduction_component_${row.slug}_type`]?.setting_value || row.type,
        affectsNetPay: settingsByKey[`deduction_component_${row.slug}_affects_net_pay`]?.setting_value || row.affectsNetPay,
        affectsCpfWageBase: settingsByKey[`deduction_component_${row.slug}_affects_cpf_wage_base`]?.setting_value || row.affectsCpfWageBase,
        remarks: settingsByKey[`deduction_component_${row.slug}_remarks`]?.setting_value || row.remarks
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
        onSave(`deduction_component_${row.slug}_type`, {
          settingValue: row.type,
          description: `${row.deduction} deduction type.`
        }),
        onSave(`deduction_component_${row.slug}_affects_net_pay`, {
          settingValue: row.affectsNetPay,
          description: `${row.deduction} affects net pay setting.`
        }),
        onSave(`deduction_component_${row.slug}_affects_cpf_wage_base`, {
          settingValue: row.affectsCpfWageBase,
          description: `${row.deduction} affects CPF wage base setting.`
        }),
        onSave(`deduction_component_${row.slug}_remarks`, {
          settingValue: row.remarks,
          description: `${row.deduction} deduction remarks.`
        })
      ]);
    } finally {
      setSavingSlug("");
    }
  };

  return (
    <section className="neon-glass neon-border overflow-hidden rounded-2xl">
      <div className="border-b border-white/10 px-5 py-4">
        <h3 className="text-lg font-semibold text-white">Deduction Component Classification</h3>
        <p className="mt-1 text-sm text-[#d8c6e8]">Define deduction treatment for net pay and CPF wage base validation.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[66rem] w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-[#C77DFF]/80">
            <tr>
              <th className="border-b border-white/10 px-4 py-3">Deduction Name</th>
              <th className="border-b border-white/10 px-4 py-3">Type</th>
              <th className="border-b border-white/10 px-4 py-3">Affects Net Pay</th>
              <th className="border-b border-white/10 px-4 py-3">Affects CPF Wage Base</th>
              <th className="border-b border-white/10 px-4 py-3">Remarks</th>
              <th className="border-b border-white/10 px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.slug}>
                <td className="border-b border-white/10 px-4 py-4 font-semibold text-white">{row.deduction}</td>
                <td className="border-b border-white/10 px-4 py-4">
                  <select
                    value={row.type}
                    onChange={(event) => updateRow(row.slug, "type", event.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-[#1d0b2f] px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="Statutory">Statutory</option>
                    <option value="Loan">Loan</option>
                    <option value="Recovery">Recovery</option>
                    <option value="Other">Other</option>
                  </select>
                </td>
                <td className="border-b border-white/10 px-4 py-4">
                  <select
                    value={row.affectsNetPay}
                    onChange={(event) => updateRow(row.slug, "affectsNetPay", event.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-[#1d0b2f] px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </td>
                <td className="border-b border-white/10 px-4 py-4">
                  <select
                    value={row.affectsCpfWageBase}
                    onChange={(event) => updateRow(row.slug, "affectsCpfWageBase", event.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-[#1d0b2f] px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </td>
                <td className="border-b border-white/10 px-4 py-4">
                  <SettingInput value={row.remarks} onChange={(value) => updateRow(row.slug, "remarks", value)} />
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

function EmployerContributionTable({ onSave, settingsByKey }) {
  const [rows, setRows] = useState(() =>
    employerContributionRows.map((row) => ({
      ...row,
      type: settingsByKey[`employer_contribution_${row.slug}_type`]?.setting_value || row.type,
      basis: settingsByKey[`employer_contribution_${row.slug}_basis`]?.setting_value || row.basis,
      remarks: settingsByKey[`employer_contribution_${row.slug}_remarks`]?.setting_value || row.remarks
    }))
  );
  const [savingSlug, setSavingSlug] = useState("");

  useEffect(() => {
    setRows(
      employerContributionRows.map((row) => ({
        ...row,
        type: settingsByKey[`employer_contribution_${row.slug}_type`]?.setting_value || row.type,
        basis: settingsByKey[`employer_contribution_${row.slug}_basis`]?.setting_value || row.basis,
        remarks: settingsByKey[`employer_contribution_${row.slug}_remarks`]?.setting_value || row.remarks
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
        onSave(`employer_contribution_${row.slug}_type`, {
          settingValue: row.type,
          description: `${row.item} employer contribution type.`
        }),
        onSave(`employer_contribution_${row.slug}_basis`, {
          settingValue: row.basis,
          description: `${row.item} employer contribution basis.`
        }),
        onSave(`employer_contribution_${row.slug}_remarks`, {
          settingValue: row.remarks,
          description: `${row.item} employer contribution remarks.`
        })
      ]);
    } finally {
      setSavingSlug("");
    }
  };

  return (
    <section className="neon-glass neon-border overflow-hidden rounded-2xl">
      <div className="border-b border-white/10 px-5 py-4">
        <h3 className="text-lg font-semibold text-white">Employer Contribution Items</h3>
        <p className="mt-1 text-sm text-[#d8c6e8]">Define employer-side statutory and payroll cost items for Finance review.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[52rem] w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-[#C77DFF]/80">
            <tr>
              <th className="border-b border-white/10 px-4 py-3">Item</th>
              <th className="border-b border-white/10 px-4 py-3">Type</th>
              <th className="border-b border-white/10 px-4 py-3">Basis</th>
              <th className="border-b border-white/10 px-4 py-3">Remarks</th>
              <th className="border-b border-white/10 px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.slug}>
                <td className="border-b border-white/10 px-4 py-4 font-semibold text-white">{row.item}</td>
                <td className="border-b border-white/10 px-4 py-4">
                  <select
                    value={row.type}
                    onChange={(event) => updateRow(row.slug, "type", event.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-[#1d0b2f] px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="Statutory">Statutory</option>
                    <option value="Other">Other</option>
                  </select>
                </td>
                <td className="border-b border-white/10 px-4 py-4">
                  <SettingInput value={row.basis} onChange={(value) => updateRow(row.slug, "basis", value)} />
                </td>
                <td className="border-b border-white/10 px-4 py-4">
                  <SettingInput value={row.remarks} onChange={(value) => updateRow(row.slug, "remarks", value)} />
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

function getMbmfValue(settingsByKey, key, fallback) {
  return settingsByKey[key]?.setting_value || fallback;
}

function getSchemeValue(settingsByKey, schemeKey, field, fallback) {
  return settingsByKey[`${schemeKey}_${field}`]?.setting_value || fallback;
}

function getEligibleUsers(users = [], field, value) {
  const expectedValue = String(value || "").trim().toLowerCase();

  return users.filter((user) => String(user?.[field] || "").trim().toLowerCase() === expectedValue);
}

function MbmfContributionPanel({ eligibility, onSave, settingsByKey }) {
  const [form, setForm] = useState(() => ({
    enabled: getMbmfValue(settingsByKey, "mbmf_enabled", mbmfDefaultSettings.enabled),
    effectiveFrom: getMbmfValue(settingsByKey, "mbmf_effective_from", mbmfDefaultSettings.effectiveFrom),
    rateType: getMbmfValue(settingsByKey, "mbmf_rate_type", mbmfDefaultSettings.rateType),
    employeeRate: getMbmfValue(settingsByKey, "mbmf_employee_rate_percent", mbmfDefaultSettings.employeeRate),
    employerRate: getMbmfValue(settingsByKey, "mbmf_employer_rate_percent", mbmfDefaultSettings.employerRate),
    monthlyWageCeiling: getMbmfValue(settingsByKey, "mbmf_monthly_wage_ceiling", mbmfDefaultSettings.monthlyWageCeiling),
    employerExpenseAccount: getMbmfValue(settingsByKey, "mbmf_gl_employer_expense_account", mbmfDefaultSettings.employerExpenseAccount),
    employeePayableAccount: getMbmfValue(settingsByKey, "mbmf_gl_employee_payable_account", mbmfDefaultSettings.employeePayableAccount),
    clearingAccount: getMbmfValue(settingsByKey, "mbmf_gl_clearing_account", mbmfDefaultSettings.clearingAccount),
    paymentBankAccount: getMbmfValue(settingsByKey, "mbmf_payment_bank_account", mbmfDefaultSettings.paymentBankAccount),
    applicableReligion: getMbmfValue(settingsByKey, "mbmf_applicable_religion", mbmfDefaultSettings.applicableReligion)
  }));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setForm({
      enabled: getMbmfValue(settingsByKey, "mbmf_enabled", mbmfDefaultSettings.enabled),
      effectiveFrom: getMbmfValue(settingsByKey, "mbmf_effective_from", mbmfDefaultSettings.effectiveFrom),
      rateType: getMbmfValue(settingsByKey, "mbmf_rate_type", mbmfDefaultSettings.rateType),
      employeeRate: getMbmfValue(settingsByKey, "mbmf_employee_rate_percent", mbmfDefaultSettings.employeeRate),
      employerRate: getMbmfValue(settingsByKey, "mbmf_employer_rate_percent", mbmfDefaultSettings.employerRate),
      monthlyWageCeiling: getMbmfValue(settingsByKey, "mbmf_monthly_wage_ceiling", mbmfDefaultSettings.monthlyWageCeiling),
      employerExpenseAccount: getMbmfValue(settingsByKey, "mbmf_gl_employer_expense_account", mbmfDefaultSettings.employerExpenseAccount),
      employeePayableAccount: getMbmfValue(settingsByKey, "mbmf_gl_employee_payable_account", mbmfDefaultSettings.employeePayableAccount),
      clearingAccount: getMbmfValue(settingsByKey, "mbmf_gl_clearing_account", mbmfDefaultSettings.clearingAccount),
      paymentBankAccount: getMbmfValue(settingsByKey, "mbmf_payment_bank_account", mbmfDefaultSettings.paymentBankAccount),
      applicableReligion: getMbmfValue(settingsByKey, "mbmf_applicable_religion", mbmfDefaultSettings.applicableReligion)
    });
  }, [settingsByKey]);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };
  const employeeRate = Number(form.employeeRate || 0);
  const employerRate = Number(form.employerRate || 0);
  const ceiling = Number(form.monthlyWageCeiling || 0);
  const examples = [4000, 7000, 9500].map((grossSalary) => {
    const salaryConsidered = Math.min(grossSalary, ceiling || grossSalary);
    const employeeAmount = salaryConsidered * (employeeRate / 100);
    const employerAmount = salaryConsidered * (employerRate / 100);

    return {
      grossSalary,
      salaryConsidered,
      employeeAmount,
      employerAmount,
      total: employeeAmount + employerAmount
    };
  });

  const saveMbmfSettings = async () => {
    setIsSaving(true);

    try {
      await Promise.all([
        onSave("mbmf_enabled", {
          settingValue: form.enabled,
          description: "Enable MBMF contribution for eligible Muslim employees."
        }),
        onSave("mbmf_applicable_religion", {
          settingValue: form.applicableReligion,
          description: "Religion value that makes an employee eligible for MBMF."
        }),
        onSave("mbmf_effective_from", {
          settingValue: form.effectiveFrom,
          description: "MBMF contribution effective date."
        }),
        onSave("mbmf_rate_type", {
          settingValue: form.rateType,
          description: "MBMF contribution rate type."
        }),
        onSave("mbmf_employee_rate_percent", {
          settingValue: form.employeeRate,
          description: "MBMF employee contribution percentage."
        }),
        onSave("mbmf_employer_rate_percent", {
          settingValue: form.employerRate,
          description: "MBMF employer contribution percentage."
        }),
        onSave("mbmf_monthly_wage_ceiling", {
          settingValue: form.monthlyWageCeiling,
          description: "MBMF monthly wage ceiling."
        }),
        onSave("mbmf_gl_employer_expense_account", {
          settingValue: form.employerExpenseAccount,
          description: "MBMF employer expense GL account."
        }),
        onSave("mbmf_gl_employee_payable_account", {
          settingValue: form.employeePayableAccount,
          description: "MBMF employee payable GL account."
        }),
        onSave("mbmf_gl_clearing_account", {
          settingValue: form.clearingAccount,
          description: "MBMF payable clearing GL account."
        }),
        onSave("mbmf_payment_bank_account", {
          settingValue: form.paymentBankAccount,
          description: "MBMF payment bank account."
        })
      ]);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-white">MBMF Contribution Rules</h3>
        <p className="mt-1 text-sm text-[#d8c6e8]">
          Configure MBMF so payroll applies it only to employees whose staff religion is Muslim.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <section className="neon-glass neon-border rounded-2xl p-5">
              <h4 className="font-semibold text-white">1. Enable MBMF</h4>
              <div className="mt-5 flex items-center justify-between gap-3">
                <span className="text-sm text-[#d8c6e8]">Enable MBMF Contribution</span>
                <select
                  value={form.enabled}
                  onChange={(event) => updateForm("enabled", event.target.value)}
                  className="rounded-lg border border-white/10 bg-[#1d0b2f] px-3 py-2 text-sm text-white outline-none"
                >
                  <option value="Enabled">Enabled</option>
                  <option value="Disabled">Disabled</option>
                </select>
              </div>
              <p className="mt-4 rounded-xl border border-[#7DD3FC]/25 bg-[#7DD3FC]/10 p-3 text-sm text-[#BAE6FD]">
                MBMF is calculated only for employees with religion set to {form.applicableReligion}.
              </p>
            </section>

            <section className="neon-glass neon-border rounded-2xl p-5">
              <h4 className="font-semibold text-white">2. Contribution Rates</h4>
              <div className="mt-4 space-y-3">
                <SettingInput value={form.effectiveFrom} onChange={(value) => updateForm("effectiveFrom", value)} placeholder="Effective date" />
                <select
                  value={form.rateType}
                  onChange={(event) => updateForm("rateType", event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#1d0b2f] px-3 py-2 text-sm text-white outline-none"
                >
                  <option value="Percentage of Gross Salary">Percentage of Gross Salary</option>
                  <option value="Fixed Amount">Fixed Amount</option>
                </select>
                <SettingInput value={form.employeeRate} onChange={(value) => updateForm("employeeRate", value)} placeholder="Employee rate %" />
                <SettingInput value={form.employerRate} onChange={(value) => updateForm("employerRate", value)} placeholder="Employer rate %" />
                <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-[#d8c6e8]">
                  Total Rate: <span className="font-semibold text-white">{(employeeRate + employerRate).toFixed(2)}%</span>
                </div>
              </div>
            </section>

            <section className="neon-glass neon-border rounded-2xl p-5">
              <h4 className="font-semibold text-white">3. Wage Ceiling</h4>
              <div className="mt-4 space-y-3">
                <select
                  value="Monthly Wage Ceiling"
                  className="w-full rounded-lg border border-white/10 bg-[#1d0b2f] px-3 py-2 text-sm text-white outline-none"
                  disabled
                >
                  <option value="Monthly Wage Ceiling">Monthly Wage Ceiling</option>
                </select>
                <SettingInput value={form.monthlyWageCeiling} onChange={(value) => updateForm("monthlyWageCeiling", value)} placeholder="Monthly wage ceiling" />
              </div>
              <p className="mt-4 rounded-xl border border-[#FFB86B]/25 bg-[#FFB86B]/10 p-3 text-sm text-[#FFE2B8]">
                If gross salary is above the ceiling, MBMF uses the ceiling amount only.
              </p>
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
            <section className="neon-glass neon-border rounded-2xl p-5">
              <h4 className="font-semibold text-white">4. Map GL Accounts</h4>
              <div className="mt-4 grid gap-3">
                <SettingInput value={form.employerExpenseAccount} onChange={(value) => updateForm("employerExpenseAccount", value)} />
                <SettingInput value={form.employeePayableAccount} onChange={(value) => updateForm("employeePayableAccount", value)} />
                <SettingInput value={form.clearingAccount} onChange={(value) => updateForm("clearingAccount", value)} />
                <SettingInput value={form.paymentBankAccount} onChange={(value) => updateForm("paymentBankAccount", value)} />
              </div>
            </section>

            <section className="neon-glass neon-border rounded-2xl p-5">
              <h4 className="font-semibold text-white">5. Save & Apply</h4>
              <div className="mt-4 rounded-xl border border-[#7CFFB2]/25 bg-[#7CFFB2]/10 p-4 text-sm text-[#D8FFE6]">
                Saved MBMF settings are applied to eligible Muslim employees only.
              </div>
              <button
                type="button"
                className="mt-5 rounded-xl border border-[#C77DFF]/25 bg-[#C77DFF]/10 px-4 py-2 text-sm font-semibold text-white hover:bg-[#C77DFF]/18 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={saveMbmfSettings}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save MBMF Settings"}
              </button>
            </section>
          </div>

          <section className="neon-glass neon-border overflow-hidden rounded-2xl">
            <div className="border-b border-white/10 px-5 py-4">
              <h4 className="font-semibold text-white">Contribution Calculation Example</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[52rem] w-full border-separate border-spacing-0 text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-[#C77DFF]/80">
                  <tr>
                    <th className="border-b border-white/10 px-4 py-3">Gross Salary</th>
                    <th className="border-b border-white/10 px-4 py-3">Wage Ceiling</th>
                    <th className="border-b border-white/10 px-4 py-3">Salary Considered</th>
                    <th className="border-b border-white/10 px-4 py-3">Employee</th>
                    <th className="border-b border-white/10 px-4 py-3">Employer</th>
                    <th className="border-b border-white/10 px-4 py-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {examples.map((example) => (
                    <tr key={example.grossSalary}>
                      <td className="border-b border-white/10 px-4 py-3 text-white">{formatMoney(example.grossSalary)}</td>
                      <td className="border-b border-white/10 px-4 py-3 text-[#d8c6e8]">{formatMoney(ceiling)}</td>
                      <td className="border-b border-white/10 px-4 py-3 text-[#d8c6e8]">{formatMoney(example.salaryConsidered)}</td>
                      <td className="border-b border-white/10 px-4 py-3 text-[#d8c6e8]">{formatMoney(example.employeeAmount)}</td>
                      <td className="border-b border-white/10 px-4 py-3 text-[#d8c6e8]">{formatMoney(example.employerAmount)}</td>
                      <td className="border-b border-white/10 px-4 py-3 font-semibold text-white">{formatMoney(example.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="neon-glass neon-border rounded-2xl p-5">
            <h4 className="font-semibold text-white">Applicability</h4>
            <div className="mt-4 rounded-xl border border-[#C77DFF]/25 bg-[#C77DFF]/10 p-4">
              <p className="text-sm font-semibold text-white">Applicable To</p>
              <p className="mt-1 text-sm text-[#d8c6e8]">All employees where staff.religion = {form.applicableReligion}</p>
            </div>
            <div className="mt-4 grid gap-3 text-sm">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <span className="text-[#d8c6e8]">Total Staff</span>
                <span className="font-semibold text-white">{eligibility?.totalStaff ?? 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <span className="text-[#d8c6e8]">Eligible {form.applicableReligion} Staff</span>
                <span className="font-semibold text-[#7CFFB2]">{eligibility?.eligibleMuslimEmployees ?? 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <span className="text-[#d8c6e8]">Not Applied</span>
                <span className="font-semibold text-white">{eligibility?.nonEligibleEmployees ?? 0}</span>
              </div>
            </div>
            {!eligibility?.hasReligionColumn ? (
              <p className="mt-4 rounded-xl border border-[#FFB86B]/25 bg-[#FFB86B]/10 p-3 text-sm text-[#FFE2B8]">
                Add a religion column to the staff table so the system can identify Muslim employees.
              </p>
            ) : null}
            {eligibility?.sampleEmployees?.length ? (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-sm font-semibold text-white">Eligible Staff Preview</p>
                <div className="mt-3 space-y-2 text-sm text-[#d8c6e8]">
                  {eligibility.sampleEmployees.map((employee) => (
                    <div key={employee.employee_id} className="flex items-center justify-between gap-3">
                      <span>{employee.name || employee.employee_code || `Employee ${employee.employee_id}`}</span>
                      <span className="font-semibold text-white">{employee.religion}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="neon-glass neon-border rounded-2xl p-5">
            <h4 className="font-semibold text-white">Process Flow</h4>
            <ol className="mt-4 space-y-3 text-sm text-[#d8c6e8]">
              <li>1. Payroll reads staff religion from the employee database.</li>
              <li>2. MBMF is calculated only when religion is Muslim.</li>
              <li>3. Non-Muslim employees are skipped automatically.</li>
              <li>4. Employee and employer amounts are shown separately.</li>
              <li>5. GL accounts are used for journal posting and payment.</li>
            </ol>
          </section>
        </aside>
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

function SelfHelpGroupRulesPanel({ onSave, settingsByKey, users = [] }) {
  const communityFundConfigs = selfHelpGroupConfigs.filter((scheme) => scheme.key !== "mbmf");
  const [rows, setRows] = useState(() =>
    communityFundConfigs.map((scheme) => ({
      ...scheme,
      enabled: getSchemeValue(settingsByKey, scheme.key, "enabled", "Enabled"),
      effectiveFrom: getSchemeValue(settingsByKey, scheme.key, "effective_from", "2026-01-01"),
      eligibilityValue: getSchemeValue(settingsByKey, scheme.key, `applicable_${scheme.eligibilityField}`, scheme.eligibilityValue),
      contributionRule: getSchemeValue(settingsByKey, scheme.key, "contribution_rule", "Apply current CPF Board contribution table"),
      payableAccount: getSchemeValue(settingsByKey, scheme.key, "payable_account", `21${scheme.key.length}0 - ${scheme.label} Payable`)
    }))
  );
  const [savingKey, setSavingKey] = useState("");

  useEffect(() => {
    setRows(
      communityFundConfigs.map((scheme) => ({
        ...scheme,
        enabled: getSchemeValue(settingsByKey, scheme.key, "enabled", "Enabled"),
        effectiveFrom: getSchemeValue(settingsByKey, scheme.key, "effective_from", "2026-01-01"),
        eligibilityValue: getSchemeValue(settingsByKey, scheme.key, `applicable_${scheme.eligibilityField}`, scheme.eligibilityValue),
        contributionRule: getSchemeValue(settingsByKey, scheme.key, "contribution_rule", "Apply current CPF Board contribution table"),
        payableAccount: getSchemeValue(settingsByKey, scheme.key, "payable_account", `21${scheme.key.length}0 - ${scheme.label} Payable`)
      }))
    );
  }, [settingsByKey]);

  const updateRow = (schemeKey, field, value) => {
    setRows((currentRows) =>
      currentRows.map((row) => (row.key === schemeKey ? { ...row, [field]: value } : row))
    );
  };

  const saveRow = async (row) => {
    setSavingKey(row.key);

    try {
      await Promise.all([
        onSave(`${row.key}_enabled`, {
          settingValue: row.enabled,
          description: `${row.label} contribution enabled setting.`
        }),
        onSave(`${row.key}_effective_from`, {
          settingValue: row.effectiveFrom,
          description: `${row.label} contribution effective date.`
        }),
        onSave(`${row.key}_applicable_${row.eligibilityField}`, {
          settingValue: row.eligibilityValue,
          description: `${row.label} eligibility ${row.eligibilityField}.`
        }),
        onSave(`${row.key}_contribution_rule`, {
          settingValue: row.contributionRule,
          description: `${row.label} contribution rule.`
        }),
        onSave(`${row.key}_payable_account`, {
          settingValue: row.payableAccount,
          description: `${row.label} payable account mapping.`
        })
      ]);
    } finally {
      setSavingKey("");
    }
  };

  return (
    <section className="neon-glass neon-border overflow-hidden rounded-2xl">
      <div className="border-b border-white/10 px-5 py-4">
        <h3 className="text-lg font-semibold text-white">Community Fund Contribution Rules</h3>
        <p className="mt-1 text-sm text-[#d8c6e8]">Configure CDAC, SINDA and ECF using staff race fields. MBMF remains in its dedicated religion-based panel.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[82rem] w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-[#C77DFF]/80">
            <tr>
              <th className="border-b border-white/10 px-4 py-3">Scheme</th>
              <th className="border-b border-white/10 px-4 py-3">Enabled</th>
              <th className="border-b border-white/10 px-4 py-3">Effective From</th>
              <th className="border-b border-white/10 px-4 py-3">Eligibility</th>
              <th className="border-b border-white/10 px-4 py-3">Eligible Staff</th>
              <th className="border-b border-white/10 px-4 py-3">Rule</th>
              <th className="border-b border-white/10 px-4 py-3">Payable Account</th>
              <th className="border-b border-white/10 px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const eligibleUsers = getEligibleUsers(users, row.eligibilityField, row.eligibilityValue);

              return (
                <tr key={row.key}>
                  <td className="border-b border-white/10 px-4 py-4">
                    <p className="font-semibold text-white">{row.label}</p>
                    <p className="mt-1 text-xs text-[#d8c6e8]">{row.description}</p>
                  </td>
                  <td className="border-b border-white/10 px-4 py-4">
                    <select
                      value={row.enabled}
                      onChange={(event) => updateRow(row.key, "enabled", event.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-[#1d0b2f] px-3 py-2 text-sm text-white outline-none"
                    >
                      <option value="Enabled">Enabled</option>
                      <option value="Disabled">Disabled</option>
                    </select>
                  </td>
                  <td className="border-b border-white/10 px-4 py-4">
                    <input
                      type="date"
                      value={row.effectiveFrom}
                      onChange={(event) => updateRow(row.key, "effectiveFrom", event.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none"
                    />
                  </td>
                  <td className="border-b border-white/10 px-4 py-4">
                    <SettingInput
                      value={row.eligibilityValue}
                      onChange={(value) => updateRow(row.key, "eligibilityValue", value)}
                      placeholder={row.eligibilityField}
                    />
                    <p className="mt-1 text-xs text-[#d8c6e8]/80">staff.{row.eligibilityField}</p>
                  </td>
                  <td className="border-b border-white/10 px-4 py-4 text-[#d8c6e8]">
                    <span className="font-semibold text-white">{eligibleUsers.length}</span> staff
                  </td>
                  <td className="border-b border-white/10 px-4 py-4">
                    <SettingInput value={row.contributionRule} onChange={(value) => updateRow(row.key, "contributionRule", value)} />
                  </td>
                  <td className="border-b border-white/10 px-4 py-4">
                    <SettingInput value={row.payableAccount} onChange={(value) => updateRow(row.key, "payableAccount", value)} />
                  </td>
                  <td className="border-b border-white/10 px-4 py-4">
                    <button
                      type="button"
                      className="rounded-xl border border-[#C77DFF]/25 bg-[#C77DFF]/10 px-4 py-2 text-sm font-semibold text-white hover:bg-[#C77DFF]/18 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => saveRow(row)}
                      disabled={savingKey === row.key}
                    >
                      {savingKey === row.key ? "Saving..." : "Save"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SettingsView({ mbmfEligibility, onUpdateSetting, settings = [], users = [] }) {
  const settingsByKey = useMemo(
    () => buildSettingsByKey(settings),
    [settings]
  );

  return (
    <PageShell
      heading="Payroll Settings"
      updatedAt={getLatestTimestamp(settings)}
      actions={
        <>
          <ActionButton icon={Settings} onClick={() => document.getElementById("payroll-settings-start")?.scrollIntoView({ behavior: "smooth" })}>Payroll Configurations</ActionButton>
          <ActionButton icon={PlayCircle} variant="secondary" onClick={() => window.alert(`${settings.length} payroll setting(s) loaded for rule testing.`)}>Test Rules</ActionButton>
        </>
      }
    >
      <div id="payroll-settings-start" className="space-y-8">
        <SettingsSection
          definitions={cpfCalculationSettings}
          settingsByKey={settingsByKey}
          title="CPF Calculation Basis"
          subtitle="Choose the basis for CPF calculation and how CPF rates are viewed."
          onSave={onUpdateSetting}
        />
        <CpfRateTable settingsByKey={settingsByKey} onSave={onUpdateSetting} />
        <WageComponentTable settingsByKey={settingsByKey} onSave={onUpdateSetting} />
        <DeductionComponentTable settingsByKey={settingsByKey} onSave={onUpdateSetting} />
        <MbmfContributionPanel
          eligibility={mbmfEligibility}
          settingsByKey={settingsByKey}
          onSave={onUpdateSetting}
        />
        <SelfHelpGroupRulesPanel settingsByKey={settingsByKey} users={users} onSave={onUpdateSetting} />
        <EmployerContributionTable settingsByKey={settingsByKey} onSave={onUpdateSetting} />
        <SettingsSection
          definitions={statutorySchemeSettings}
          settingsByKey={settingsByKey}
          title="Singapore Statutory Scheme Settings"
          subtitle="Configure SDL, Foreign Worker Levy, IRAS AIS and IR21 tracking settings for payroll administration."
          onSave={onUpdateSetting}
        />
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

function ComplianceRulesView({ mbmfEligibility, onUpdateSetting, settings = [], users = [] }) {
  const settingsByKey = useMemo(
    () => buildSettingsByKey(settings),
    [settings]
  );
  const complianceUpdates = [
    {
      label: "CPF rates",
      value: "SC/SPR 3rd year onward, effective 01 Jan 2026",
      updatedAt: getLatestTimestamp(settings.filter((setting) => setting.setting_key.startsWith("cpf_rate_")))
    },
    {
      label: "CPF wage ceiling",
      value: "Ordinary Wage ceiling SGD 8,000 from 01 Jan 2026",
      updatedAt: getLatestTimestamp(settings.filter((setting) => setting.setting_key.includes("cpf_wage_ceiling")))
    },
    {
      label: "SDL",
      value: "0.25% of remuneration, min SGD 2 and max SGD 11.25 monthly",
      updatedAt: getLatestTimestamp(settings.filter((setting) => setting.setting_key.includes("sdl") || setting.setting_key.includes("employer_contribution_sdl")))
    },
    {
      label: "Foreign worker levy",
      value: "Managed by MOM sector, quota and worker type",
      updatedAt: getLatestTimestamp(settings.filter((setting) => setting.setting_key.includes("foreign_worker_levy")))
    },
    {
      label: "Self-help groups",
      value: "MBMF, CDAC, SINDA and ECF by staff religion/race",
      updatedAt: getLatestTimestamp(settings.filter((setting) => ["mbmf_", "cdac_", "sinda_", "ecf_"].some((prefix) => setting.setting_key.startsWith(prefix))))
    },
    {
      label: "IRAS reporting",
      value: "AIS employment income and IR21 tax clearance tracking",
      updatedAt: getLatestTimestamp(settings.filter((setting) => setting.setting_key.startsWith("iras_") || setting.setting_key.startsWith("ir21_")))
    }
  ];

  return (
    <PageShell
      heading="Compliance Rules"
      updatedAt={getLatestTimestamp(settings)}
      actions={
        <>
          <ActionButton icon={ShieldCheck}>Singapore Rules</ActionButton>
          <ActionButton icon={PlayCircle} variant="secondary">Test Rules</ActionButton>
        </>
      }
    >
      <div className="space-y-8">
        <section className="neon-glass neon-border rounded-2xl p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Singapore Payroll Compliance Baseline</h3>
              <p className="mt-1 text-sm text-[#d8c6e8]">Editable defaults for CPF, SDL, levy treatment and contribution rules.</p>
            </div>
            <p className="text-sm font-semibold text-[#C77DFF]">Verified for 2026 payroll periods</p>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {complianceUpdates.map((item) => (
              <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-sm font-semibold text-white">{item.label}</p>
                <p className="mt-2 text-xs leading-5 text-[#d8c6e8]">{item.value}</p>
                <p className="mt-3 text-xs font-semibold text-[#C77DFF]">
                  {item.updatedAt ? `Edited ${formatDateTime(item.updatedAt)}` : "Using default rule"}
                </p>
              </div>
            ))}
          </div>
        </section>

        <CpfRateTable settingsByKey={settingsByKey} onSave={onUpdateSetting} />
        <CpfCeilingPanel settingsByKey={settingsByKey} onSave={onUpdateSetting} />
        <CustomComplianceRulesPanel settings={settings} onSave={onUpdateSetting} />
        <SelfHelpGroupRulesPanel settingsByKey={settingsByKey} users={users} onSave={onUpdateSetting} />
        <WageComponentTable settingsByKey={settingsByKey} onSave={onUpdateSetting} />
        <DeductionComponentTable settingsByKey={settingsByKey} onSave={onUpdateSetting} />
        <EmployerContributionTable settingsByKey={settingsByKey} onSave={onUpdateSetting} />
        <SettingsSection
          definitions={statutorySchemeSettings}
          settingsByKey={settingsByKey}
          title="Singapore Statutory Scheme Settings"
          subtitle="Configure SDL, Foreign Worker Levy, IRAS AIS and IR21 tracking settings for payroll administration."
          onSave={onUpdateSetting}
        />
        <MbmfContributionPanel
          eligibility={mbmfEligibility}
          settingsByKey={settingsByKey}
          onSave={onUpdateSetting}
        />
      </div>
    </PageShell>
  );
}

function CustomComplianceRulesPanel({ onSave, settings = [] }) {
  const emptyForm = {
    category: "Payroll Compliance",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    ruleText: "",
    source: "",
    status: "Active",
    title: ""
  };
  const customRules = useMemo(
    () =>
      settings
        .filter((setting) => setting.setting_key.startsWith("custom_compliance_rule_"))
        .map(parseCustomComplianceRule)
        .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)),
    [settings]
  );
  const [form, setForm] = useState(emptyForm);
  const [editingKey, setEditingKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const startEdit = (rule) => {
    setEditingKey(rule.settingKey);
    setForm({
      category: rule.category,
      effectiveFrom: rule.effectiveFrom || new Date().toISOString().slice(0, 10),
      ruleText: rule.ruleText,
      source: rule.source,
      status: rule.status,
      title: rule.title
    });
  };

  const resetForm = () => {
    setEditingKey("");
    setForm(emptyForm);
  };

  const saveRule = async () => {
    const title = form.title.trim();
    const ruleText = form.ruleText.trim();

    if (!title || !ruleText) return;

    setIsSaving(true);

    try {
      const settingKey = editingKey || `custom_compliance_rule_${slugify(title)}_${Date.now()}`;

      await onSave(settingKey, {
        settingValue: JSON.stringify({
          category: form.category.trim() || "Payroll Compliance",
          effectiveFrom: form.effectiveFrom,
          ruleText,
          source: form.source.trim(),
          status: form.status,
          title
        }),
        description: `Custom compliance rule: ${title}`
      });
      resetForm();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="neon-glass neon-border rounded-2xl p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Custom Compliance Rules</h3>
          <p className="mt-1 text-sm text-[#d8c6e8]">Add company-specific payroll compliance rules and keep their effective dates visible.</p>
        </div>
        <p className="text-sm font-semibold text-[#C77DFF]">{customRules.length} custom rule(s)</p>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h4 className="font-semibold text-white">{editingKey ? "Edit Rule" : "Add Rule"}</h4>
          <div className="mt-4 grid gap-3">
            <SettingInput value={form.title} onChange={(value) => updateForm("title", value)} placeholder="Rule title" />
            <div className="grid gap-3 sm:grid-cols-2">
              <SettingInput value={form.category} onChange={(value) => updateForm("category", value)} placeholder="Category" />
              <input
                type="date"
                value={form.effectiveFrom}
                onChange={(event) => updateForm("effectiveFrom", event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none focus:border-[#C77DFF]/50"
              />
            </div>
            <textarea
              value={form.ruleText}
              onChange={(event) => updateForm("ruleText", event.target.value)}
              placeholder="Rule details"
              rows={5}
              className="w-full resize-y rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none placeholder:text-[#d8c6e8]/50 focus:border-[#C77DFF]/50"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <SettingInput value={form.source} onChange={(value) => updateForm("source", value)} placeholder="Source or reference" />
              <select
                value={form.status}
                onChange={(event) => updateForm("status", event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#1d0b2f] px-3 py-2 text-sm text-white outline-none"
              >
                <option value="Active">Active</option>
                <option value="Draft">Draft</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-xl border border-[#C77DFF]/25 bg-[#C77DFF]/10 px-4 py-2 text-sm font-semibold text-white hover:bg-[#C77DFF]/18 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={saveRule}
                disabled={isSaving || !form.title.trim() || !form.ruleText.trim()}
              >
                {isSaving ? "Saving..." : editingKey ? "Save Rule" : "Add Rule"}
              </button>
              {editingKey ? (
                <button
                  type="button"
                  className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                  onClick={resetForm}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {customRules.length ? (
            customRules.map((rule) => (
              <article key={rule.settingKey} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-white">{rule.title}</h4>
                      <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-[#d8c6e8]">
                        {rule.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#d8c6e8]">{rule.ruleText}</p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                    onClick={() => startEdit(rule)}
                  >
                    Edit
                  </button>
                </div>
                <div className="mt-4 grid gap-3 text-xs text-[#d8c6e8] sm:grid-cols-3">
                  <span>Category: <span className="font-semibold text-white">{rule.category}</span></span>
                  <span>Effective: <span className="font-semibold text-white">{rule.effectiveFrom ? formatDate(rule.effectiveFrom) : "Not set"}</span></span>
                  <span>Updated: <span className="font-semibold text-white">{formatDateTime(rule.updatedAt)}</span></span>
                </div>
                {rule.source ? <p className="mt-3 text-xs text-[#C77DFF]">Source: {rule.source}</p> : null}
              </article>
            ))
          ) : (
            <EmptyState message="No custom compliance rules added yet." />
          )}
        </div>
      </div>
    </section>
  );
}

function PayrollMonitorView({ payrollRuns = [] }) {
  const today = new Date().toISOString().slice(0, 10);
  const [periodMode, setPeriodMode] = useState("all");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [selectedRun, setSelectedRun] = useState(null);
  const filteredRuns = useMemo(() => {
    if (periodMode === "all") return payrollRuns;

    const startDate = new Date(`${fromDate}T00:00:00`);
    const endDate = new Date(`${toDate || fromDate}T23:59:59`);

    return payrollRuns.filter((run) => {
      const runDate = getPayrollRunDate(run);

      if (!runDate) return false;

      return runDate >= startDate && runDate <= endDate;
    });
  }, [fromDate, payrollRuns, periodMode, toDate]);

  return (
    <PageShell
      heading="Payroll Monitor"
      updatedAt={getLatestTimestamp(payrollRuns)}
      actions={
        <>
          <ActionButton icon={Eye} onClick={() => setSelectedRun(payrollRuns[0] || null)} disabled={!payrollRuns.length}>View Finance Status</ActionButton>
          <ActionButton icon={FileBarChart} variant="secondary" onClick={() => setSelectedRun(payrollRuns[0] || null)} disabled={!payrollRuns.length}>Export Status</ActionButton>
        </>
      }
    >
      <div className="mb-5 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:grid-cols-[1fr_1fr_1fr_auto]">
        <label className="space-y-2">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#C77DFF]/80">
            <Filter size={14} />
            Date Filter
          </span>
          <select
            value={periodMode}
            onChange={(event) => setPeriodMode(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#1d0b2f] px-3 py-2.5 text-sm font-semibold text-white outline-none"
          >
            <option value="all">All payroll periods</option>
            <option value="range">From date to date</option>
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#C77DFF]/80">From Date</span>
          <input
            type="date"
            value={fromDate}
            disabled={periodMode === "all"}
            onChange={(event) => setFromDate(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#1d0b2f] px-3 py-2.5 text-sm font-semibold text-white outline-none disabled:opacity-50"
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#C77DFF]/80">To Date</span>
          <input
            type="date"
            value={toDate}
            min={fromDate}
            disabled={periodMode === "all"}
            onChange={(event) => setToDate(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#1d0b2f] px-3 py-2.5 text-sm font-semibold text-white outline-none disabled:opacity-50"
          />
        </label>
        <div className="flex items-end">
          <div className="rounded-xl border border-[#C77DFF]/25 bg-[#C77DFF]/10 px-4 py-2.5 text-sm font-semibold text-white">
            {filteredRuns.length} of {payrollRuns.length} run(s)
          </div>
        </div>
      </div>

      <div className="neon-glass neon-border overflow-hidden rounded-2xl">
        <div className="grid grid-cols-5 gap-4 border-b border-white/10 px-6 py-4 text-xs font-semibold uppercase tracking-wide text-[#C77DFF]/80">
          <span>Pay Period</span>
          <span>Updated</span>
          <span>Employees</span>
          <span>Status</span>
          <span>Action</span>
        </div>
        {filteredRuns.length ? (
          filteredRuns.map((run) => (
            <div key={run.payroll_run_id} className="grid grid-cols-5 gap-4 border-b border-white/10 px-6 py-4 text-sm last:border-b-0">
              <div>
                <p className="font-semibold text-white">{formatPayrollPeriod(run)}</p>
                <p className="mt-1 text-[#d8c6e8]">Created by {run.created_by_name || "Unknown"}</p>
              </div>
              <p className="text-[#d8c6e8]">{formatDateTime(run.updated_at || run.created_at)}</p>
              <p className="text-[#d8c6e8]">{run.employee_count}</p>
              <p className="text-white">{run.status}</p>
              <button type="button" className="justify-self-start rounded-xl bg-white/[0.06] px-4 py-2 font-semibold text-white hover:bg-white/10" onClick={() => setSelectedRun(run)}>
                Review
              </button>
            </div>
          ))
        ) : (
          <div className="px-6 py-4">
            <EmptyState message="No payroll runs match the selected date filter." />
          </div>
        )}
      </div>
      {selectedRun ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-[#d8c6e8]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-white">{formatPayrollPeriod(selectedRun)}</p>
              <p className="mt-1">Finance status: {selectedRun.status}</p>
            </div>
            <button
              type="button"
              className="w-fit rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 font-semibold text-white hover:bg-white/10"
              onClick={() => setSelectedRun(null)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}

function AuditLogsView({ auditLogs = [] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [entityFilter, setEntityFilter] = useState("All");

  const entityTypes = useMemo(
    () => ["All", ...new Set(auditLogs.map((log) => log.entity_type).filter(Boolean))],
    [auditLogs]
  );

  const filteredLogs = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return auditLogs.filter((log) => {
      const matchesEntity = entityFilter === "All" || log.entity_type === entityFilter;
      const matchesSearch =
        !normalizedSearch ||
        [log.action, log.entity_type, log.entity_id, log.user_name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));

      return matchesEntity && matchesSearch;
    });
  }, [auditLogs, entityFilter, searchTerm]);

  const exportLogs = () => {
    const periodLabel = auditLogs[0]?.created_at
      ? `Latest activity: ${formatDateTime(auditLogs[0].created_at)}`
      : "No activity yet";
    const rows = filteredLogs.map((log) => ({
      columns: [
        formatDateTime(log.created_at),
        log.action || "System activity",
        `${log.entity_type || "system"} #${log.entity_id || "-"}`,
        log.user_name || "System"
      ]
    }));
    const url = URL.createObjectURL(createPdfBlob("Audit Logs", rows, periodLabel));
    const link = document.createElement("a");
    link.href = url;
    link.download = "audit-logs.pdf";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageShell
      heading="Audit Logs"
      updatedAt={getLatestTimestamp(auditLogs)}
      actions={<ActionButton icon={FileText} variant="secondary" onClick={exportLogs}>Export Logs</ActionButton>}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <div className="neon-glass rounded-2xl p-5">
          <p className="text-sm text-[#d8c6e8]">Total Events</p>
          <p className="mt-3 text-3xl font-semibold text-white">{auditLogs.length}</p>
        </div>
        <div className="neon-glass rounded-2xl p-5">
          <p className="text-sm text-[#d8c6e8]">Visible Events</p>
          <p className="mt-3 text-3xl font-semibold text-[#C77DFF]">{filteredLogs.length}</p>
        </div>
        <div className="neon-glass rounded-2xl p-5">
          <p className="text-sm text-[#d8c6e8]">Entity Types</p>
          <p className="mt-3 text-3xl font-semibold text-[#7CFFB2]">{Math.max(entityTypes.length - 1, 0)}</p>
        </div>
      </div>

      <div className="mt-6 neon-glass neon-border rounded-2xl p-6">
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
                <tr key={log.log_id || `${log.entity_type}-${log.entity_id}-${log.created_at}`} className="text-[#d8c6e8] transition hover:bg-white/[0.04]">
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
    </PageShell>
  );
}

function getAuthHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function PayslipsApprovalView() {
  const session = getStoredSession();
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [actionInProgress, setActionInProgress] = useState(null);
  const [rejectingPayslipId, setRejectingPayslipId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchPayslips = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(`${API_BASE_URL}/api/hr/payslips`, {
        headers: getAuthHeaders(session?.token)
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to load payslips");
      }

      const data = await response.json();
      setPayslips(Array.isArray(data) ? data.filter((payslip) => payslip.status === "admin_pending") : []);
    } catch (err) {
      setError(err.message || "Failed to load payslips");
      setPayslips([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (payslipId) => {
    try {
      setActionInProgress(payslipId);
      setError("");

      const response = await fetch(`${API_BASE_URL}/api/payroll/payslips/${payslipId}/admin-approve`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(session?.token),
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to approve payslip");
      }

      setSuccessMessage("Payslip approved and sent to staff");
      await fetchPayslips();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(err.message || "Failed to approve payslip");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async (payslipId) => {
    if (!rejectReason.trim()) {
      setError("Please enter a rejection reason");
      return;
    }

    try {
      setActionInProgress(payslipId);
      setError("");

      const response = await fetch(`${API_BASE_URL}/api/payroll/payslips/${payslipId}/admin-reject`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(session?.token),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ reason: rejectReason })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to reject payslip");
      }

      setSuccessMessage("Payslip rejected successfully");
      setRejectingPayslipId(null);
      setRejectReason("");
      await fetchPayslips();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(err.message || "Failed to reject payslip");
    } finally {
      setActionInProgress(null);
    }
  };

  useEffect(() => {
    fetchPayslips();
  }, [session?.token]);

  return (
    <div className="space-y-5">
      <div className="neon-glass neon-border rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Payslips Pending Final Approval</h3>
            <p className="mt-1 text-sm text-[#d8c6e8]">
              Review payslips approved by Finance. Final approval will send them to staff.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchPayslips}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="neon-glass neon-border rounded-2xl border-red-500/40 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div className="neon-glass neon-border rounded-2xl border-emerald-500/40 p-4 text-sm text-emerald-200">
          {successMessage}
        </div>
      ) : null}

      <div className="neon-glass neon-border overflow-hidden rounded-2xl">
        {loading ? (
          <div className="flex items-center gap-3 p-6 text-[#d8c6e8]">
            <Loader2 className="animate-spin" size={18} />
            Loading payslips...
          </div>
        ) : payslips.length === 0 ? (
          <div className="p-6 text-center">
            <div className="mb-3 inline-block rounded-full bg-emerald-500/10 p-3">
              <CheckCircle2 className="text-emerald-300" size={24} />
            </div>
            <p className="text-sm text-[#d8c6e8]">No payslips pending final approval</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/5 text-[#d8c6e8]">
                <tr>
                  <th className="px-4 py-3 font-medium">Payslip ID</th>
                  <th className="px-4 py-3 font-medium">Staff Name</th>
                  <th className="px-4 py-3 font-medium">Period</th>
                  <th className="px-4 py-3 font-medium">Gross</th>
                  <th className="px-4 py-3 font-medium">Net Pay</th>
                  <th className="px-4 py-3 font-medium">Finance Approved By</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payslips.map((payslip) => (
                  <tr key={payslip.payslip_id} className="border-b border-white/5 text-white">
                    <td className="px-4 py-3 text-xs text-[#d8c6e8]">{payslip.payslip_id}</td>
                    <td className="px-4 py-3">{payslip.staff_name}</td>
                    <td className="px-4 py-3 text-[#d8c6e8]">
                      {payslip.period_month} {payslip.period_year}
                    </td>
                    <td className="px-4 py-3 text-[#d8c6e8]">
                      ${Number(payslip.gross_salary || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-emerald-300">
                      ${Number(payslip.net_pay || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#d8c6e8]">
                      {payslip.finance_approved_by || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleApprove(payslip.payslip_id)}
                          disabled={actionInProgress === payslip.payslip_id}
                          className="rounded-lg bg-cyan-500/20 px-3 py-1 text-xs text-cyan-300 hover:bg-cyan-500/30 disabled:opacity-50"
                        >
                          {actionInProgress === payslip.payslip_id ? <Loader2 className="inline animate-spin" size={12} /> : "Send"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectingPayslipId(payslip.payslip_id)}
                          disabled={actionInProgress === payslip.payslip_id}
                          className="rounded-lg bg-red-500/20 px-3 py-1 text-xs text-red-300 hover:bg-red-500/30 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rejectingPayslipId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="neon-glass neon-border m-4 w-full max-w-md rounded-2xl p-6">
            <div className="mb-4 flex items-center gap-3">
              <AlertCircle className="text-red-300" size={20} />
              <h3 className="text-lg font-semibold text-white">Reject Payslip</h3>
            </div>
            <p className="mb-4 text-sm text-[#d8c6e8]">
              Please provide a reason for rejecting this payslip.
            </p>
            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30"
              rows={4}
            />
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => handleReject(rejectingPayslipId)}
                disabled={actionInProgress === rejectingPayslipId}
                className="flex-1 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/30 disabled:opacity-50"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => {
                  setRejectingPayslipId(null);
                  setRejectReason("");
                }}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
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

  if (report === "Payslip Layout Report") {
    return (data.layouts || []).map((layout) => ({
      columns: [
        layout.layout_name,
        layout.file_type,
        Number(layout.is_default) === 1 ? "Default layout" : layout.status || "Imported"
      ]
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
      updatedAt={getOverallUpdatedAt(data)}
      actions={
        <>
          <ActionButton icon={FileBarChart} onClick={() => setSelectedReport(reportCards[0])}>Generate Report</ActionButton>
          <ActionButton icon={FileText} variant="secondary" onClick={() => setSelectedReport("Payslip Layout Report")}>Payslip Layout Report</ActionButton>
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
  onCreateUser,
  currentUserId,
  data,
  onImportLayout,
  onNavigate,
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
        availableStaff={data?.availableStaff}
        currentUserId={currentUserId}
        roleSummary={data?.roleSummary}
        users={data?.users}
        onCreateUser={onCreateUser}
        onResetPassword={onResetPassword}
        onUpdateRole={onUpdateRole}
        onUpdateStatus={onUpdateStatus}
      />
    );
  }
  if (pathname.endsWith("/settings")) {
    return (
      <SettingsView
        mbmfEligibility={data?.mbmfEligibility}
        settings={data?.settings}
        users={data?.users}
        onUpdateSetting={onUpdateSetting}
      />
    );
  }
  if (pathname.endsWith("/compliance-rules")) {
    return (
      <ComplianceRulesView
        mbmfEligibility={data?.mbmfEligibility}
        settings={data?.settings}
        users={data?.users}
        onUpdateSetting={onUpdateSetting}
      />
    );
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
      onNavigate={onNavigate}
      onSetDefaultLayout={onSetDefaultLayout}
    />
  );
}

export default function AdminPayrollPage() {
  const session = getStoredSession();
  const location = useLocation();
  const navigate = useNavigate();
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
      availableStaff: result.availableStaff,
      roleSummary: result.roleSummary,
      stats: {
        ...(current?.stats || {}),
        ...result.stats
      },
      users: result.users
    }));
  };

  const handleCreateUser = async (payload) => {
    try {
      const result = await createUser(payload);
      applyUserManagementResult(result);
      return result;
    } catch (error) {
      setErrorMessage(error.message);
      throw error;
    }
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
        mbmfEligibility: result.mbmfEligibility || current?.mbmfEligibility,
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

  // Show payslips approval view for the specific route
  if (location.pathname === "/dashboard/payroll/admin/payslips-approval") {
    return (
      <DashboardLayout
        pageTitle={pageTitle}
        user={session?.user}
        sidebarSections={payrollSidebarSections}
        sidebarTitle="Automated Invoicing & Payroll System"
        searchPlaceholder="Search payroll, staff, approvals..."
      >
        <section>
          <PayslipsApprovalView />
        </section>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      pageTitle={pageTitle}
      user={session?.user}
      sidebarSections={payrollSidebarSections}
      sidebarTitle="Automated Invoicing & Payroll System"
      searchPlaceholder="Search payroll, staff, approvals..."
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
          onCreateUser={handleCreateUser}
          onImportLayout={handleImportLayout}
          onNavigate={navigate}
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
