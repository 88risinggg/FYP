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
  getAdminPayrollReports,
  resetUserPassword,
  setDefaultPayslipLayout,
  updatePayrollSetting,
  updateUserRole,
  updateUserStatus,
} from "../../services/adminPayrollService.js";

import { getStoredSession } from "../../services/sessionService.js";
import PayrollAuditLogPage from "./PayrollAuditLogPage.jsx";

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
import { createPayrollReportPdf } from "../../utils/payrollReportPdf.js";

const pageTitle = "Automated Payroll System – Admin Payroll Dashboard";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

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
  rateType: "CPF Board Wage Band",
  employeeRate: "0",
  employerRate: "0",
  monthlyWageCeiling: "999999.00",
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
      ? "inline-flex items-center justify-center gap-2 rounded-xl border border-[#f0d2ca] bg-white/800 px-4 py-2.5 text-sm font-semibold text-[#251E1F] transition hover:bg-[#FDD9CD]/45"
      : "primary-button inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold";

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
    <div className="rounded-xl border border-dashed border-[#f0d2ca] bg-white/800 p-6 text-sm text-[#7b6660]">
      {message}
    </div>
  );
}

function PageShell({ heading, children, actions, updatedAt }) {
  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#F38978]/80">
            Admin Payroll Workflow
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-[#251E1F]">{heading}</h2>
          <p className="mt-2 flex items-center gap-2 text-sm text-[#7b6660]">
            <CalendarDays size={15} className="text-[#F38978]" />
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
    return "border-[#2f8758]/25 bg-[#2f8758]/10 text-[#2f8758]";
  }

  if (["not configured", "needs data"].includes(normalizedStatus)) {
    return "border-[#D97706]/25 bg-[#D97706]/10 text-[#9A6412]";
  }

  if (normalizedStatus === "view only") {
    return "border-[#7DD3FC]/25 bg-[#7DD3FC]/10 text-[#BAE6FD]";
  }

  return "border-[#f0d2ca] bg-white/800 text-[#7b6660]";
}

function WorkflowCard({ data, onNavigate, step }) {
  const Icon = step.icon;
  const meta = getStepMeta(step, data);
  const status = meta.status || step.status;

  return (
    <article className="app-panel rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F38978]/12 text-[#F38978] ring-1 ring-[#F38978]/25">
          <Icon size={24} />
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(status)}`}>
          {status}
        </span>
      </div>
      <h3 className="mt-5 text-base font-semibold text-[#251E1F]">{step.title}</h3>
      <div className="mt-3 grid gap-2 rounded-xl border border-[#f0d2ca] bg-white/800 p-3 text-xs text-[#7b6660]">
        <div className="flex items-center justify-between gap-3">
          <span>Owner</span>
          <span className="font-semibold text-[#251E1F]">{step.owner}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Records</span>
          <span className="font-semibold text-[#251E1F]">{meta.count}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Last Updated</span>
          <span className="font-semibold text-[#251E1F]">{meta.lastUpdated ? formatDateTime(meta.lastUpdated) : "Not updated"}</span>
        </div>
      </div>
      <ul className="mt-3 space-y-2 text-sm text-[#7b6660]">
        {step.details.map((detail) => (
          <li key={detail} className="flex gap-2">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#F38978]" />
            <span>{detail}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="mt-5 w-full rounded-xl border border-[#F38978]/25 bg-[#F38978]/10 px-4 py-2.5 text-sm font-semibold text-[#251E1F] transition hover:bg-[#F38978]/18"
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
    { label: "Active Users", value: stats.activeUsers ?? 0, tone: "text-[#F38978]", updatedAt: getLatestTimestamp(data?.users) },
    { label: "Payroll Rules", value: stats.payrollRules ?? 0, tone: "text-[#251E1F]", updatedAt: getLatestTimestamp(data?.settings) },
    { label: "Payslip Layouts", value: stats.payslipLayouts ?? 0, tone: "text-[#2f8758]", updatedAt: getLatestTimestamp(data?.layouts) },
    { label: "Admin Logs", value: stats.adminLogs ?? 0, tone: "text-[#D97706]", updatedAt: getLatestTimestamp(data?.auditLogs) }
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
          <div key={stat.label} className="app-panel rounded-2xl p-5">
            <p className="text-sm text-[#7b6660]">{stat.label}</p>
            <p className={`mt-3 text-3xl font-semibold ${stat.tone}`}>{stat.value}</p>
            <p className="mt-3 flex items-center gap-2 text-xs text-[#7b6660]/80">
              <CalendarDays size={14} className="text-[#F38978]" />
              {stat.updatedAt ? `Updated ${formatDateTime(stat.updatedAt)}` : "No update date"}
            </p>
          </div>
        ))}
      </div>

      <section className="mt-6 app-panel rounded-2xl p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#251E1F]">Overall Update Timeline</h3>
            <p className="mt-1 text-sm text-[#7b6660]">Last changed date for each admin payroll segment.</p>
          </div>
          <p className="text-sm font-semibold text-[#F38978]">
            Latest: {formatDateTime(getLatestTimestamp(dashboardUpdates.map((item) => ({ updated_at: item.updatedAt }))))}
          </p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-5">
          {dashboardUpdates.map((item) => (
            <div key={item.label} className="rounded-xl border border-[#f0d2ca] bg-white/800 p-4">
              <p className="text-sm font-semibold text-[#251E1F]">{item.label}</p>
              <p className="mt-1 text-xs text-[#7b6660]">{item.records}</p>
              <p className="mt-3 text-xs font-semibold text-[#F38978]">
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

        <aside className="app-panel rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F38978]/20 text-[#F38978]">
              <Palette size={21} />
            </div>
            <div>
              <h3 className="font-semibold text-[#251E1F]">Payslip Layout Control</h3>
              <p className="text-sm text-[#7b6660]">Admin manages the templates Finance uses when generating payslips.</p>
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
          <div className="mt-6 rounded-xl border border-[#F38978]/25 bg-[#F38978]/10 p-4 text-sm text-[#6F4F47]">
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
  const [isBulkAccessOpen, setIsBulkAccessOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
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
  const manageableFilteredUsers = filteredUsers.filter((user) => Number(user.user_id) !== Number(currentUserId));
  const selectedUsers = users.filter((user) => selectedUserIds.includes(user.user_id));
  const toggleUserSelection = (userId) => {
    setSelectedUserIds((currentIds) =>
      currentIds.includes(userId)
        ? currentIds.filter((id) => id !== userId)
        : [...currentIds, userId]
    );
  };
  const toggleFilteredSelection = () => {
    const manageableIds = manageableFilteredUsers.map((user) => user.user_id);
    const allSelected = manageableIds.length > 0 && manageableIds.every((id) => selectedUserIds.includes(id));

    setSelectedUserIds((currentIds) =>
      allSelected
        ? currentIds.filter((id) => !manageableIds.includes(id))
        : Array.from(new Set([...currentIds, ...manageableIds]))
    );
  };
  return (
    <PageShell
      heading="Users & Roles"
      updatedAt={getLatestTimestamp(users)}
      actions={
        <>
          <ActionButton icon={Users} onClick={() => setIsAddUserOpen(true)}>Add User</ActionButton>
          <ActionButton icon={ShieldCheck} variant="secondary" onClick={() => setIsBulkAccessOpen(true)} disabled={!users.length}>Bulk Access Settings</ActionButton>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-4">
          {roleSummary.map((role) => (
            <div key={role.role_id} className="app-panel rounded-2xl p-5">
              <p className="text-sm text-[#7b6660]">{role.role_name}</p>
              <p className="mt-3 text-3xl font-semibold text-[#251E1F]">{role.user_count}</p>
              <p className="mt-2 text-sm text-[#7b6660]/80">{role.description || "Role access"}</p>
            </div>
          ))}
        </div>

        <div className="app-panel rounded-2xl p-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[#251E1F]">User & Staff Directory</h3>
              <p className="mt-1 text-sm text-[#7b6660]">
                {filteredUsers.length} of {users.length} user(s) shown
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:w-[46rem]">
              <label className="flex items-center gap-2 rounded-xl border border-[#f0d2ca] bg-white/800 px-3 py-2.5">
                <Search size={16} className="text-[#F38978]" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search users..."
                  className="min-w-0 flex-1 bg-transparent text-sm text-[#251E1F] outline-none placeholder:text-[#7b6660]/60"
                />
              </label>

              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="rounded-xl border border-[#f0d2ca] bg-[#ffffff] px-3 py-2.5 text-sm font-semibold text-[#251E1F] outline-none"
              >
                {roles.map((role) => (
                  <option key={role} value={role}>{role} roles</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-xl border border-[#f0d2ca] bg-[#ffffff] px-3 py-2.5 text-sm font-semibold text-[#251E1F] outline-none"
              >
                {["All", "Active", "Inactive"].map((status) => (
                  <option key={status} value={status}>{status} status</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-[#F38978]/80">
                <tr>
                  <th className="border-b border-[#f0d2ca] px-4 py-3 font-semibold">
                    <input
                      type="checkbox"
                      checked={manageableFilteredUsers.length > 0 && manageableFilteredUsers.every((user) => selectedUserIds.includes(user.user_id))}
                      onChange={toggleFilteredSelection}
                      aria-label="Select visible users"
                    />
                  </th>
                  <th className="border-b border-[#f0d2ca] px-4 py-3 font-semibold">User</th>
                  <th className="border-b border-[#f0d2ca] px-4 py-3 font-semibold">Role</th>
                  <th className="border-b border-[#f0d2ca] px-4 py-3 font-semibold">Employee Code</th>
                  <th className="border-b border-[#f0d2ca] px-4 py-3 font-semibold">Department</th>
                  <th className="border-b border-[#f0d2ca] px-4 py-3 font-semibold">Base Salary</th>
                  <th className="border-b border-[#f0d2ca] px-4 py-3 font-semibold">Status</th>
                  <th className="border-b border-[#f0d2ca] px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const isActive = Number(user.status) === 1;
                  const isCurrentUser = Number(user.user_id) === Number(currentUserId);

                  return (
                    <tr
                      key={user.user_id}
                      className="cursor-pointer text-[#7b6660] transition hover:bg-[#FDD9CD]/45"
                      onClick={() => setManagedUser(user)}
                    >
                      <td className="border-b border-[#f0d2ca] px-4 py-4" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(user.user_id)}
                          onChange={() => toggleUserSelection(user.user_id)}
                          disabled={isCurrentUser}
                          aria-label={`Select ${user.name}`}
                        />
                      </td>
                      <td className="border-b border-[#f0d2ca] px-4 py-4">
                        <p className="font-semibold text-[#251E1F]">{user.name}</p>
                        <p className="mt-1 text-xs text-[#7b6660]/75">{user.email}</p>
                      </td>
                      <td className="border-b border-[#f0d2ca] px-4 py-4">{user.role_name}</td>
                      <td className="border-b border-[#f0d2ca] px-4 py-4">{user.employee_code || "Not linked"}</td>
                      <td className="border-b border-[#f0d2ca] px-4 py-4">{user.department_name || "Not linked"}</td>
                      <td className="border-b border-[#f0d2ca] px-4 py-4">{formatMoney(user.base_salary)}</td>
                      <td className="border-b border-[#f0d2ca] px-4 py-4">
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${isActive ? "border-[#2f8758]/25 bg-[#2f8758]/10 text-[#2f8758]" : "border-[#D97706]/25 bg-[#D97706]/10 text-[#9A6412]"}`}>
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="border-b border-[#f0d2ca] px-4 py-4">
                        <button
                          type="button"
                          className="rounded-xl border border-[#f0d2ca] bg-white/800 px-3 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/45"
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
      {isBulkAccessOpen ? (
        <BulkAccessModal
          currentUserId={currentUserId}
          filteredUsers={manageableFilteredUsers}
          onClose={() => setIsBulkAccessOpen(false)}
          onSelectionChange={setSelectedUserIds}
          onUpdateRole={onUpdateRole}
          onUpdateStatus={onUpdateStatus}
          roles={roleSummary}
          selectedUserIds={selectedUserIds}
          selectedUsers={selectedUsers}
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

function BulkAccessModal({
  filteredUsers,
  onClose,
  onSelectionChange,
  onUpdateRole,
  onUpdateStatus,
  roles,
  selectedUserIds,
  selectedUsers
}) {
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedCount = selectedUsers.length;
  const activeCount = selectedUsers.filter((user) => Number(user.status) === 1).length;
  const inactiveCount = selectedUsers.filter((user) => Number(user.status) !== 1).length;
  const filteredIds = filteredUsers.map((user) => user.user_id);

  const applyBulkRole = async () => {
    if (!selectedRoleId || !selectedCount) return;

    setIsSubmitting(true);

    try {
      for (const user of selectedUsers) {
        if (Number(user.role_id) !== Number(selectedRoleId)) {
          await onUpdateRole(user.user_id, Number(selectedRoleId));
        }
      }
      onSelectionChange([]);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyBulkStatus = async (status) => {
    if (!selectedCount) return;

    setIsSubmitting(true);

    try {
      for (const user of selectedUsers) {
        if (Number(user.status) !== status) {
          await onUpdateStatus(user.user_id, status);
        }
      }
      onSelectionChange([]);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#fff8f5]/80 px-4 backdrop-blur-sm">
      <section className="app-panel max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl p-6">
        <div className="flex flex-col gap-4 border-b border-[#f0d2ca] pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F38978]/15 text-[#F38978] ring-1 ring-[#F38978]/25">
              <ShieldCheck size={26} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-[#251E1F]">Bulk Access Settings</h3>
              <p className="mt-1 text-sm text-[#7b6660]">Update role or account status for selected users.</p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-xl border border-[#f0d2ca] bg-white/800 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/45"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-[#f0d2ca] bg-white/800 p-4">
            <p className="text-sm text-[#7b6660]">Selected Users</p>
            <p className="mt-2 text-3xl font-semibold text-[#251E1F]">{selectedCount}</p>
            <p className="mt-2 text-xs text-[#7b6660]/75">{activeCount} active / {inactiveCount} inactive</p>
          </div>

          <div className="rounded-xl border border-[#f0d2ca] bg-white/800 p-4 md:col-span-2">
            <p className="text-sm font-semibold text-[#251E1F]">Selection</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-xl border border-[#f0d2ca] bg-white/800 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/45"
                onClick={() => onSelectionChange(filteredIds)}
                disabled={!filteredIds.length}
              >
                Select Visible Users
              </button>
              <button
                type="button"
                className="rounded-xl border border-[#f0d2ca] bg-white/800 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/45"
                onClick={() => onSelectionChange([])}
                disabled={!selectedCount}
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-[#f0d2ca] bg-white/800 p-4">
            <p className="text-sm font-semibold text-[#251E1F]">Apply Role</p>
            <p className="mt-2 text-sm text-[#7b6660]">Assign one role to every selected user.</p>
            <div className="mt-4 flex gap-2">
              <select
                value={selectedRoleId}
                onChange={(event) => setSelectedRoleId(event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-[#f0d2ca] bg-[#ffffff] px-3 py-2 text-sm font-semibold text-[#251E1F] outline-none"
              >
                <option value="">Choose role</option>
                {roles.map((role) => (
                  <option key={role.role_id} value={role.role_id}>{role.role_name}</option>
                ))}
              </select>
              <button
                type="button"
                className="rounded-xl border border-[#F38978]/25 bg-[#F38978]/10 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#F38978]/18 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={applyBulkRole}
                disabled={isSubmitting || !selectedRoleId || !selectedCount}
              >
                Apply
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-[#f0d2ca] bg-white/800 p-4">
            <p className="text-sm font-semibold text-[#251E1F]">Account Status</p>
            <p className="mt-2 text-sm text-[#7b6660]">Activate or deactivate all selected user accounts.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-xl border border-[#2f8758]/25 bg-[#2f8758]/10 px-4 py-2 text-sm font-semibold text-[#065F46] hover:bg-[#2f8758]/18 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => applyBulkStatus(1)}
                disabled={isSubmitting || !selectedCount}
              >
                Activate
              </button>
              <button
                type="button"
                className="rounded-xl border border-[#D97706]/25 bg-[#D97706]/10 px-4 py-2 text-sm font-semibold text-[#9A6412] hover:bg-[#D97706]/18 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => applyBulkStatus(0)}
                disabled={isSubmitting || !selectedCount}
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-[#f0d2ca] bg-white/800 p-4">
          <p className="text-sm font-semibold text-[#251E1F]">Selected Users Preview</p>
          <div className="mt-3 max-h-56 overflow-y-auto">
            {selectedUsers.length ? (
              <div className="divide-y divide-[#ead3cc]">
                {selectedUsers.map((user) => (
                  <div key={user.user_id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-[#251E1F]">{user.name}</p>
                      <p className="text-xs text-[#7b6660]/75">{user.email}</p>
                    </div>
                    <p className="text-[#7b6660]">{user.role_name} / {Number(user.status) === 1 ? "Active" : "Inactive"}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="Select users from the directory table before applying bulk changes." />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function ProfileField({ label, value }) {
  return (
    <div className="rounded-xl border border-[#f0d2ca] bg-white/800 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#F38978]/75">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[#251E1F]">{value || "Not linked"}</p>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#fff8f5]/80 px-4 backdrop-blur-sm">
      <section className="app-panel max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl p-6">
        <div className="flex flex-col gap-4 border-b border-[#f0d2ca] pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#F38978]/80">Admin User Access</p>
            <h3 className="mt-2 text-xl font-semibold text-[#251E1F]">Add New User</h3>
            <p className="mt-1 text-sm text-[#7b6660]">Create a login account and link it to an existing staff profile when needed.</p>
          </div>
          <button
            type="button"
            className="rounded-xl border border-[#f0d2ca] bg-white/800 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/45"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-[#251E1F]">Link Staff Profile</span>
            <select
              value={formData.staffEmployeeId}
              onChange={(event) => handleStaffChange(event.target.value)}
              className="rounded-xl border border-[#f0d2ca] bg-[#ffffff] px-3 py-2.5 text-sm font-semibold text-[#251E1F] outline-none"
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
              <span className="text-sm font-semibold text-[#251E1F]">Name</span>
              <input
                type="text"
                value={formData.name}
                onChange={(event) => updateField("name", event.target.value)}
                className="rounded-xl border border-[#f0d2ca] bg-[#ffffff] px-3 py-2.5 text-sm font-semibold text-[#251E1F] outline-none"
                required
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-[#251E1F]">Email</span>
              <input
                type="email"
                value={formData.email}
                onChange={(event) => updateField("email", event.target.value)}
                className="rounded-xl border border-[#f0d2ca] bg-[#ffffff] px-3 py-2.5 text-sm font-semibold text-[#251E1F] outline-none"
                required
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-[#251E1F]">Role</span>
              <select
                value={formData.roleId}
                onChange={(event) => updateField("roleId", event.target.value)}
                className="rounded-xl border border-[#f0d2ca] bg-[#ffffff] px-3 py-2.5 text-sm font-semibold text-[#251E1F] outline-none"
                required
              >
                {roles.map((role) => (
                  <option key={role.role_id} value={role.role_id}>{role.role_name}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-[#251E1F]">Status</span>
              <select
                value={formData.status}
                onChange={(event) => updateField("status", event.target.value)}
                className="rounded-xl border border-[#f0d2ca] bg-[#ffffff] px-3 py-2.5 text-sm font-semibold text-[#251E1F] outline-none"
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </label>
          </div>

          {errorMessage ? (
            <div className="rounded-xl border border-[#D97706]/25 bg-[#D97706]/10 p-4 text-sm text-[#9A6412]">
              {errorMessage}
            </div>
          ) : null}

          {temporaryPassword ? (
            <div className="rounded-xl border border-[#2f8758]/25 bg-[#2f8758]/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#2f8758]">Temporary Password</p>
              <p className="mt-2 break-all font-mono text-sm text-[#251E1F]">{temporaryPassword}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3 border-t border-[#f0d2ca] pt-5">
            <button
              type="button"
              className="rounded-xl border border-[#f0d2ca] bg-white/800 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/45"
              onClick={onClose}
            >
              Done
            </button>
            <button
              type="submit"
              className="primary-button px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#fff8f5]/80 px-4 backdrop-blur-sm">
      <section className="app-panel max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl p-6">
        <div className="flex flex-col gap-4 border-b border-[#f0d2ca] pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F38978]/15 text-[#F38978] ring-1 ring-[#F38978]/25">
              <UserCog size={26} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-[#251E1F]">Manage {user.name}</h3>
              <p className="mt-1 text-sm text-[#7b6660]">{user.email}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-[#f0d2ca] bg-white/800 px-3 py-1 text-xs font-semibold text-[#7b6660]">
                  {user.role_name}
                </span>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${isActive ? "border-[#2f8758]/25 bg-[#2f8758]/10 text-[#2f8758]" : "border-[#D97706]/25 bg-[#D97706]/10 text-[#9A6412]"}`}>
                  {isActive ? "Active account" : "Inactive account"}
                </span>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${hasStaffProfile ? "border-[#F38978]/25 bg-[#F38978]/10 text-[#6F4F47]" : "border-[#D97706]/25 bg-[#D97706]/10 text-[#9A6412]"}`}>
                  {hasStaffProfile ? "Staff profile linked" : "No staff profile"}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="rounded-xl border border-[#f0d2ca] bg-white/800 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/45"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-6 space-y-6">
          <div>
            <h4 className="font-semibold text-[#251E1F]">Admin Actions</h4>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-[#f0d2ca] bg-white/800 p-4">
                <p className="text-sm font-semibold text-[#251E1F]">Reset Password</p>
                <p className="mt-2 text-sm text-[#7b6660]">
                  Generates a temporary password for the user. Share it through a secure channel.
                </p>
                <button
                  type="button"
                  className="mt-4 rounded-xl border border-[#F38978]/25 bg-[#F38978]/10 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#F38978]/18 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleResetPassword}
                  disabled={isSubmitting}
                >
                  Reset Password
                </button>
                {temporaryPassword ? (
                  <div className="mt-4 rounded-xl border border-[#2f8758]/25 bg-[#2f8758]/10 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#2f8758]">Temporary Password</p>
                    <p className="mt-2 break-all font-mono text-sm text-[#251E1F]">{temporaryPassword}</p>
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-[#f0d2ca] bg-white/800 p-4">
                <p className="text-sm font-semibold text-[#251E1F]">Account Status</p>
                <p className="mt-2 text-sm text-[#7b6660]">
                  Disable access for inactive users. Self-deactivation is blocked.
                </p>
                <button
                  type="button"
                  className="mt-4 rounded-xl border border-[#f0d2ca] bg-white/800 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/45 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleStatusUpdate}
                  disabled={isSubmitting || isCurrentUser}
                >
                  {isActive ? "Deactivate Account" : "Activate Account"}
                </button>
              </div>

              <div className="rounded-xl border border-[#f0d2ca] bg-white/800 p-4">
                <p className="text-sm font-semibold text-[#251E1F]">Role Access</p>
                <p className="mt-2 text-sm text-[#7b6660]">
                  Change module access by assigning a different role. Self-role changes are blocked.
                </p>
                <div className="mt-4 flex gap-2">
                  <select
                    value={selectedRoleId}
                    onChange={(event) => setSelectedRoleId(event.target.value)}
                    className="min-w-0 flex-1 rounded-xl border border-[#f0d2ca] bg-[#ffffff] px-3 py-2 text-sm font-semibold text-[#251E1F] outline-none"
                    disabled={isCurrentUser}
                  >
                    {roles.map((role) => (
                      <option key={role.role_id} value={role.role_id}>{role.role_name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="rounded-xl border border-[#F38978]/25 bg-[#F38978]/10 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#F38978]/18 disabled:cursor-not-allowed disabled:opacity-60"
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
            <h4 className="font-semibold text-[#251E1F]">Account Details</h4>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ProfileField label="User ID" value={user.user_id} />
              <ProfileField label="Role" value={user.role_name} />
              <ProfileField label="Created" value={formatDate(user.created_at)} />
              <ProfileField label="Updated" value={formatDate(user.updated_at)} />
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-[#251E1F]">Employee Details</h4>
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
        <div className="app-panel rounded-2xl p-6 lg:col-span-2">
          {layouts.length ? (
            <div className="grid gap-4 md:grid-cols-3">
              {layouts.map((layout) => (
              <article key={layout.layout_id} className="rounded-xl border border-[#f0d2ca] bg-white/800 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F38978]/12 text-[#F38978] ring-1 ring-[#F38978]/25">
                  <FileText size={22} />
                </div>
                <h3 className="mt-4 font-semibold text-[#251E1F]">{layout.layout_name}</h3>
                <p className="mt-2 text-sm text-[#7b6660]">{layout.file_type} template</p>
                <div className="mt-4 flex items-center justify-between gap-3 text-xs">
                  <span className="rounded-full border border-[#f0d2ca] bg-white/800 px-3 py-1 font-semibold text-[#7b6660]">
                    {Number(layout.is_default) === 1 ? "Default" : layout.status}
                  </span>
                  <span className="text-[#7b6660]/80">{formatDate(layout.updated_at)}</span>
                </div>
                <div className="mt-5 flex gap-2">
                  <button type="button" className="rounded-xl border border-[#f0d2ca] bg-white/800 px-3 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/45" onClick={() => window.open(layout.file_path, "_blank")}>
                    Preview
                  </button>
                  <button type="button" className="rounded-xl border border-[#F38978]/25 bg-[#F38978]/10 px-3 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#F38978]/18" onClick={() => onSetDefaultLayout(layout.layout_id)}>
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

        <aside className="app-panel rounded-2xl p-6">
          <Palette size={26} className="text-[#F38978]" />
          <h3 className="mt-4 font-semibold text-[#251E1F]">Layout Import Requirements</h3>
          <ul className="mt-4 space-y-3 text-sm text-[#7b6660]">
            <li className="flex gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#F38978]" />
              <span>Template name and version</span>
            </li>
            <li className="flex gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#F38978]" />
              <span>PDF or HTML layout file</span>
            </li>
            <li className="flex gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#F38978]" />
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
    <div className="app-panel rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F38978]/12 text-[#F38978] ring-1 ring-[#F38978]/25">
          <Settings size={20} />
        </div>
        <div>
          <h4 className="font-semibold text-[#251E1F]">{definition.label}</h4>
          <p className="mt-1 text-sm text-[#7b6660]">{definition.description}</p>
        </div>
      </div>

      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={definition.placeholder}
        className="mt-5 w-full rounded-xl border border-[#f0d2ca] bg-white/800 px-3 py-2.5 text-sm text-[#251E1F] outline-none placeholder:text-[#7b6660]/50 focus:border-[#F38978]/50"
      />

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-[#7b6660]/70">
          {setting?.updated_at ? `Updated ${formatDate(setting.updated_at)}` : "Not configured"}
        </p>
        <button
          type="button"
          className="rounded-xl border border-[#F38978]/25 bg-[#F38978]/10 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#F38978]/18 disabled:cursor-not-allowed disabled:opacity-60"
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
        <h3 className="text-lg font-semibold text-[#251E1F]">{title}</h3>
        <p className="mt-1 text-sm text-[#7b6660]">{subtitle}</p>
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
      className="w-full rounded-lg border border-[#f0d2ca] bg-white/800 px-3 py-2 text-sm text-[#251E1F] outline-none placeholder:text-[#7b6660]/50 focus:border-[#F38978]/50"
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
    <section className="app-panel overflow-hidden rounded-2xl">
      <div className="border-b border-[#f0d2ca] px-5 py-4">
        <h3 className="text-lg font-semibold text-[#251E1F]">CPF Age-Tier Rates</h3>
        <p className="mt-1 text-sm text-[#7b6660]">Set employee and employer CPF percentage rates by age tier.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[44rem] w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-[#F38978]/80">
            <tr>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Age Group</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Employee CPF %</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Employer CPF %</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.slug}>
                <td className="border-b border-[#f0d2ca] px-4 py-4 font-semibold text-[#251E1F]">{row.ageGroup}</td>
                <td className="border-b border-[#f0d2ca] px-4 py-4">
                  <SettingInput value={row.employeeRate} onChange={(value) => updateRow(row.slug, "employeeRate", value)} />
                </td>
                <td className="border-b border-[#f0d2ca] px-4 py-4">
                  <SettingInput value={row.employerRate} onChange={(value) => updateRow(row.slug, "employerRate", value)} />
                </td>
                <td className="border-b border-[#f0d2ca] px-4 py-4">
                  <button
                    type="button"
                    className="rounded-xl border border-[#F38978]/25 bg-[#F38978]/10 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#F38978]/18 disabled:cursor-not-allowed disabled:opacity-60"
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
    <section className="app-panel overflow-hidden rounded-2xl">
      <div className="border-b border-[#f0d2ca] px-5 py-4">
        <h3 className="text-lg font-semibold text-[#251E1F]">Earning Component Classification</h3>
        <p className="mt-1 text-sm text-[#7b6660]">Define which earning components feed CPF and how each wage type is classified.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[58rem] w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-[#F38978]/80">
            <tr>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Component Name</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">CPF Applicable</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Wage Type</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Remarks</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.slug}>
                <td className="border-b border-[#f0d2ca] px-4 py-4 font-semibold text-[#251E1F]">{row.component}</td>
                <td className="border-b border-[#f0d2ca] px-4 py-4">
                  <select
                    value={row.includeCpf}
                    onChange={(event) => updateRow(row.slug, "includeCpf", event.target.value)}
                    className="w-full rounded-lg border border-[#f0d2ca] bg-[#ffffff] px-3 py-2 text-sm text-[#251E1F] outline-none"
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </td>
                <td className="border-b border-[#f0d2ca] px-4 py-4">
                  <select
                    value={row.wageType}
                    onChange={(event) => updateRow(row.slug, "wageType", event.target.value)}
                    className="w-full rounded-lg border border-[#f0d2ca] bg-[#ffffff] px-3 py-2 text-sm text-[#251E1F] outline-none"
                  >
                    <option value="Ordinary Wage">Ordinary Wage</option>
                    <option value="Additional Wage">Additional Wage</option>
                    <option value="Non-CPF">Non-CPF</option>
                  </select>
                </td>
                <td className="border-b border-[#f0d2ca] px-4 py-4">
                  <SettingInput value={row.remarks} onChange={(value) => updateRow(row.slug, "remarks", value)} />
                </td>
                <td className="border-b border-[#f0d2ca] px-4 py-4">
                  <button
                    type="button"
                    className="rounded-xl border border-[#F38978]/25 bg-[#F38978]/10 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#F38978]/18 disabled:cursor-not-allowed disabled:opacity-60"
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
    <section className="app-panel overflow-hidden rounded-2xl">
      <div className="border-b border-[#f0d2ca] px-5 py-4">
        <h3 className="text-lg font-semibold text-[#251E1F]">Deduction Component Classification</h3>
        <p className="mt-1 text-sm text-[#7b6660]">Define deduction treatment for net pay and CPF wage base validation.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[66rem] w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-[#F38978]/80">
            <tr>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Deduction Name</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Type</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Affects Net Pay</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Affects CPF Wage Base</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Remarks</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.slug}>
                <td className="border-b border-[#f0d2ca] px-4 py-4 font-semibold text-[#251E1F]">{row.deduction}</td>
                <td className="border-b border-[#f0d2ca] px-4 py-4">
                  <select
                    value={row.type}
                    onChange={(event) => updateRow(row.slug, "type", event.target.value)}
                    className="w-full rounded-lg border border-[#f0d2ca] bg-[#ffffff] px-3 py-2 text-sm text-[#251E1F] outline-none"
                  >
                    <option value="Statutory">Statutory</option>
                    <option value="Loan">Loan</option>
                    <option value="Recovery">Recovery</option>
                    <option value="Other">Other</option>
                  </select>
                </td>
                <td className="border-b border-[#f0d2ca] px-4 py-4">
                  <select
                    value={row.affectsNetPay}
                    onChange={(event) => updateRow(row.slug, "affectsNetPay", event.target.value)}
                    className="w-full rounded-lg border border-[#f0d2ca] bg-[#ffffff] px-3 py-2 text-sm text-[#251E1F] outline-none"
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </td>
                <td className="border-b border-[#f0d2ca] px-4 py-4">
                  <select
                    value={row.affectsCpfWageBase}
                    onChange={(event) => updateRow(row.slug, "affectsCpfWageBase", event.target.value)}
                    className="w-full rounded-lg border border-[#f0d2ca] bg-[#ffffff] px-3 py-2 text-sm text-[#251E1F] outline-none"
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </td>
                <td className="border-b border-[#f0d2ca] px-4 py-4">
                  <SettingInput value={row.remarks} onChange={(value) => updateRow(row.slug, "remarks", value)} />
                </td>
                <td className="border-b border-[#f0d2ca] px-4 py-4">
                  <button
                    type="button"
                    className="rounded-xl border border-[#F38978]/25 bg-[#F38978]/10 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#F38978]/18 disabled:cursor-not-allowed disabled:opacity-60"
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
    <section className="app-panel overflow-hidden rounded-2xl">
      <div className="border-b border-[#f0d2ca] px-5 py-4">
        <h3 className="text-lg font-semibold text-[#251E1F]">Employer Contribution Items</h3>
        <p className="mt-1 text-sm text-[#7b6660]">Define employer-side statutory and payroll cost items for Finance review.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[52rem] w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-[#F38978]/80">
            <tr>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Item</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Type</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Basis</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Remarks</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.slug}>
                <td className="border-b border-[#f0d2ca] px-4 py-4 font-semibold text-[#251E1F]">{row.item}</td>
                <td className="border-b border-[#f0d2ca] px-4 py-4">
                  <select
                    value={row.type}
                    onChange={(event) => updateRow(row.slug, "type", event.target.value)}
                    className="w-full rounded-lg border border-[#f0d2ca] bg-[#ffffff] px-3 py-2 text-sm text-[#251E1F] outline-none"
                  >
                    <option value="Statutory">Statutory</option>
                    <option value="Other">Other</option>
                  </select>
                </td>
                <td className="border-b border-[#f0d2ca] px-4 py-4">
                  <SettingInput value={row.basis} onChange={(value) => updateRow(row.slug, "basis", value)} />
                </td>
                <td className="border-b border-[#f0d2ca] px-4 py-4">
                  <SettingInput value={row.remarks} onChange={(value) => updateRow(row.slug, "remarks", value)} />
                </td>
                <td className="border-b border-[#f0d2ca] px-4 py-4">
                  <button
                    type="button"
                    className="rounded-xl border border-[#F38978]/25 bg-[#F38978]/10 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#F38978]/18 disabled:cursor-not-allowed disabled:opacity-60"
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
        <h3 className="text-lg font-semibold text-[#251E1F]">MBMF Contribution Rules</h3>
        <p className="mt-1 text-sm text-[#7b6660]">
          Configure MBMF so payroll applies it only to employees whose staff religion is Muslim.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <section className="app-panel rounded-2xl p-5">
              <h4 className="font-semibold text-[#251E1F]">1. Enable MBMF</h4>
              <div className="mt-5 flex items-center justify-between gap-3">
                <span className="text-sm text-[#7b6660]">Enable MBMF Contribution</span>
                <select
                  value={form.enabled}
                  onChange={(event) => updateForm("enabled", event.target.value)}
                  className="rounded-lg border border-[#f0d2ca] bg-[#ffffff] px-3 py-2 text-sm text-[#251E1F] outline-none"
                >
                  <option value="Enabled">Enabled</option>
                  <option value="Disabled">Disabled</option>
                </select>
              </div>
              <p className="mt-4 rounded-xl border border-[#7DD3FC]/25 bg-[#7DD3FC]/10 p-3 text-sm text-[#BAE6FD]">
                MBMF is calculated only for employees with religion set to {form.applicableReligion}.
              </p>
            </section>

            <section className="app-panel rounded-2xl p-5">
              <h4 className="font-semibold text-[#251E1F]">2. Contribution Rates</h4>
              <div className="mt-4 space-y-3">
                <SettingInput value={form.effectiveFrom} onChange={(value) => updateForm("effectiveFrom", value)} placeholder="Effective date" />
                <select
                  value={form.rateType}
                  onChange={(event) => updateForm("rateType", event.target.value)}
                  className="w-full rounded-lg border border-[#f0d2ca] bg-[#ffffff] px-3 py-2 text-sm text-[#251E1F] outline-none"
                >
                  <option value="Percentage of Gross Salary">Percentage of Gross Salary</option>
                  <option value="Fixed Amount">Fixed Amount</option>
                </select>
                <SettingInput value={form.employeeRate} onChange={(value) => updateForm("employeeRate", value)} placeholder="Employee rate %" />
                <SettingInput value={form.employerRate} onChange={(value) => updateForm("employerRate", value)} placeholder="Employer rate %" />
                <div className="rounded-lg border border-[#f0d2ca] bg-white/800 px-3 py-2 text-sm text-[#7b6660]">
                  Total Rate: <span className="font-semibold text-[#251E1F]">{(employeeRate + employerRate).toFixed(2)}%</span>
                </div>
              </div>
            </section>

            <section className="app-panel rounded-2xl p-5">
              <h4 className="font-semibold text-[#251E1F]">3. Wage Ceiling</h4>
              <div className="mt-4 space-y-3">
                <select
                  value="Monthly Wage Ceiling"
                  className="w-full rounded-lg border border-[#f0d2ca] bg-[#ffffff] px-3 py-2 text-sm text-[#251E1F] outline-none"
                  disabled
                >
                  <option value="Monthly Wage Ceiling">Monthly Wage Ceiling</option>
                </select>
                <SettingInput value={form.monthlyWageCeiling} onChange={(value) => updateForm("monthlyWageCeiling", value)} placeholder="Monthly wage ceiling" />
              </div>
              <p className="mt-4 rounded-xl border border-[#D97706]/25 bg-[#D97706]/10 p-3 text-sm text-[#9A6412]">
                If gross salary is above the ceiling, MBMF uses the ceiling amount only.
              </p>
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
            <section className="app-panel rounded-2xl p-5">
              <h4 className="font-semibold text-[#251E1F]">4. Map GL Accounts</h4>
              <div className="mt-4 grid gap-3">
                <SettingInput value={form.employerExpenseAccount} onChange={(value) => updateForm("employerExpenseAccount", value)} />
                <SettingInput value={form.employeePayableAccount} onChange={(value) => updateForm("employeePayableAccount", value)} />
                <SettingInput value={form.clearingAccount} onChange={(value) => updateForm("clearingAccount", value)} />
                <SettingInput value={form.paymentBankAccount} onChange={(value) => updateForm("paymentBankAccount", value)} />
              </div>
            </section>

            <section className="app-panel rounded-2xl p-5">
              <h4 className="font-semibold text-[#251E1F]">5. Save & Apply</h4>
              <div className="mt-4 rounded-xl border border-[#2f8758]/25 bg-[#2f8758]/10 p-4 text-sm text-[#065F46]">
                Saved MBMF settings are applied to eligible Muslim employees only.
              </div>
              <button
                type="button"
                className="mt-5 rounded-xl border border-[#F38978]/25 bg-[#F38978]/10 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#F38978]/18 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={saveMbmfSettings}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save MBMF Settings"}
              </button>
            </section>
          </div>

          <section className="app-panel overflow-hidden rounded-2xl">
            <div className="border-b border-[#f0d2ca] px-5 py-4">
              <h4 className="font-semibold text-[#251E1F]">Contribution Calculation Example</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[52rem] w-full border-separate border-spacing-0 text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-[#F38978]/80">
                  <tr>
                    <th className="border-b border-[#f0d2ca] px-4 py-3">Gross Salary</th>
                    <th className="border-b border-[#f0d2ca] px-4 py-3">Wage Ceiling</th>
                    <th className="border-b border-[#f0d2ca] px-4 py-3">Salary Considered</th>
                    <th className="border-b border-[#f0d2ca] px-4 py-3">Employee</th>
                    <th className="border-b border-[#f0d2ca] px-4 py-3">Employer</th>
                    <th className="border-b border-[#f0d2ca] px-4 py-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {examples.map((example) => (
                    <tr key={example.grossSalary}>
                      <td className="border-b border-[#f0d2ca] px-4 py-3 text-[#251E1F]">{formatMoney(example.grossSalary)}</td>
                      <td className="border-b border-[#f0d2ca] px-4 py-3 text-[#7b6660]">{formatMoney(ceiling)}</td>
                      <td className="border-b border-[#f0d2ca] px-4 py-3 text-[#7b6660]">{formatMoney(example.salaryConsidered)}</td>
                      <td className="border-b border-[#f0d2ca] px-4 py-3 text-[#7b6660]">{formatMoney(example.employeeAmount)}</td>
                      <td className="border-b border-[#f0d2ca] px-4 py-3 text-[#7b6660]">{formatMoney(example.employerAmount)}</td>
                      <td className="border-b border-[#f0d2ca] px-4 py-3 font-semibold text-[#251E1F]">{formatMoney(example.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="app-panel rounded-2xl p-5">
            <h4 className="font-semibold text-[#251E1F]">Applicability</h4>
            <div className="mt-4 rounded-xl border border-[#F38978]/25 bg-[#F38978]/10 p-4">
              <p className="text-sm font-semibold text-[#251E1F]">Applicable To</p>
              <p className="mt-1 text-sm text-[#7b6660]">All employees where staff.religion = {form.applicableReligion}</p>
            </div>
            <div className="mt-4 grid gap-3 text-sm">
              <div className="flex items-center justify-between rounded-xl border border-[#f0d2ca] bg-white/800 px-4 py-3">
                <span className="text-[#7b6660]">Total Staff</span>
                <span className="font-semibold text-[#251E1F]">{eligibility?.totalStaff ?? 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-[#f0d2ca] bg-white/800 px-4 py-3">
                <span className="text-[#7b6660]">Eligible {form.applicableReligion} Staff</span>
                <span className="font-semibold text-[#2f8758]">{eligibility?.eligibleMuslimEmployees ?? 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-[#f0d2ca] bg-white/800 px-4 py-3">
                <span className="text-[#7b6660]">Not Applied</span>
                <span className="font-semibold text-[#251E1F]">{eligibility?.nonEligibleEmployees ?? 0}</span>
              </div>
            </div>
            {!eligibility?.hasReligionColumn ? (
              <p className="mt-4 rounded-xl border border-[#D97706]/25 bg-[#D97706]/10 p-3 text-sm text-[#9A6412]">
                Add a religion column to the staff table so the system can identify Muslim employees.
              </p>
            ) : null}
            {eligibility?.sampleEmployees?.length ? (
              <div className="mt-4 rounded-xl border border-[#f0d2ca] bg-white/800 p-4">
                <p className="text-sm font-semibold text-[#251E1F]">Eligible Staff Preview</p>
                <div className="mt-3 space-y-2 text-sm text-[#7b6660]">
                  {eligibility.sampleEmployees.map((employee) => (
                    <div key={employee.employee_id} className="flex items-center justify-between gap-3">
                      <span>{employee.name || employee.employee_code || `Employee ${employee.employee_id}`}</span>
                      <span className="font-semibold text-[#251E1F]">{employee.religion}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="app-panel rounded-2xl p-5">
            <h4 className="font-semibold text-[#251E1F]">Process Flow</h4>
            <ol className="mt-4 space-y-3 text-sm text-[#7b6660]">
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
      <section className="app-panel rounded-2xl p-5">
        <h3 className="text-lg font-semibold text-[#251E1F]">Wage Ceiling History</h3>
        <div className="mt-4 space-y-3">
          {cpfCeilingHistory.map(([effectiveFrom, ceiling]) => (
            <div key={effectiveFrom} className="flex items-center justify-between rounded-xl border border-[#f0d2ca] bg-white/800 px-4 py-3 text-sm">
              <span className="text-[#7b6660]">{effectiveFrom}</span>
              <span className="font-semibold text-[#251E1F]">SGD {ceiling}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-xl border border-[#D97706]/25 bg-[#D97706]/10 p-3 text-sm text-[#9A6412]">
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
    <section className="app-panel overflow-hidden rounded-2xl">
      <div className="border-b border-[#f0d2ca] px-5 py-4">
        <h3 className="text-lg font-semibold text-[#251E1F]">Community Fund Contribution Rules</h3>
        <p className="mt-1 text-sm text-[#7b6660]">Configure CDAC, SINDA and ECF using staff race fields. MBMF remains in its dedicated religion-based panel.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[82rem] w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-[#F38978]/80">
            <tr>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Scheme</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Enabled</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Effective From</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Eligibility</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Eligible Staff</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Rule</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Payable Account</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const eligibleUsers = getEligibleUsers(users, row.eligibilityField, row.eligibilityValue);

              return (
                <tr key={row.key}>
                  <td className="border-b border-[#f0d2ca] px-4 py-4">
                    <p className="font-semibold text-[#251E1F]">{row.label}</p>
                    <p className="mt-1 text-xs text-[#7b6660]">{row.description}</p>
                  </td>
                  <td className="border-b border-[#f0d2ca] px-4 py-4">
                    <select
                      value={row.enabled}
                      onChange={(event) => updateRow(row.key, "enabled", event.target.value)}
                      className="w-full rounded-lg border border-[#f0d2ca] bg-[#ffffff] px-3 py-2 text-sm text-[#251E1F] outline-none"
                    >
                      <option value="Enabled">Enabled</option>
                      <option value="Disabled">Disabled</option>
                    </select>
                  </td>
                  <td className="border-b border-[#f0d2ca] px-4 py-4">
                    <input
                      type="date"
                      value={row.effectiveFrom}
                      onChange={(event) => updateRow(row.key, "effectiveFrom", event.target.value)}
                      className="w-full rounded-lg border border-[#f0d2ca] bg-white/800 px-3 py-2 text-sm text-[#251E1F] outline-none"
                    />
                  </td>
                  <td className="border-b border-[#f0d2ca] px-4 py-4">
                    <SettingInput
                      value={row.eligibilityValue}
                      onChange={(value) => updateRow(row.key, "eligibilityValue", value)}
                      placeholder={row.eligibilityField}
                    />
                    <p className="mt-1 text-xs text-[#7b6660]/80">staff.{row.eligibilityField}</p>
                  </td>
                  <td className="border-b border-[#f0d2ca] px-4 py-4 text-[#7b6660]">
                    <span className="font-semibold text-[#251E1F]">{eligibleUsers.length}</span> staff
                  </td>
                  <td className="border-b border-[#f0d2ca] px-4 py-4">
                    <SettingInput value={row.contributionRule} onChange={(value) => updateRow(row.key, "contributionRule", value)} />
                  </td>
                  <td className="border-b border-[#f0d2ca] px-4 py-4">
                    <SettingInput value={row.payableAccount} onChange={(value) => updateRow(row.key, "payableAccount", value)} />
                  </td>
                  <td className="border-b border-[#f0d2ca] px-4 py-4">
                    <button
                      type="button"
                      className="rounded-xl border border-[#F38978]/25 bg-[#F38978]/10 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#F38978]/18 disabled:cursor-not-allowed disabled:opacity-60"
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
        <section className="app-panel rounded-2xl p-5">
          <h3 className="text-lg font-semibold text-[#251E1F]">Operational Payroll Settings</h3>
          <p className="mt-1 text-sm text-[#7b6660]">
            CPF rates, wage ceilings, SDL and self-help fund rules are managed in Compliance Rules.
          </p>
        </section>
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
        <section className="app-panel rounded-2xl p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[#251E1F]">Singapore Payroll Compliance Baseline</h3>
              <p className="mt-1 text-sm text-[#7b6660]">Editable defaults for CPF, SDL, levy treatment and contribution rules.</p>
            </div>
            <p className="text-sm font-semibold text-[#F38978]">Verified for 2026 payroll periods</p>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {complianceUpdates.map((item) => (
              <div key={item.label} className="rounded-xl border border-[#f0d2ca] bg-white/800 p-4">
                <p className="text-sm font-semibold text-[#251E1F]">{item.label}</p>
                <p className="mt-2 text-xs leading-5 text-[#7b6660]">{item.value}</p>
                <p className="mt-3 text-xs font-semibold text-[#F38978]">
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
    <section className="app-panel rounded-2xl p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#251E1F]">Custom Compliance Rules</h3>
          <p className="mt-1 text-sm text-[#7b6660]">Add company-specific payroll compliance rules and keep their effective dates visible.</p>
        </div>
        <p className="text-sm font-semibold text-[#F38978]">{customRules.length} custom rule(s)</p>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-[#f0d2ca] bg-white/800 p-5">
          <h4 className="font-semibold text-[#251E1F]">{editingKey ? "Edit Rule" : "Add Rule"}</h4>
          <div className="mt-4 grid gap-3">
            <SettingInput value={form.title} onChange={(value) => updateForm("title", value)} placeholder="Rule title" />
            <div className="grid gap-3 sm:grid-cols-2">
              <SettingInput value={form.category} onChange={(value) => updateForm("category", value)} placeholder="Category" />
              <input
                type="date"
                value={form.effectiveFrom}
                onChange={(event) => updateForm("effectiveFrom", event.target.value)}
                className="w-full rounded-lg border border-[#f0d2ca] bg-white/800 px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#F38978]/50"
              />
            </div>
            <textarea
              value={form.ruleText}
              onChange={(event) => updateForm("ruleText", event.target.value)}
              placeholder="Rule details"
              rows={5}
              className="w-full resize-y rounded-lg border border-[#f0d2ca] bg-white/800 px-3 py-2 text-sm text-[#251E1F] outline-none placeholder:text-[#7b6660]/50 focus:border-[#F38978]/50"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <SettingInput value={form.source} onChange={(value) => updateForm("source", value)} placeholder="Source or reference" />
              <select
                value={form.status}
                onChange={(event) => updateForm("status", event.target.value)}
                className="w-full rounded-lg border border-[#f0d2ca] bg-[#ffffff] px-3 py-2 text-sm text-[#251E1F] outline-none"
              >
                <option value="Active">Active</option>
                <option value="Draft">Draft</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-xl border border-[#F38978]/25 bg-[#F38978]/10 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#F38978]/18 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={saveRule}
                disabled={isSaving || !form.title.trim() || !form.ruleText.trim()}
              >
                {isSaving ? "Saving..." : editingKey ? "Save Rule" : "Add Rule"}
              </button>
              {editingKey ? (
                <button
                  type="button"
                  className="rounded-xl border border-[#f0d2ca] bg-white/800 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/45"
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
              <article key={rule.settingKey} className="rounded-2xl border border-[#f0d2ca] bg-white/800 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-[#251E1F]">{rule.title}</h4>
                      <span className="rounded-full border border-[#f0d2ca] bg-white/800 px-3 py-1 text-xs font-semibold text-[#7b6660]">
                        {rule.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#7b6660]">{rule.ruleText}</p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-xl border border-[#f0d2ca] bg-white/800 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/45"
                    onClick={() => startEdit(rule)}
                  >
                    Edit
                  </button>
                </div>
                <div className="mt-4 grid gap-3 text-xs text-[#7b6660] sm:grid-cols-3">
                  <span>Category: <span className="font-semibold text-[#251E1F]">{rule.category}</span></span>
                  <span>Effective: <span className="font-semibold text-[#251E1F]">{rule.effectiveFrom ? formatDate(rule.effectiveFrom) : "Not set"}</span></span>
                  <span>Updated: <span className="font-semibold text-[#251E1F]">{formatDateTime(rule.updatedAt)}</span></span>
                </div>
                {rule.source ? <p className="mt-3 text-xs text-[#F38978]">Source: {rule.source}</p> : null}
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
      <div className="mb-5 grid gap-3 rounded-2xl border border-[#f0d2ca] bg-white/800 p-4 md:grid-cols-[1fr_1fr_1fr_auto]">
        <label className="space-y-2">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#F38978]/80">
            <Filter size={14} />
            Date Filter
          </span>
          <select
            value={periodMode}
            onChange={(event) => setPeriodMode(event.target.value)}
            className="w-full rounded-xl border border-[#f0d2ca] bg-[#ffffff] px-3 py-2.5 text-sm font-semibold text-[#251E1F] outline-none"
          >
            <option value="all">All payroll periods</option>
            <option value="range">From date to date</option>
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#F38978]/80">From Date</span>
          <input
            type="date"
            value={fromDate}
            disabled={periodMode === "all"}
            onChange={(event) => setFromDate(event.target.value)}
            className="w-full rounded-xl border border-[#f0d2ca] bg-[#ffffff] px-3 py-2.5 text-sm font-semibold text-[#251E1F] outline-none disabled:opacity-50"
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#F38978]/80">To Date</span>
          <input
            type="date"
            value={toDate}
            min={fromDate}
            disabled={periodMode === "all"}
            onChange={(event) => setToDate(event.target.value)}
            className="w-full rounded-xl border border-[#f0d2ca] bg-[#ffffff] px-3 py-2.5 text-sm font-semibold text-[#251E1F] outline-none disabled:opacity-50"
          />
        </label>
        <div className="flex items-end">
          <div className="rounded-xl border border-[#F38978]/25 bg-[#F38978]/10 px-4 py-2.5 text-sm font-semibold text-[#251E1F]">
            {filteredRuns.length} of {payrollRuns.length} run(s)
          </div>
        </div>
      </div>

      <div className="app-panel overflow-hidden rounded-2xl">
        <div className="grid grid-cols-5 gap-4 border-b border-[#f0d2ca] px-6 py-4 text-xs font-semibold uppercase tracking-wide text-[#F38978]/80">
          <span>Pay Period</span>
          <span>Updated</span>
          <span>Employees</span>
          <span>Status</span>
          <span>Action</span>
        </div>
        {filteredRuns.length ? (
          filteredRuns.map((run) => (
            <div key={run.payroll_run_id} className="grid grid-cols-5 gap-4 border-b border-[#f0d2ca] px-6 py-4 text-sm last:border-b-0">
              <div>
                <p className="font-semibold text-[#251E1F]">{formatPayrollPeriod(run)}</p>
                <p className="mt-1 text-[#7b6660]">Created by {run.created_by_name || "Unknown"}</p>
              </div>
              <p className="text-[#7b6660]">{formatDateTime(run.updated_at || run.created_at)}</p>
              <p className="text-[#7b6660]">{run.employee_count}</p>
              <p className="text-[#251E1F]">{run.status}</p>
              <button type="button" className="justify-self-start rounded-xl bg-white/800 px-4 py-2 font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/45" onClick={() => setSelectedRun(run)}>
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
        <div className="mt-5 rounded-2xl border border-[#f0d2ca] bg-white/800 p-5 text-sm text-[#7b6660]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-[#251E1F]">{formatPayrollPeriod(selectedRun)}</p>
              <p className="mt-1">Finance status: {selectedRun.status}</p>
            </div>
            <button
              type="button"
              className="w-fit rounded-xl border border-[#f0d2ca] bg-white/800 px-4 py-2 font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/45"
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

function formatAuditArea(entityType) {
  const areaLabels = {
    payroll_setting: "Payroll Setting",
    payslip_layout: "Payslip Layout",
    user: "User Account",
    payroll_run: "Payroll Run",
    payslip: "Payslip",
    system: "System"
  };

  return areaLabels[entityType] || String(entityType || "system").replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
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
        formatAuditArea(log.entity_type),
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
        <div className="app-panel rounded-2xl p-5">
          <p className="text-sm text-[#7b6660]">Total Events</p>
          <p className="mt-3 text-3xl font-semibold text-[#251E1F]">{auditLogs.length}</p>
        </div>
        <div className="app-panel rounded-2xl p-5">
          <p className="text-sm text-[#7b6660]">Visible Events</p>
          <p className="mt-3 text-3xl font-semibold text-[#F38978]">{filteredLogs.length}</p>
        </div>
        <div className="app-panel rounded-2xl p-5">
          <p className="text-sm text-[#7b6660]">Entity Types</p>
          <p className="mt-3 text-3xl font-semibold text-[#2f8758]">{Math.max(entityTypes.length - 1, 0)}</p>
        </div>
      </div>

      <div className="mt-6 app-panel rounded-2xl p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#251E1F]">Activity Trail</h3>
            <p className="mt-1 text-sm text-[#7b6660]">Search and filter admin changes with exact timestamps.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_14rem] lg:w-[38rem]">
            <label className="flex items-center gap-2 rounded-xl border border-[#f0d2ca] bg-white/800 px-3 py-2.5">
              <Search size={16} className="text-[#F38978]" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search action, user, entity..."
                className="min-w-0 flex-1 bg-transparent text-sm text-[#251E1F] outline-none placeholder:text-[#7b6660]/60"
              />
            </label>

            <select
              value={entityFilter}
              onChange={(event) => setEntityFilter(event.target.value)}
              className="rounded-xl border border-[#f0d2ca] bg-[#ffffff] px-3 py-2.5 text-sm font-semibold text-[#251E1F] outline-none"
            >
              {entityTypes.map((entityType) => (
                <option key={entityType} value={entityType}>{entityType} entities</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[56rem] w-full border-separate border-spacing-0 text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-[#F38978]/80">
              <tr>
                <th className="border-b border-[#f0d2ca] px-4 py-3 font-semibold">Timestamp</th>
                <th className="border-b border-[#f0d2ca] px-4 py-3 font-semibold">Action</th>
                <th className="border-b border-[#f0d2ca] px-4 py-3 font-semibold">Area</th>
                <th className="border-b border-[#f0d2ca] px-4 py-3 font-semibold">Entity ID</th>
                <th className="border-b border-[#f0d2ca] px-4 py-3 font-semibold">Performed By</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.log_id || `${log.entity_type}-${log.entity_id}-${log.created_at}`} className="text-[#7b6660] transition hover:bg-[#FDD9CD]/45">
                  <td className="border-b border-[#f0d2ca] px-4 py-4 font-semibold text-[#251E1F]">
                    {formatDateTime(log.created_at)}
                  </td>
                  <td className="border-b border-[#f0d2ca] px-4 py-4">{log.action || "System activity"}</td>
                  <td className="border-b border-[#f0d2ca] px-4 py-4">
                    <span className="rounded-full border border-[#f0d2ca] bg-white/800 px-3 py-1 text-xs font-semibold text-[#7b6660]">
                      {formatAuditArea(log.entity_type)}
                    </span>
                  </td>
                  <td className="border-b border-[#f0d2ca] px-4 py-4">{log.entity_id || "-"}</td>
                  <td className="border-b border-[#f0d2ca] px-4 py-4">{log.user_name || "System"}</td>
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
      <div className="app-panel rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-[#251E1F]">Payslips Pending Final Approval</h3>
            <p className="mt-1 text-sm text-[#7b6660]">
              Review payslips approved by Finance. Final approval will send them to staff.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchPayslips}
            className="rounded-lg border border-[#f0d2ca] bg-white/800 px-4 py-2 text-sm font-medium text-[#251E1F] hover:bg-[#FDD9CD]/45"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="app-panel rounded-2xl border-red-500/40 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div className="app-panel rounded-2xl border-emerald-500/40 p-4 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <div className="app-panel overflow-hidden rounded-2xl">
        {loading ? (
          <div className="flex items-center gap-3 p-6 text-[#7b6660]">
            <Loader2 className="animate-spin" size={18} />
            Loading payslips...
          </div>
        ) : payslips.length === 0 ? (
          <div className="p-6 text-center">
            <div className="mb-3 inline-block rounded-full bg-emerald-500/10 p-3">
              <CheckCircle2 className="text-emerald-700" size={24} />
            </div>
            <p className="text-sm text-[#7b6660]">No payslips pending final approval</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#f0d2ca] bg-white/800 text-[#7b6660]">
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
                  <tr key={payslip.payslip_id} className="border-b border-[#f0d2ca] text-[#251E1F]">
                    <td className="px-4 py-3 text-xs text-[#7b6660]">{payslip.payslip_id}</td>
                    <td className="px-4 py-3">{payslip.staff_name}</td>
                    <td className="px-4 py-3 text-[#7b6660]">
                      {payslip.period_month} {payslip.period_year}
                    </td>
                    <td className="px-4 py-3 text-[#7b6660]">
                      ${Number(payslip.gross_salary || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-emerald-700">
                      ${Number(payslip.net_pay || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#7b6660]">
                      {payslip.finance_approved_by || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleApprove(payslip.payslip_id)}
                          disabled={actionInProgress === payslip.payslip_id}
                          className="rounded-lg bg-cyan-500/20 px-3 py-1 text-xs text-cyan-700 hover:bg-cyan-500/30 disabled:opacity-50"
                        >
                          {actionInProgress === payslip.payslip_id ? <Loader2 className="inline animate-spin" size={12} /> : "Send"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectingPayslipId(payslip.payslip_id)}
                          disabled={actionInProgress === payslip.payslip_id}
                          className="rounded-lg bg-red-500/20 px-3 py-1 text-xs text-red-700 hover:bg-red-500/30 disabled:opacity-50"
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
          <div className="app-panel m-4 w-full max-w-md rounded-2xl p-6">
            <div className="mb-4 flex items-center gap-3">
              <AlertCircle className="text-red-700" size={20} />
              <h3 className="text-lg font-semibold text-[#251E1F]">Reject Payslip</h3>
            </div>
            <p className="mb-4 text-sm text-[#7b6660]">
              Please provide a reason for rejecting this payslip.
            </p>
            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full rounded-lg border border-[#f0d2ca] bg-white/800 px-3 py-2 text-sm text-[#251E1F] placeholder-white/30"
              rows={4}
            />
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => handleReject(rejectingPayslipId)}
                disabled={actionInProgress === rejectingPayslipId}
                className="flex-1 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-500/30 disabled:opacity-50"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => {
                  setRejectingPayslipId(null);
                  setRejectReason("");
                }}
                className="flex-1 rounded-lg border border-[#f0d2ca] bg-white/800 px-4 py-2 text-sm font-medium text-[#251E1F] hover:bg-[#FDD9CD]/45"
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
function createPdfBlob(title, rows, periodLabel = "All available dates") {
  const brandedRows = rows.map((row) => (typeof row === "string" ? [row] : row.columns || [row.summary || ""]));
  const reportHeaders = {
    "Access Control Report": ["Employee", "Role", "Account / Department / Staff Link"],
    "Audit Activity Report": ["Date / Time", "Action or Event", "Record / Module", "User / Role"],
    "Audit Logs": ["Date / Time", "Action or Event", "Record / Module", "User / Role"],
    "Compliance Configuration Report": ["Setting", "Configured Value", "Description"],
    "Payroll Control Summary": ["Control Item", "Current Value"],
    "Payroll Run Financial Report": ["Payroll Period", "Status", "Employees / Gross / Net"]
  };
  const headers = reportHeaders[title] || Array.from(
    { length: Math.max(1, ...brandedRows.map((row) => row.length)) },
    (_, index) => `Detail ${index + 1}`
  );

  return createPayrollReportPdf({
    category: "ADMIN PAYROLL",
    categorySubtitle: "Governance, access, compliance and payroll oversight",
    footer: "Prepared for Admin review. Generated by the Automated Payroll System.",
    subtitle: `Reporting Period: ${periodLabel}`,
    summaryRows: [
      ["Report", title, "Admin review"],
      ["Records", String(brandedRows.length), periodLabel]
    ],
    tableRows: [headers, ...brandedRows],
    title
  });
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

  if (report === "Payroll Control Summary") {
    return [
      { summary: `Active users: ${stats.activeUsers ?? 0}`, columns: ["Active users", String(stats.activeUsers ?? 0)] },
      { summary: `Pending approvals: ${data.pendingApprovalCount ?? 0}`, columns: ["Pending admin approvals", String(data.pendingApprovalCount ?? 0)] },
      { summary: `Payroll runs: ${data.payrollRuns?.length || 0}`, columns: ["Payroll runs monitored", String(data.payrollRuns?.length || 0)] },
      { summary: `Payroll records: ${stats.payrollRecords ?? 0}`, columns: ["Employee payroll records", String(stats.payrollRecords ?? 0)] },
      { summary: `Gross payroll: ${formatMoney(stats.grossPay)}`, columns: ["Gross payroll", formatMoney(stats.grossPay)] },
      { summary: `Net payroll: ${formatMoney(stats.netPay)}`, columns: ["Net payroll", formatMoney(stats.netPay)] },
      { summary: `Total deductions: ${formatMoney(stats.deductions)}`, columns: ["Total deductions", formatMoney(stats.deductions)] }
    ];
  }

  if (report === "Access Control Report") {
    return (data.users || []).map((user) =>
      ({
        columns: [
          user.name,
          user.role_name,
          `${Number(user.status) === 1 ? "Active" : "Inactive"} / ${user.department_name || "No department"} / ${user.employee_code || "No linked staff"}`
        ]
      })
    );
  }

  if (report === "Compliance Configuration Report") {
    return (data.settings || [])
      .filter((setting) =>
        ["statutory_", "cpf_", "sdl_", "mbmf_", "cdac_", "sinda_", "ecf_", "iras_", "ir21_", "foreign_worker_levy_"].some((prefix) =>
          setting.setting_key.startsWith(prefix)
        )
      )
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

  if (report === "Payroll Run Financial Report") {
    return (data.payrollRuns || [])
      .filter((run) => isWithinReportPeriod(run.created_at, periodMode, fromDate, toDate))
      .map((run) => ({
        columns: [
          `${String(run.payroll_month).padStart(2, "0")}/${run.payroll_year}`,
          run.status || "Pending",
          `${Number(run.employee_count || 0)} staff / gross ${formatMoney(run.gross_pay)} / net ${formatMoney(run.net_pay)}`
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
        formatAuditArea(log.entity_type),
        log.user_name || "System"
      ]
    })
  );
}

function ReportPreviewModal({ data, report, onClose }) {
  const [pdfUrl, setPdfUrl] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const [periodMode, setPeriodMode] = useState("range");
  const [fromDate, setFromDate] = useState(yearStart);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#fff8f5]/80 px-4 backdrop-blur-sm">
      <section className="app-panel flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl p-6">
        <div className="flex flex-col gap-4 border-b border-[#f0d2ca] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#F38978]/80">PDF Preview</p>
            <h3 className="mt-2 text-xl font-semibold text-[#251E1F]">{report}</h3>
            <p className="mt-1 text-sm text-[#7b6660]">{getPeriodLabel(periodMode, fromDate, toDate)}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={pdfUrl}
              download={`${report.toLowerCase().replaceAll(" ", "-")}.pdf`}
              className="primary-button inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold"
            >
              <FileText size={17} />
              Download PDF
            </a>
            <button
              type="button"
              className="rounded-xl border border-[#f0d2ca] bg-white/800 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/45"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 rounded-xl border border-[#f0d2ca] bg-white/800 p-4 md:grid-cols-3">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#F38978]/80">Period Type</span>
            <select
              value={periodMode}
              onChange={(event) => setPeriodMode(event.target.value)}
              className="w-full rounded-xl border border-[#f0d2ca] bg-[#ffffff] px-3 py-2.5 text-sm font-semibold text-[#251E1F] outline-none"
            >
              <option value="range">From Date to Date</option>
              <option value="single">On This Day</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#F38978]/80">
              {periodMode === "single" ? "Date" : "From Date"}
            </span>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="w-full rounded-xl border border-[#f0d2ca] bg-[#ffffff] px-3 py-2.5 text-sm font-semibold text-[#251E1F] outline-none"
            />
          </label>
          {periodMode === "range" ? (
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#F38978]/80">To Date</span>
              <input
                type="date"
                value={toDate}
                min={fromDate}
                onChange={(event) => setToDate(event.target.value)}
                className="w-full rounded-xl border border-[#f0d2ca] bg-[#ffffff] px-3 py-2.5 text-sm font-semibold text-[#251E1F] outline-none"
              />
            </label>
          ) : null}
        </div>
        <div className="mt-5 min-h-0 flex-1 overflow-hidden rounded-xl border border-[#f0d2ca] bg-white">
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
  const [reportData, setReportData] = useState(null);
  const [reportError, setReportError] = useState("");
  const [reportLoading, setReportLoading] = useState(true);

  useEffect(() => {
    if (data?.payrollRuns && data?.settings && data?.auditLogs) {
      setReportData(data);
      setReportLoading(false);
      return undefined;
    }

    let active = true;
    getAdminPayrollReports()
      .then((result) => {
        if (active) setReportData(result);
      })
      .catch((error) => {
        if (active) setReportError(error.message || "Unable to load payroll report data.");
      })
      .finally(() => {
        if (active) setReportLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const effectiveData = reportData || data || {};
  const reportCards = [
    {
      title: "Payroll Control Summary",
      description: "Active users, pending approvals, monitored runs and active layouts."
    },
    {
      title: "Access Control Report",
      description: "Admin, HR, Finance and Staff access with account status."
    },
    {
      title: "Compliance Configuration Report",
      description: "CPF, SDL, self-help fund, IRAS and statutory rule settings."
    },
    {
      title: "Payroll Run Financial Report",
      description: "Monthly employee count, gross pay, deductions, net pay and run status."
    },
    {
      title: "Audit Activity Report",
      description: "Recent admin payroll changes with timestamp and performer."
    }
  ];

  return (
    <PageShell
      heading="Reports"
      updatedAt={getOverallUpdatedAt(effectiveData)}
      actions={
        <>
          <ActionButton icon={FileBarChart} onClick={() => setSelectedReport(reportCards[0].title)}>Generate Report</ActionButton>
          <ActionButton icon={FileText} variant="secondary" onClick={() => setSelectedReport("Payroll Run Financial Report")}>Payroll Financial Report</ActionButton>
        </>
      }
    >
      {reportLoading ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-[#f0d2ca] bg-white/800 p-4 text-sm text-[#7b6660]">
          <Loader2 size={17} className="animate-spin" /> Loading consolidated payroll report data...
        </div>
      ) : null}
      {reportError ? (
        <div className="mb-4 rounded-xl border border-red-300/40 bg-red-50 p-4 text-sm text-red-700">{reportError}</div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {reportCards.map((report) => (
          <div key={report.title} className="app-panel rounded-2xl p-6">
            <FileBarChart size={24} className="text-[#F38978]" />
            <h3 className="mt-4 font-semibold text-[#251E1F]">{report.title}</h3>
            <p className="mt-2 text-sm text-[#7b6660]">{report.description}</p>
            <button
              type="button"
              className="mt-5 rounded-xl border border-[#f0d2ca] bg-white/800 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/45"
              onClick={() => setSelectedReport(report.title)}
            >
              Open
            </button>
          </div>
        ))}
      </div>
      {selectedReport ? (
        <ReportPreviewModal
          data={effectiveData}
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
  if (pathname.endsWith("/audit-logs")) return <PayrollAuditLogPage />;
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
      setIsLoading(true);
      const data = location.pathname.endsWith("/reports")
        ? await getAdminPayrollReports()
        : await getAdminPayrollDashboard();
      setDashboardData(data);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [location.pathname]);

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
        homePath="/dashboard/payroll/admin"
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
      homePath="/dashboard/payroll/admin"
      searchPlaceholder="Search payroll, staff, approvals..."
    >
      {isLoading ? (
        <div className="app-panel rounded-2xl p-6 text-sm text-[#7b6660]">
          Loading admin payroll data...
        </div>
      ) : null}
      {errorMessage ? (
        <div className="mb-4 rounded-xl border border-[#D97706]/25 bg-[#D97706]/10 p-4 text-sm text-[#9A6412]">
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
