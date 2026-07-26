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
  Building2,
} from "lucide-react";

import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import {
  addPayslipLayout,
  createUser,
  getAdminPayrollDashboard,
  getAdminPayrollInsights,
  getAdminPayrollReports,
  exportAdminPayrollReport,
  getEffectivePayrollRules,
  getPayslipLayoutPreview,
  getPayslipSamplePreview,
  resetUserPassword,
  setDefaultPayslipLayout,
  publishPayrollRules,
  updatePayrollSetting,
  updateUserRole,
  updateUserStatus,
} from "../../services/adminPayrollService.js";

import { getStoredSession } from "../../services/sessionService.js";
import PayrollAuditLogPage from "./PayrollAuditLogPage.jsx";
import PayrollUserManagement from "../../components/payroll/PayrollUserManagement.jsx";
import {
  getCompanyProfile,
  getSupportRequests,
  reviewSupportRequest,
  revokeSupportRequest,
  updateCompanyProfile,
  uploadCompanyLogo,
} from "../../services/companyService.js";

import {
  buildSettingsByKey,
  cpfAgeTierRows,
  cpfCalculationSettings,
  cpfCeilingHistory,
  cpfCeilingSettings,
  deductionComponentRows,
  earningComponentRows,
  employerContributionRows,
  resolveFinancePayrollConfig,
  slugify,
} from "../../utils/payrollRules.js";
import { createPayrollReportPdf } from "../../utils/payrollReportPdf.js";

const pageTitle = "Automated Payroll System – Admin Payroll Dashboard";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

function LogoCropModal({ file, busy, onCancel, onSave }) {
  const [source, setSource] = useState("");
  const [zoom, setZoom] = useState(1);
  const [positionX, setPositionX] = useState(0);
  const [positionY, setPositionY] = useState(0);

  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    setSource(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!file) return null;

  const createCroppedLogo = async () => {
    const image = new Image();
    image.src = source;
    await image.decode();
    const width = 1200;
    const height = 500;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, width, height);
    const baseScale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const scale = baseScale * zoom;
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const availableX = Math.max(0, drawWidth - width);
    const availableY = Math.max(0, drawHeight - height);
    const x = (width - drawWidth) / 2 + (positionX / 100) * (availableX / 2);
    const y = (height - drawHeight) / 2 + (positionY / 100) * (availableY / 2);
    context.drawImage(image, x, y, drawWidth, drawHeight);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
    if (!blob) throw new Error("The cropped logo could not be created.");
    await onSave(new File([blob], "company-logo-cropped.png", { type: "image/png" }));
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="logo-crop-title">
      <div className="w-full max-w-xl rounded-2xl border border-[#f0d2ca] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id="logo-crop-title" className="text-lg font-semibold">Crop brand logo</h3>
            <p className="mt-1 text-sm text-[#7b6660]">Zoom and position the logo inside the wide document frame.</p>
          </div>
          <button type="button" disabled={busy} onClick={onCancel} className="rounded-lg p-2 hover:bg-[#fff3ef] disabled:opacity-50" aria-label="Close crop editor"><X size={18} /></button>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-[#e7c9c1] bg-[linear-gradient(45deg,#f3f3f3_25%,transparent_25%),linear-gradient(-45deg,#f3f3f3_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f3f3f3_75%),linear-gradient(-45deg,transparent_75%,#f3f3f3_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px]">
          <div className="relative aspect-[12/5] overflow-hidden">
            {source ? <img src={source} alt="Logo crop preview" draggable="false" className="absolute h-full w-full select-none object-cover" style={{ transform: `translate(${positionX * 0.35}%, ${positionY * 0.35}%) scale(${zoom})` }} /> : null}
            <div className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-inset ring-[#F38978]" />
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {[["Zoom", zoom, setZoom, 1, 4, 0.05], ["Horizontal", positionX, setPositionX, -100, 100, 1], ["Vertical", positionY, setPositionY, -100, 100, 1]].map(([label, value, setter, min, max, step]) => (
            <label key={label} className="text-xs font-semibold text-[#6f5d58]">{label}
              <input className="mt-2 w-full accent-[#F38978]" type="range" min={min} max={max} step={step} value={value} disabled={busy} onChange={(event) => setter(Number(event.target.value))} />
            </label>
          ))}
        </div>
        <p className="mt-4 rounded-lg bg-[#2D7C83]/10 px-3 py-2 text-xs text-[#2D7C83]">The saved logo uses a 12:5 transparent frame optimised for payslips, reports and the workspace menu.</p>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" disabled={busy} onClick={onCancel} className="rounded-xl border border-[#e7c9c1] px-4 py-2 text-sm font-semibold disabled:opacity-50">Cancel</button>
          <button type="button" disabled={busy || !source} onClick={() => createCroppedLogo().catch(() => {})} className="inline-flex items-center gap-2 rounded-xl bg-[#F38978] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}{busy ? "Saving logo…" : "Crop and save logo"}
          </button>
        </div>
      </div>
    </div>
  );
}

const payrollSidebarSections = [
  {
    label: "MAIN",
    items: [
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        path: "/dashboard/payroll/admin",
        end: true,
      },
    ],
  },
  {
    label: "ACCESS & GOVERNANCE",
    items: [
      {
        label: "Business Profile",
        icon: Building2,
        path: "/dashboard/payroll/admin/company-profile",
      },
      {
        label: "User Management",
        icon: UserCog,
        path: "/dashboard/payroll/admin/user-management",
      },
      {
        label: "System Audit Trail",
        icon: History,
        path: "/dashboard/payroll/admin/system-audit-trail",
      },
    ],
  },
  {
    label: "PAYROLL CONTROL",
    items: [
      {
        label: "Effective Payroll Rules",
        icon: ClipboardList,
        path: "/dashboard/payroll/admin/effective-rules",
      },
      {
        label: "Payroll Configuration",
        icon: Settings,
        path: "/dashboard/payroll/admin/settings",
      },
      {
        label: "Statutory & Compliance Rules",
        icon: ShieldCheck,
        path: "/dashboard/payroll/admin/compliance-rules",
      },
      {
        label: "Payslip Layouts",
        icon: Palette,
        path: "/dashboard/payroll/admin/payslip-layouts",
      },
    ],
  },
  {
    label: "MONITORING & REPORTING",
    items: [
      {
        label: "Payroll Run Monitor",
        icon: PlayCircle,
        path: "/dashboard/payroll/admin/payroll-monitor",
      },
      {
        label: "Reports",
        icon: FileBarChart,
        path: "/dashboard/payroll/admin/reports",
      },
    ],
  },
];

function CompanyProfileView() {
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [message, setMessage] = useState("");
  const [supportRequests, setSupportRequests] = useState([]);
  const refreshSupport = () =>
    getSupportRequests().then((result) =>
      setSupportRequests(result.requests || []),
    );
  useEffect(() => {
    getCompanyProfile()
      .then((result) => setForm(result.company))
      .catch((error) => setMessage(error.message));
    refreshSupport().catch(() => {});
  }, []);
  if (!form)
    return (
      <PageShell heading="Business Profile">
        <div className="app-panel flex items-center gap-2 rounded-2xl p-6 text-sm text-[#7b6660]">
          <Loader2 size={17} className="animate-spin" />
          Loading company workspace…
        </div>
      </PageShell>
    );
  const fields = [
    ["Workspace name", "name"],
    ["Legal company name", "legalName"],
    ["Registration number", "registrationNumber"],
    ["GST number", "gstNumber"],
    ["Company email", "email"],
    ["Company phone", "phone"],
    ["Address", "address"],
    ["Website", "website"],
    ["Timezone", "timezone"],
    ["Currency", "currency"],
    ["Brand colour", "brandColor"],
  ];
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const { logoUrl: _displayOnlyLogoUrl, ...editableProfile } = form;
      const result = await updateCompanyProfile(editableProfile);
      setForm(result.company);
      setMessage(
        "Business profile saved. Navigation, payslips, reports and emails now use these company details.",
      );
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };
  const uploadLogo = async (file) => {
    if (!file) return;
    setLogoBusy(true);
    setMessage("");
    try {
      const result = await uploadCompanyLogo(file);
      setForm(result.company);
      setLogoFile(null);
      window.dispatchEvent(
        new CustomEvent("paynivo:company-profile-updated", {
          detail: result.company,
        }),
      );
      setMessage(
        "Brand logo uploaded. The workspace menu and newly generated documents now use this logo.",
      );
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLogoBusy(false);
    }
  };
  const review = async (request, action) => {
    try {
      if (action === "revoke") await revokeSupportRequest(request.grant_id);
      else
        await reviewSupportRequest(request.grant_id, {
          action,
          accessMode: "read_only",
          durationMinutes: 60,
        });
      await refreshSupport();
    } catch (error) {
      setMessage(error.message);
    }
  };
  return (
    <PageShell heading="Business Profile">
      <div className="space-y-6">
        <form onSubmit={save} className="app-panel rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F38978]/10 text-[#F38978]">
              <Building2 />
            </span>
            <div>
              <h3 className="font-semibold">Company identity and branding</h3>
              <p className="mt-1 text-sm text-[#7b6660]">
                This is the single business profile used across navigation,
                payslips, reports, invoices and email communication.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-4 rounded-xl border border-[#f0d2ca] bg-[#fff8f5] p-4">
            {form.logoUrl ? (
              <img
                src={form.logoUrl}
                alt={`${form.legalName || form.name} brand logo`}
                className="h-20 w-44 rounded-xl border border-[#f0d2ca] bg-white object-contain p-2"
              />
            ) : (
              <div className="flex h-20 w-44 items-center justify-center rounded-xl border border-dashed border-[#f0d2ca] bg-white text-xs text-[#7b6660]">
                No brand logo
              </div>
            )}
            <div>
              <p className="text-sm font-semibold">Brand logo</p>
              <p className="mt-1 text-xs text-[#7b6660]">
                Used in the workspace menu and generated company documents.
              </p>
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#F38978]/35 bg-white px-3 py-2 text-xs font-semibold text-[#9f4438]">
                {logoBusy ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Upload size={15} />
                )}
                {logoBusy ? "Uploading…" : "Upload PNG or JPG"}
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  disabled={logoBusy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) setLogoFile(file);
                  }}
                />
              </label>
            </div>
          </div>
          <LogoCropModal file={logoFile} busy={logoBusy} onCancel={() => setLogoFile(null)} onSave={uploadLogo} />
          {message ? (
            <p className="mt-5 rounded-xl bg-[#2D7C83]/10 p-3 text-sm text-[#2D7C83]">
              {message}
            </p>
          ) : null}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {fields.map(([label, key]) => (
              <label
                key={key}
                className="text-xs font-semibold uppercase tracking-wide text-[#7b6660]"
              >
                {label}
                <input
                  value={form[key] || ""}
                  onChange={(event) =>
                    setForm({ ...form, [key]: event.target.value })
                  }
                  type={
                    key === "brandColor"
                      ? "color"
                      : key === "email"
                        ? "email"
                        : "text"
                  }
                  className="mt-1 block h-11 w-full rounded-xl border border-[#f0d2ca] bg-white px-3 text-sm normal-case tracking-normal text-[#251E1F] outline-none focus:border-[#F38978]"
                />
              </label>
            ))}
          </div>
          <button
            disabled={busy}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#F38978] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <CheckCircle2 size={17} />
            )}
            Save business profile
          </button>
        </form>
        <section className="app-panel rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-[#2D7C83]" />
            <div>
              <h3 className="font-semibold">PayNivo support access</h3>
              <p className="text-sm text-[#7b6660]">
                Approve temporary access only when requested. Payment, payroll
                approval, exports, files, credentials, and deletion always
                remain blocked.
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {supportRequests.map((request) => (
              <article
                key={request.grant_id}
                className="rounded-xl border border-[#f0d2ca] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <strong className="capitalize">{request.status}</strong>
                    <p className="mt-1 text-sm text-[#7b6660]">
                      {request.requested_reason}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {request.status === "pending" ? (
                      <>
                        <button
                          onClick={() => review(request, "approve")}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
                        >
                          Approve read-only · 1 hour
                        </button>
                        <button
                          onClick={() => review(request, "reject")}
                          className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600"
                        >
                          Reject
                        </button>
                      </>
                    ) : ["approved", "active"].includes(request.status) ? (
                      <button
                        onClick={() => review(request, "revoke")}
                        className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600"
                      >
                        Revoke now
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
            {!supportRequests.length ? (
              <p className="rounded-xl border border-dashed border-[#f0d2ca] p-4 text-sm text-[#7b6660]">
                No support access requests.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </PageShell>
  );
}

const workflowSteps = [
  {
    title: "Review Effective Payroll Rules",
    icon: Settings,
    status: "Configured",
    owner: "Admin",
    updatedKey: "default_pay_cycle",
    details: [
      "Calculation policies",
      "Validation requirements",
      "Effective dates and override sources",
    ],
    action: "View Effective Rules",
    path: "/dashboard/payroll/admin/effective-rules",
  },
  {
    title: "Manage Users & Roles",
    icon: Users,
    status: "Active",
    owner: "Admin",
    updatedKey: "users",
    details: [
      "Admin, HR and Finance access",
      "Payroll module permissions",
      "Active and inactive user accounts",
    ],
    action: "Manage Access",
    path: "/dashboard/payroll/admin/user-management",
  },
  {
    title: "Import Payslip Layout",
    icon: Palette,
    status: "Not Configured",
    owner: "Admin",
    updatedKey: "layouts",
    details: [
      "Upload layout file",
      "Set default template",
      "Preview sample payslip output",
    ],
    action: "Import Design",
    path: "/dashboard/payroll/admin/payslip-layouts",
  },
  {
    title: "Account Activation Oversight",
    icon: ClipboardList,
    status: "Needs Data",
    owner: "Admin / HR",
    updatedKey: "users",
    details: [
      "Account linkage",
      "Activation requests",
      "Role and access status",
    ],
    action: "Manage Accounts",
    path: "/dashboard/payroll/admin/user-management",
  },
  {
    title: "Monitor Payroll Status",
    icon: ShieldCheck,
    status: "View Only",
    owner: "Finance",
    updatedKey: "payrollRuns",
    details: [
      "Finance payroll progress",
      "Generated payslip status",
      "System exception visibility",
    ],
    action: "Open Monitor",
    path: "/dashboard/payroll/admin/payroll-monitor",
  },
  {
    title: "System Audit Trail",
    icon: History,
    status: "Tracking",
    owner: "System",
    updatedKey: "auditLogs",
    details: ["Admin changes", "Template updates", "System access records"],
    action: "View Logs",
    path: "/dashboard/payroll/admin/system-audit-trail",
  },
];

const cpfAccountMappings = [
  {
    key: "cpf_account_employee_payable",
    label: "Employee CPF Payable Account",
    description: "Liability account for employee CPF payable.",
    placeholder: "2100 - CPF Payable (Employee)",
    usage: "Operational reference only",
  },
  {
    key: "cpf_account_employer_payable",
    label: "Employer CPF Payable Account",
    description: "Liability account for employer CPF payable.",
    placeholder: "2110 - CPF Payable (Employer)",
    usage: "Operational reference only",
  },
  {
    key: "cpf_account_employer_expense",
    label: "Employer CPF Expense Account",
    description: "Expense account for employer CPF cost.",
    placeholder: "5200 - CPF Expense",
    usage: "Operational reference only",
  },
];

const otherCpfSettings = [
  {
    key: "cpf_payment_due_day",
    label: "CPF Contribution Payment Deadline",
    description: "CPF payment due day, for example 14th of next month.",
    placeholder: "14th of next month",
    usage: "Operational reference only",
  },
  {
    key: "cpf_payment_method",
    label: "CPF Contribution Payment Method",
    description: "CPF payment method used by Finance.",
    placeholder: "GIRO / PayNow",
    usage: "Operational reference only",
  },
  {
    key: "cpf_notification_enabled",
    label: "CPF Deadline Reminders",
    description: "Enable reminders for CPF payment and submission.",
    placeholder: "Enabled",
    usage: "Operational reference only",
  },
  {
    key: "cpf_submission_tracking",
    label: "CPF Submission Status Tracking",
    description: "Track CPF submission files and statuses.",
    placeholder: "Enabled",
    usage: "Operational reference only",
  },
];

const mbmfDefaultSettings = {
  enabled: "Enabled",
  effectiveFrom: "2016-06-01",
  rateType: "Fixed amount by monthly wage band",
  bands: [
    [1000, 3],
    [2000, 4.5],
    [3000, 6.5],
    [4000, 15],
    [6000, 19.5],
    [8000, 22],
    [10000, 24],
    [null, 26],
  ],
  employeePayableAccount: "2110 - MBMF Payable (Employee)",
  clearingAccount: "2140 - MBMF Payable Clearing",
  paymentBankAccount: "1210 - Bank - MBMF",
  applicableReligion: "Muslim",
};

const selfHelpGroupConfigs = [
  {
    key: "mbmf",
    label: "MBMF",
    eligibilityField: "religion",
    eligibilityValue: "Muslim",
    description:
      "Mosque Building and Mendaki Fund contribution for Muslim employees.",
  },
  {
    key: "cdac",
    label: "CDAC",
    eligibilityField: "race",
    eligibilityValue: "Chinese",
    description:
      "Chinese Development Assistance Council contribution for Chinese employees.",
  },
  {
    key: "sinda",
    label: "SINDA",
    eligibilityField: "race",
    eligibilityValue: "Indian",
    description:
      "Singapore Indian Development Association contribution for Indian employees.",
  },
  {
    key: "ecf",
    label: "ECF",
    eligibilityField: "race",
    eligibilityValue: "Eurasian",
    description: "Eurasian Community Fund contribution for Eurasian employees.",
  },
];

const statutorySchemeSettings = [
  {
    key: "sdl_enabled",
    label: "SDL Enabled",
    description:
      "Enable Skills Development Levy tracking for employees working in Singapore.",
    placeholder: "Enabled",
  },
  {
    key: "sdl_rate_rule",
    label: "SDL Rate Rule",
    description: "SDL is employer-side and based on monthly remuneration.",
    placeholder: "0.25%, minimum SGD 2, maximum SGD 11.25",
  },
  {
    key: "foreign_worker_levy_enabled",
    label: "Foreign Worker Levy Enabled",
    description:
      "Track employer-side levy for Work Permit and S Pass holders where applicable.",
    placeholder: "Enabled",
  },
  {
    key: "foreign_worker_levy_basis",
    label: "Foreign Worker Levy Basis",
    description: "MOM levy depends on sector, quota, skill tier and pass type.",
    placeholder: "MOM sector/quota/pass type",
  },
  {
    key: "iras_ais_enabled",
    label: "IRAS AIS Enabled",
    description: "Enable annual employment income reporting preparation.",
    placeholder: "Enabled",
  },
  {
    key: "iras_ais_reporting_year",
    label: "IRAS AIS Reporting Year",
    description:
      "Year of Assessment or reporting cycle used for payroll reports.",
    placeholder: "YA2027",
  },
  {
    key: "ir21_tax_clearance_tracking",
    label: "IR21 Tax Clearance",
    description:
      "Track tax clearance requirement for foreign employees leaving employment or Singapore.",
    placeholder: "Review required for foreign employees",
  },
];

function ActionButton({
  icon: Icon,
  children,
  variant = "primary",
  onClick,
  disabled = false,
}) {
  const className =
    variant === "secondary"
      ? "inline-flex items-center justify-center gap-2 rounded-xl border border-[#f0d2ca] bg-white/80 px-4 py-2.5 text-sm font-semibold text-[#251E1F] transition hover:bg-[#FDD9CD]/45"
      : "primary-button inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold";

  return (
    <button
      type="button"
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon size={17} />
      {children}
    </button>
  );
}

function AdminActionProgress({ state, onClose }) {
  const [progress, setProgress] = useState(5);
  useEffect(() => {
    if (!state?.open) return undefined;
    if (state.status !== "running") {
      setProgress(100);
      return undefined;
    }
    setProgress(5);
    const timer = window.setInterval(
      () =>
        setProgress((value) =>
          Math.min(90, value + Math.max(1, Math.ceil((90 - value) / 7))),
        ),
      180,
    );
    return () => window.clearInterval(timer);
  }, [state?.open, state?.status, state?.title]);
  if (!state?.open) return null;
  return (
    <div className="fixed inset-0 z-[1200] grid place-items-center bg-[#251E1F]/45 p-4">
      <section
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-center gap-3">
          {state.status === "running" ? (
            <Loader2 className="animate-spin text-[#F38978]" />
          ) : state.status === "failed" ? (
            <AlertCircle className="text-red-600" />
          ) : (
            <CheckCircle2 className="text-emerald-600" />
          )}
          <div>
            <h3 className="font-semibold text-[#251E1F]">{state.title}</h3>
            <p className="text-sm text-[#7b6660]">{state.phase}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-between text-xs font-semibold">
          <span>
            {state.status === "running"
              ? "Processing"
              : state.status === "failed"
                ? "Failed"
                : "Completed"}
          </span>
          <span>{progress}%</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#f0d2ca]">
          <div
            className={`h-full rounded-full transition-all duration-500 motion-reduce:transition-none ${state.status === "failed" ? "bg-red-500" : state.status === "completed" ? "bg-emerald-500" : "bg-[#F38978]"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        {state.detail ? (
          <p
            className={`mt-4 rounded-xl p-3 text-sm ${state.status === "failed" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}
          >
            {state.detail}
          </p>
        ) : null}
        {state.status !== "running" ? (
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#f0d2ca] px-4 py-2 text-sm font-semibold"
            >
              Close
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "Not available";

  return new Intl.DateTimeFormat("en-SG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
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
    year: "numeric",
  }).format(new Date(value));
}

function formatPayrollPeriod(run) {
  if (!run?.payroll_month || !run?.payroll_year) return "No period";

  return new Intl.DateTimeFormat("en-SG", {
    month: "long",
    year: "numeric",
  }).format(new Date(run.payroll_year, run.payroll_month - 1, 1));
}

function formatMoney(value) {
  if (value === null || value === undefined) return "Not linked";

  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
  }).format(Number(value));
}

function EmptyState({ message }) {
  return (
    <div className="rounded-xl border border-dashed border-[#f0d2ca] bg-white/80 p-6 text-sm text-[#7b6660]">
      {message}
    </div>
  );
}

function PageShell({ heading, children, actions, updatedAt }) {
  return (
    <section className="admin-payroll-page">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#F38978]/80">
            Admin Payroll Workflow
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-[#251E1F]">
            {heading}
          </h2>
          <p className="mt-2 flex items-center gap-2 text-sm text-[#7b6660]">
            <CalendarDays size={15} className="text-[#F38978]" />
            Last updated:{" "}
            {updatedAt ? formatDateTime(updatedAt) : "Not updated"}
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
      lastUpdated: getLatestTimestamp(data?.users),
    };
  }

  if (step.updatedKey === "layouts") {
    const defaultLayout = data?.layouts?.find(
      (layout) => Number(layout.is_default) === 1,
    );

    return {
      count: `${data?.layouts?.length || 0} layout(s)`,
      lastUpdated: getLatestTimestamp(data?.layouts),
      status: defaultLayout ? "Default Set" : step.status,
    };
  }

  if (step.updatedKey === "payrollRuns") {
    return {
      count: `${data?.payrollRuns?.length || 0} run(s)`,
      lastUpdated: getLatestTimestamp(data?.payrollRuns),
    };
  }

  if (step.updatedKey === "auditLogs") {
    return {
      count: `${data?.auditLogs?.length || 0} event(s)`,
      lastUpdated: getLatestTimestamp(data?.auditLogs),
    };
  }

  const setting = data?.settings?.find(
    (item) => item.setting_key === step.updatedKey,
  );

  return {
    count: setting ? "Settings saved" : "No saved value",
    lastUpdated: setting?.updated_at,
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
      label: "Effective Rule Groups",
      records: `${source.stats?.payrollRules || 0} group(s)`,
      updatedAt:
        source.rulePublication?.publishedAt ||
        getLatestTimestamp(source.settings),
    },
    {
      label: "Users & Roles",
      records: `${source.users?.length || 0} user(s)`,
      updatedAt: getLatestTimestamp(source.users),
    },
    {
      label: "Payroll Monitor",
      records: `${source.payrollRuns?.length || 0} run(s)`,
      updatedAt: getLatestTimestamp(source.payrollRuns),
    },
    {
      label: "Payslip Layouts",
      records: `${source.layouts?.length || 0} layout(s)`,
      updatedAt: getLatestTimestamp(source.layouts),
    },
    {
      label: "System Audit Trail",
      records: `${source.auditLogs?.length || 0} event(s)`,
      updatedAt: getLatestTimestamp(source.auditLogs),
    },
  ].sort((a, b) => {
    if (!a.updatedAt) return 1;
    if (!b.updatedAt) return -1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
}

function getOverallUpdatedAt(data = {}) {
  const source = data || {};

  return getLatestTimestamp([
    ...(source.settings || []),
    ...(source.users || []),
    ...(source.payrollRuns || []),
    ...(source.layouts || []),
    ...(source.auditLogs || []),
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
      title:
        value.title ||
        setting.setting_key
          .replace(/^custom_compliance_rule_/, "")
          .replaceAll("_", " "),
      updatedAt: setting.updated_at,
      updatedByName: setting.updated_by_name,
      settingKey: setting.setting_key,
    };
  } catch {
    return {
      category: "Payroll Compliance",
      effectiveFrom: "",
      ruleText: setting.setting_value || "",
      source: "",
      status: "Active",
      title: setting.setting_key
        .replace(/^custom_compliance_rule_/, "")
        .replaceAll("_", " "),
      updatedAt: setting.updated_at,
      updatedByName: setting.updated_by_name,
      settingKey: setting.setting_key,
    };
  }
}

function getStatusBadgeClass(status) {
  const normalizedStatus = status.toLowerCase();

  if (
    ["active", "configured", "default set", "tracking"].includes(
      normalizedStatus,
    )
  ) {
    return "border-[#2f8758]/25 bg-[#2f8758]/10 text-[#2f8758]";
  }

  if (["not configured", "needs data"].includes(normalizedStatus)) {
    return "border-[#D97706]/25 bg-[#D97706]/10 text-[#9A6412]";
  }

  if (normalizedStatus === "view only") {
    return "border-[#2D7C83]/25 bg-[#2D7C83]/10 text-[#2D7C83]";
  }

  return "border-[#f0d2ca] bg-white/80 text-[#7b6660]";
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
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(status)}`}
        >
          {status}
        </span>
      </div>
      <h3 className="mt-5 text-base font-semibold text-[#251E1F]">
        {step.title}
      </h3>
      <div className="mt-3 grid gap-2 rounded-xl border border-[#f0d2ca] bg-white/80 p-3 text-xs text-[#7b6660]">
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
          <span className="font-semibold text-[#251E1F]">
            {meta.lastUpdated
              ? formatDateTime(meta.lastUpdated)
              : "Not updated"}
          </span>
        </div>
      </div>
      <ul className="mt-3 space-y-2 text-sm text-[#7b6660]">
        {step.details.map((detail) => (
          <li key={detail} className="flex gap-2">
            <CheckCircle2
              size={16}
              className="mt-0.5 shrink-0 text-[#F38978]"
            />
            <span>{detail}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="mt-5 w-full rounded-xl border border-[#F38978]/25 bg-[#F38978]/10 px-4 py-2.5 text-sm font-semibold text-[#251E1F] transition hover:bg-[#F38978]/20"
        onClick={() => onNavigate(step.path)}
      >
        {step.action}
      </button>
    </article>
  );
}

const adminInsightDatasets = {
  audit_activity: {
    label: "Audit Activity",
    description: "Administrative events over time.",
    chartType: "Line trend",
    unit: "events",
  },
  user_roles: {
    label: "Users by Role",
    description: "Current account distribution across payroll roles.",
    chartType: "Horizontal bars",
    unit: "users",
  },
  account_status: {
    label: "Account Status",
    description: "Current activation and access state.",
    chartType: "Donut",
    unit: "records",
  },
  run_health: {
    label: "Payroll Run Health",
    description: "Operational outcomes by payroll period.",
    chartType: "Stacked columns",
    unit: "runs",
  },
};

const insightPresetDays = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "6m": 183,
  "12m": 365,
  "3m": 92,
};

function insightDateRange(preset, dataset = "audit_activity") {
  const to = new Date();
  if (dataset === "run_health") {
    const months = { "3m": 3, "6m": 6, "12m": 12 }[preset] || 6;
    const from = new Date(to.getFullYear(), to.getMonth() - (months - 1), 1);
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    };
  }
  const from = new Date(to);
  from.setDate(from.getDate() - ((insightPresetDays[preset] || 30) - 1));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function insightLabel(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return value;
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-SG", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

function DashboardView({ data, onNavigate }) {
  const stats = data?.stats || {};
  const dashboardUpdates = getDashboardUpdateSegments(data);
  const now = new Date();
  const countRecent = (items, days) =>
    items.filter((item) => {
      const timestamp = item?.updated_at || item?.created_at;
      return timestamp && now - new Date(timestamp) <= days * 86400000;
    }).length;
  const dashboardStats = [
    {
      label: "Active Users",
      value: stats.activeUsers ?? 0,
      icon: Users,
      iconClass: "dashboard-icon--rose",
      note: `${countRecent(data?.users || [], 30)} updated this month`,
    },
    {
      label: "Effective Rule Groups",
      value: stats.payrollRules ?? 0,
      icon: Settings,
      iconClass: "dashboard-icon--orange",
      note: "Calculation and validation policies",
      onClick: () => onNavigate("/dashboard/payroll/admin/effective-rules"),
    },
    {
      label: "Payslip Layouts",
      value: stats.payslipLayouts ?? data?.layouts?.length ?? 0,
      icon: Palette,
      iconClass: "dashboard-icon--green",
      note: data?.layouts?.some((item) => Number(item.is_default) === 1)
        ? "Default layout configured"
        : "Default layout required",
    },
    {
      label: "Admin Logs",
      value: stats.adminLogs ?? 0,
      icon: History,
      iconClass: "dashboard-icon--blue",
      note: `${countRecent(data?.auditLogs || [], 7)} events this week`,
    },
  ];
  const quickActions = [
    {
      title: "Payroll Configuration",
      description: "Review accounting references and CPF operational controls.",
      action: "Open Configuration",
      updatedAt: getLatestTimestamp(data?.settings),
      icon: Settings,
      iconClass: "dashboard-icon--blue",
      onClick: () => onNavigate("/dashboard/payroll/admin/settings"),
    },
    {
      title: "Effective Payroll Rules",
      description: "See the resolved policies currently used by payroll.",
      action: "View Effective Rules",
      updatedAt: getLatestTimestamp(data?.settings),
      icon: ClipboardList,
      iconClass: "dashboard-icon--indigo",
      onClick: () => onNavigate("/dashboard/payroll/admin/effective-rules"),
    },
    {
      title: "Manage Users & Roles",
      description: "Control access and permissions for users.",
      action: "Manage Access",
      updatedAt: getLatestTimestamp(data?.users),
      icon: Users,
      iconClass: "dashboard-icon--orange",
      onClick: () => onNavigate("/dashboard/payroll/admin/user-management"),
    },
    {
      title: "Payslip Management",
      description: "Import, preview and set the default payslip layout.",
      action: "Manage Payslips",
      updatedAt: getLatestTimestamp(data?.layouts),
      icon: Palette,
      iconClass: "dashboard-icon--rose",
      onClick: () => onNavigate("/dashboard/payroll/admin/payslip-layouts"),
    },
    {
      title: "Payroll Run Monitor",
      description:
        "Review run health, workflow ownership and processing delays.",
      action: "View Monitor",
      updatedAt: getLatestTimestamp(data?.payrollRuns),
      icon: ShieldCheck,
      iconClass: "dashboard-icon--teal",
      onClick: () => onNavigate("/dashboard/payroll/admin/payroll-monitor"),
    },
    {
      title: "System Audit Trail",
      description:
        "Inspect technical events, actors, outcomes and value changes.",
      action: "View Audit Trail",
      updatedAt: getLatestTimestamp(data?.auditLogs),
      icon: History,
      iconClass: "dashboard-icon--blue",
      onClick: () => onNavigate("/dashboard/payroll/admin/system-audit-trail"),
    },
    {
      title: "Admin Reports",
      description: "Generate governance, access, rules and workflow reports.",
      action: "View Reports",
      updatedAt: getOverallUpdatedAt(data),
      icon: FileBarChart,
      iconClass: "dashboard-icon--amber",
      onClick: () => onNavigate("/dashboard/payroll/admin/reports"),
    },
  ];

  return (
    <PageShell
      heading="Dashboard"
      updatedAt={getOverallUpdatedAt(data)}
      actions={
        <ActionButton
          icon={Eye}
          onClick={() => onNavigate("/dashboard/payroll/admin/effective-rules")}
        >
          View Effective Rules
        </ActionButton>
      }
    >
      <div className="admin-payroll-dashboard">
        <section
          aria-label="Payroll administration summary"
          className="dashboard-kpi-grid"
        >
          {dashboardStats.map((stat) => {
            const Card = stat.onClick ? "button" : "article";
            return (
              <Card
                type={stat.onClick ? "button" : undefined}
                onClick={stat.onClick}
                key={stat.label}
                className={`dashboard-card dashboard-kpi-card ${stat.onClick ? "dashboard-kpi-card--interactive" : ""}`}
              >
                <div className={`dashboard-icon ${stat.iconClass}`}>
                  <stat.icon aria-hidden="true" size={21} />
                </div>
                <div>
                  <p className="dashboard-label">{stat.label}</p>
                  <p className="dashboard-kpi-value">{stat.value}</p>
                  <p className="dashboard-note">{stat.note}</p>
                </div>
              </Card>
            );
          })}
        </section>

        <div className="dashboard-overview-grid">
          <section
            className="dashboard-card dashboard-timeline-card"
            aria-labelledby="payroll-update-timeline"
          >
            <div className="dashboard-section-heading">
              <div>
                <h3 id="payroll-update-timeline">Overall Update Timeline</h3>
                <p>Latest changes across payroll administration.</p>
              </div>
              <time>
                {formatDate(
                  getLatestTimestamp(
                    dashboardUpdates.map((item) => ({
                      updated_at: item.updatedAt,
                    })),
                  ),
                )}
              </time>
            </div>
            <ol className="dashboard-timeline">
              {dashboardUpdates.map((item) => (
                <li key={item.label}>
                  <span className="dashboard-timeline-dot" aria-hidden="true" />
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.records}</span>
                    <time>
                      {item.updatedAt
                        ? formatDateTime(item.updatedAt)
                        : "Not updated"}
                    </time>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section
            className="dashboard-card dashboard-overview-card"
            aria-labelledby="payroll-overview-heading"
          >
            <AdminInsightsPanel />
          </section>
        </div>

        <section
          className="dashboard-card dashboard-quick-actions"
          aria-labelledby="payroll-quick-actions"
        >
          <div className="dashboard-section-heading">
            <div>
              <h3 id="payroll-quick-actions">Quick Actions</h3>
              <p>Frequently used payroll administration tools.</p>
            </div>
          </div>
          <div className="dashboard-action-grid">
            {quickActions.map((item) => (
              <article key={item.title} className="dashboard-action-card">
                <div className="dashboard-action-title">
                  <span className={`dashboard-icon ${item.iconClass}`}>
                    <item.icon aria-hidden="true" size={18} />
                  </span>
                  <div>
                    <h4>{item.title}</h4>
                    <p>{item.description}</p>
                    <time>
                      Last updated:{" "}
                      {item.updatedAt
                        ? formatDateTime(item.updatedAt)
                        : "Not updated"}
                    </time>
                  </div>
                </div>
                <button type="button" onClick={item.onClick}>
                  {item.action}
                  <span aria-hidden="true">→</span>
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}

function AdminInsightsPanel() {
  const initialAudit = insightDateRange("30d");
  const initialRuns = insightDateRange("6m", "run_health");
  const [selectedDataset, setSelectedDataset] = useState("audit_activity");
  const [filters, setFilters] = useState({
    audit_activity: { preset: "30d", ...initialAudit },
    run_health: { preset: "6m", ...initialRuns },
    user_roles: { accountStatus: "all" },
    account_status: { role: "all" },
  });
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const activeFilters = filters[selectedDataset];
  const definition = adminInsightDatasets[selectedDataset];

  useEffect(() => {
    let active = true;
    setLoading(true);
    getAdminPayrollInsights({
      dataset: selectedDataset,
      ...activeFilters,
      preset: undefined,
    })
      .then((result) => {
        if (active) {
          setInsight(result);
          setError("");
        }
      })
      .catch((loadError) => {
        if (active)
          setError(loadError.message || "Unable to load dashboard insight.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedDataset, activeFilters]);

  const updateFilter = (values) =>
    setFilters((current) => ({
      ...current,
      [selectedDataset]: { ...current[selectedDataset], ...values },
    }));
  const selectPreset = (preset) =>
    updateFilter({ preset, ...insightDateRange(preset, selectedDataset) });
  const isTrend = ["audit_activity", "run_health"].includes(selectedDataset);
  const presets =
    selectedDataset === "audit_activity"
      ? ["7d", "30d", "90d", "6m", "12m", "custom"]
      : ["3m", "6m", "12m", "custom"];

  return (
    <div className="admin-insights" aria-labelledby="payroll-overview-heading">
      <div className="dashboard-section-heading">
        <div>
          <h3 id="payroll-overview-heading">Admin Insights</h3>
          <p>{definition.description}</p>
        </div>
        <label className="dashboard-dataset-control">
          <span>Data set</span>
          <select
            value={selectedDataset}
            onChange={(event) => setSelectedDataset(event.target.value)}
          >
            {Object.entries(adminInsightDatasets).map(([key, dataset]) => (
              <option key={key} value={key}>
                {dataset.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="admin-insights__filters">
        {isTrend ? (
          <>
            <div className="admin-insights__presets" aria-label="Date range">
              {presets.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  className={
                    activeFilters.preset === preset
                      ? "admin-insights__preset--active"
                      : ""
                  }
                  onClick={() =>
                    preset === "custom"
                      ? updateFilter({ preset })
                      : selectPreset(preset)
                  }
                >
                  {preset === "custom" ? "Custom" : preset.toUpperCase()}
                </button>
              ))}
            </div>
            {activeFilters.preset === "custom" ? (
              <div className="admin-insights__dates">
                <label>
                  From
                  <input
                    type="date"
                    value={activeFilters.from}
                    max={activeFilters.to}
                    onChange={(event) =>
                      updateFilter({ from: event.target.value })
                    }
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    value={activeFilters.to}
                    min={activeFilters.from}
                    onChange={(event) =>
                      updateFilter({ to: event.target.value })
                    }
                  />
                </label>
              </div>
            ) : null}
          </>
        ) : null}
        {selectedDataset === "user_roles" ? (
          <label className="admin-insights__snapshot-filter">
            Account status
            <select
              value={activeFilters.accountStatus}
              onChange={(event) =>
                updateFilter({ accountStatus: event.target.value })
              }
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
        ) : null}
        {selectedDataset === "account_status" ? (
          <label className="admin-insights__snapshot-filter">
            Payroll role
            <select
              value={activeFilters.role}
              onChange={(event) => updateFilter({ role: event.target.value })}
            >
              <option value="all">All roles</option>
              <option>Admin</option>
              <option>Finance</option>
              <option>HR</option>
              <option>Staff</option>
            </select>
          </label>
        ) : null}
        <p className="admin-insights__asof">
          {insight?.filters?.granularity
            ? `${insight.filters.granularity} aggregation`
            : `As of ${formatDateTime(insight?.asOf)}`}
        </p>
      </div>
      {loading ? (
        <div className="admin-insights__state">
          <Loader2 className="animate-spin" size={18} />
          Loading insight...
        </div>
      ) : error ? (
        <div className="admin-insights__state admin-insights__state--error">
          <AlertCircle size={18} />
          {error}
        </div>
      ) : (
        <AdminInsightChart insight={insight} definition={definition} />
      )}
    </div>
  );
}

function AdminInsightChart({ insight, definition }) {
  const hasData = insight?.series?.some((series) =>
    series.data?.some((point) => Number(point.value) > 0),
  );
  if (!hasData)
    return (
      <div className="admin-insights__state">
        <FileBarChart size={20} />
        No {definition.label.toLowerCase()} data matches these filters.
      </div>
    );
  const chart =
    insight.chartType === "line" ? (
      <InsightLineChart insight={insight} />
    ) : insight.chartType === "horizontal_bar" ? (
      <InsightBarChart insight={insight} />
    ) : insight.chartType === "donut" ? (
      <InsightDonutChart insight={insight} />
    ) : (
      <InsightStackedChart insight={insight} />
    );
  return (
    <figure className="dashboard-chart admin-insights__chart">
      <figcaption>
        <span>{definition.label}</span>
        <small>{definition.chartType}</small>
      </figcaption>
      {chart}
      <InsightLegend series={insight.series} />
      <InsightDataTable insight={insight} />
    </figure>
  );
}

function InsightLineChart({ insight }) {
  const points = insight.series[0].data;
  const width = 720,
    height = 250,
    left = 44,
    right = 18,
    top = 22,
    bottom = 42;
  const maxValue = Math.max(1, ...points.map((point) => point.value));
  const ceiling = Math.max(10, Math.ceil(maxValue / 10) * 10);
  const x = (index) =>
    left + index * ((width - left - right) / Math.max(1, points.length - 1));
  const y = (value) => top + (height - top - bottom) * (1 - value / ceiling);
  const line = points
    .map((point, index) => `${index ? "L" : "M"}${x(index)},${y(point.value)}`)
    .join(" ");
  const area = `${line} L${x(points.length - 1)},${height - bottom} L${x(0)},${height - bottom} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) =>
    Math.round(ceiling * ratio),
  );
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Audit events trend"
    >
      <desc>
        {points
          .map((point) => `${insightLabel(point.x)}: ${point.value} events`)
          .join(", ")}
      </desc>
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            className="dashboard-chart-gridline"
            x1={left}
            x2={width - right}
            y1={y(tick)}
            y2={y(tick)}
          />
          <text x={left - 10} y={y(tick) + 4} textAnchor="end">
            {tick}
          </text>
        </g>
      ))}
      <path className="dashboard-chart-area" d={area} />
      <path className="dashboard-chart-line" d={line} />
      {points.map((point, index) => (
        <g
          key={point.x}
          tabIndex="0"
          role="img"
          aria-label={`${insightLabel(point.x)}: ${point.value} events`}
        >
          <circle
            className="dashboard-chart-point"
            cx={x(index)}
            cy={y(point.value)}
            r="5"
          >
            <title>{point.value} events</title>
          </circle>
          {index % labelEvery === 0 || index === points.length - 1 ? (
            <text x={x(index)} y={height - 15} textAnchor="middle">
              {insightLabel(point.x)}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}

export function InsightBarChart({ insight }) {
  const points = insight.series[0].data;
  const max = Math.max(1, ...points.map((point) => point.value));
  return (
    <div
      className="admin-role-bars"
      role="img"
      aria-label="Users by payroll role"
    >
      {points.map((point) => (
        <div
          key={point.x}
          className="admin-role-bars__row"
          tabIndex="0"
          role="img"
          aria-label={`${point.x}: ${point.value} users`}
        >
          <div className="admin-role-bars__heading">
            <span>{point.x}</span>
            <strong>{point.value}</strong>
          </div>
          <div className="admin-role-bars__track">
            <i
              style={{
                width: `${point.value ? Math.max(5, (point.value / max) * 100) : 0}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function InsightDonutChart({ insight }) {
  const points = insight.series[0].data;
  const total = points.reduce((sum, point) => sum + point.value, 0);
  const radius = 72,
    circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <svg
      className="admin-insights__donut"
      viewBox="0 0 360 220"
      role="img"
      aria-label="Account status distribution"
    >
      <g transform="rotate(-90 180 110)">
        <circle
          className="admin-insights__donut-track"
          cx="180"
          cy="110"
          r={radius}
        />
        {points.map((point) => {
          const length = total ? (point.value / total) * circumference : 0;
          const currentOffset = offset;
          offset += length;
          return (
            <circle
              key={point.x}
              tabIndex="0"
              role="img"
              aria-label={`${point.x}: ${point.value}`}
              cx="180"
              cy="110"
              r={radius}
              fill="none"
              stroke={point.color}
              strokeWidth="30"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-currentOffset}
            >
              <title>
                {point.x}: {point.value}
              </title>
            </circle>
          );
        })}
      </g>
      <text
        className="admin-insights__donut-total"
        x="180"
        y="105"
        textAnchor="middle"
      >
        {total}
      </text>
      <text x="180" y="127" textAnchor="middle">
        records
      </text>
    </svg>
  );
}

function InsightStackedChart({ insight }) {
  const labels = insight.series[0]?.data?.map((point) => point.x) || [];
  const width = 720,
    height = 260,
    left = 44,
    right = 18,
    top = 20,
    bottom = 48;
  const totals = labels.map((_, index) =>
    insight.series.reduce(
      (sum, series) => sum + Number(series.data[index]?.value || 0),
      0,
    ),
  );
  const max = Math.max(1, ...totals);
  const plotHeight = height - top - bottom;
  const columnWidth = Math.min(
    62,
    ((width - left - right) / Math.max(1, labels.length)) * 0.62,
  );
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Payroll run health by period"
    >
      {labels.map((label, index) => {
        const x =
          left +
          (index + 0.5) * ((width - left - right) / labels.length) -
          columnWidth / 2;
        let baseY = height - bottom;
        return (
          <g key={label}>
            <text x={x + columnWidth / 2} y={height - 18} textAnchor="middle">
              {insightLabel(label)}
            </text>
            {insight.series.map((series) => {
              const value = Number(series.data[index]?.value || 0);
              const segmentHeight = (value / max) * plotHeight;
              baseY -= segmentHeight;
              return (
                <rect
                  key={series.key}
                  tabIndex="0"
                  role="img"
                  aria-label={`${insightLabel(label)}, ${series.label}: ${value}`}
                  x={x}
                  y={baseY}
                  width={columnWidth}
                  height={segmentHeight}
                  fill={series.color}
                >
                  <title>
                    {series.label}: {value}
                  </title>
                </rect>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

function InsightLegend({ series }) {
  const items = series.flatMap((item) =>
    item.data?.some((point) => point.color)
      ? item.data.map((point) => ({
          key: `${item.key}-${point.x}`,
          label: point.x,
          color: point.color,
        }))
      : [item],
  );
  return (
    <div className="admin-insights__legend">
      {items.map((item) => (
        <span key={item.key}>
          <i style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function InsightDataTable({ insight }) {
  const labels = [
    ...new Set(
      insight.series.flatMap((series) => series.data.map((point) => point.x)),
    ),
  ];
  return (
    <details className="admin-insights__data">
      <summary>View chart data</summary>
      <div>
        <table>
          <thead>
            <tr>
              <th>Label</th>
              {insight.series.map((series) => (
                <th key={series.key}>{series.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((label) => (
              <tr key={label}>
                <td>{insightLabel(label)}</td>
                {insight.series.map((series) => (
                  <td key={series.key}>
                    {series.data.find((point) => point.x === label)?.value || 0}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function EffectivePayrollRulesView({ onNavigate }) {
  const [catalogue, setCatalogue] = useState({ categories: [], rules: [] });
  const [category, setCategory] = useState("All categories");
  const [usage, setUsage] = useState("All usage types");
  const [status, setStatus] = useState("All statuses");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    getEffectivePayrollRules()
      .then(setCatalogue)
      .catch((loadError) =>
        setError(
          loadError.message || "Unable to load effective payroll rules.",
        ),
      )
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  const rules = (catalogue.rules || []).filter(
    (rule) =>
      (category === "All categories" || rule.category === category) &&
      (usage === "All usage types" || rule.usage === usage) &&
      (status === "All statuses" || rule.status === status),
  );
  const overrides = (catalogue.rules || []).filter(
    (rule) => rule.source === "Admin Override",
  ).length;
  const usageLabel = (value) =>
    value === "calculation"
      ? "Applied to calculations"
      : value === "validation"
        ? "Used for validation"
        : "Operational reference";
  const usageClass = (value) =>
    ({
      calculation: "effective-rules__usage--calculation",
      validation: "effective-rules__usage--validation",
      reference: "effective-rules__usage--reference",
    })[value] || "effective-rules__usage--reference";

  return (
    <PageShell
      heading="Effective Payroll Rules"
      updatedAt={catalogue.asOf}
      actions={
        <>
          <ActionButton
            icon={Settings}
            onClick={() => onNavigate("/dashboard/payroll/admin/settings")}
          >
            Payroll Configuration
          </ActionButton>
          <ActionButton
            icon={ShieldCheck}
            variant="secondary"
            onClick={() =>
              onNavigate("/dashboard/payroll/admin/compliance-rules")
            }
          >
            Statutory & Compliance Rules
          </ActionButton>
        </>
      }
    >
      <div className="effective-rules">
        <div className="effective-rules__intro">
          <ShieldCheck size={20} />
          <div>
            <strong>Resolved rules used by payroll</strong>
            <p>
              This is a read-only view of calculation and validation policies
              after system defaults and Admin overrides are combined.
            </p>
          </div>
        </div>
        <section
          className="effective-rules__metrics"
          aria-label="Effective payroll rules summary"
        >
          {[
            {
              label: "Rule Groups",
              value: catalogue.groupCount || 0,
              className: "effective-rules__metric--purple",
            },
            {
              label: "Active Groups",
              value: catalogue.activeGroupCount || 0,
              className: "effective-rules__metric--green",
            },
            {
              label: "Admin Overrides",
              value: overrides,
              className: "effective-rules__metric--blue",
            },
            {
              label: "Categories",
              value: catalogue.categories?.length || 0,
              className: "effective-rules__metric--amber",
            },
          ].map((item) => (
            <article
              key={item.label}
              className={`effective-rules__metric ${item.className}`}
            >
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </section>
        <div className="effective-rules__filters">
          <label>
            <span>Category</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option>All categories</option>
              {(catalogue.categories || []).map((item) => (
                <option key={item.category}>{item.category}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Usage</span>
            <select
              value={usage}
              onChange={(event) => setUsage(event.target.value)}
            >
              <option>All usage types</option>
              <option value="calculation">Applied to calculations</option>
              <option value="validation">Used for validation</option>
            </select>
          </label>
          <label>
            <span>Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option>All statuses</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </label>
          <button type="button" onClick={load}>
            <History size={15} />
            Refresh
          </button>
        </div>
        {error ? (
          <div className="effective-rules__state effective-rules__state--error">
            <AlertCircle size={18} />
            {error}
          </div>
        ) : loading ? (
          <div className="effective-rules__state">
            <Loader2 className="animate-spin" size={18} />
            Loading effective rules...
          </div>
        ) : (
          <div className="effective-rules__table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rule</th>
                  <th>Current Value</th>
                  <th>Usage</th>
                  <th>Source</th>
                  <th>Effective From</th>
                  <th>Status</th>
                  <th>Last Update</th>
                  <th>Configuration</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.key}>
                    <td>
                      <strong>{rule.name}</strong>
                      <small>{rule.category}</small>
                      {rule.details?.length ? (
                        <details>
                          <summary>View {rule.details.length} values</summary>
                          <dl>
                            {rule.details.map((detail) => (
                              <div key={detail.label}>
                                <dt>{detail.label}</dt>
                                <dd>{detail.value}</dd>
                              </div>
                            ))}
                          </dl>
                        </details>
                      ) : null}
                    </td>
                    <td>
                      <strong>{rule.value}</strong>
                    </td>
                    <td>
                      <span
                        className={`effective-rules__usage ${usageClass(rule.usage)}`}
                      >
                        {usageLabel(rule.usage)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={
                          rule.source === "Admin Override"
                            ? "effective-rules__source--override"
                            : "effective-rules__source--default"
                        }
                      >
                        {rule.source}
                      </span>
                    </td>
                    <td>{formatDate(rule.effectiveFrom)}</td>
                    <td>
                      <span
                        className={
                          rule.isActive
                            ? "effective-rules__status--active"
                            : "effective-rules__status--inactive"
                        }
                      >
                        {rule.status}
                      </span>
                    </td>
                    <td>
                      {rule.updatedAt ? (
                        <>
                          <strong>{formatDate(rule.updatedAt)}</strong>
                          <small>{rule.updatedBy}</small>
                        </>
                      ) : (
                        <>
                          <strong>Statutory baseline</strong>
                          <small>System default</small>
                        </>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => onNavigate(rule.editPath)}
                      >
                        <Eye size={15} />
                        Open settings
                      </button>
                    </td>
                  </tr>
                ))}
                {!rules.length ? (
                  <tr>
                    <td colSpan="8">
                      <EmptyState message="No effective payroll rules match these filters." />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function StaffManagementView() {
  const session = getStoredSession();
  const [staff, setStaff] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/hr/staff`, {
        headers: getAuthHeaders(session?.token),
      });
      const body = await response.json().catch(() => []);
      if (!response.ok)
        throw new Error(body.message || "Failed to load staff records");
      setStaff(Array.isArray(body) ? body : []);
      setError("");
    } catch (loadError) {
      setError(loadError.message || "Failed to load staff records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return staff;
    return staff.filter((record) =>
      [
        record.employee_id,
        record.employee_code,
        record.name,
        record.email,
        record.department_name,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query),
      ),
    );
  }, [search, staff]);

  const openEditor = (record) => {
    setEditing(record);
    setForm({
      employee_code: record.employee_code || "",
      name: record.name || "",
      email: record.email || "",
      phone: record.phone || "",
      department_name: record.department_name || "",
      base_salary: record.base_salary ?? "",
      status: Number(record.status) === 1 ? "Active" : "Inactive",
    });
  };

  const saveStaff = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/hr/staff/${editing.employee_id}`,
        {
          method: "PUT",
          headers: {
            ...getAuthHeaders(session?.token),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.message || "Failed to update staff record");
      setEditing(null);
      setSuccess(`${body.staff?.name || form.name} updated successfully.`);
      setError("");
      await loadStaff();
    } catch (saveError) {
      setError(saveError.message || "Failed to update staff record");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell
      heading="Staff Management"
      updatedAt={getLatestTimestamp(staff)}
      actions={
        <ActionButton icon={Search} variant="secondary" onClick={loadStaff}>
          Refresh Staff
        </ActionButton>
      }
    >
      <div className="mb-5 rounded-xl border border-[#f0d2ca] bg-[#FFF6F2] p-4 text-sm text-[#7b6660]">
        Manage employee identity, department, salary reference, employment
        status and account linkage. Login roles and account access are managed
        under <strong>User Accounts</strong>.
      </div>
      {error ? (
        <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}
      <div className="app-panel rounded-2xl p-6">
        <label className="flex max-w-xl items-center gap-2 rounded-xl border border-[#f0d2ca] bg-white px-3 py-2.5">
          <Search size={16} className="text-[#F38978]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search employee ID, name, email or department"
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>
        {loading ? (
          <p className="py-10 text-center text-sm text-[#7b6660]">
            Loading staff records...
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-[#F38978]/80">
                <tr>
                  <th className="border-b border-[#f0d2ca] px-3 py-3">
                    Employee
                  </th>
                  <th className="border-b border-[#f0d2ca] px-3 py-3">
                    Department
                  </th>
                  <th className="border-b border-[#f0d2ca] px-3 py-3">
                    Base salary
                  </th>
                  <th className="border-b border-[#f0d2ca] px-3 py-3">
                    Account link
                  </th>
                  <th className="border-b border-[#f0d2ca] px-3 py-3">
                    Employment
                  </th>
                  <th className="border-b border-[#f0d2ca] px-3 py-3">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((record) => (
                  <tr
                    key={record.employee_id}
                    className="text-[#7b6660] hover:bg-[#FDD9CD]/30"
                  >
                    <td className="border-b border-[#f0d2ca] px-3 py-4">
                      <p className="font-semibold text-[#251E1F]">
                        {record.name}
                      </p>
                      <p className="text-xs">
                        {record.employee_code || record.employee_id} ·{" "}
                        {record.email || "No email"}
                      </p>
                    </td>
                    <td className="border-b border-[#f0d2ca] px-3 py-4">
                      {record.department_name || "Not assigned"}
                    </td>
                    <td className="border-b border-[#f0d2ca] px-3 py-4">
                      {formatMoney(record.base_salary)}
                    </td>
                    <td className="border-b border-[#f0d2ca] px-3 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${record.user_user_id ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                      >
                        {record.user_user_id ? "Linked" : "Not linked"}
                      </span>
                    </td>
                    <td className="border-b border-[#f0d2ca] px-3 py-4">
                      {Number(record.status) === 1 ? "Active" : "Inactive"}
                    </td>
                    <td className="border-b border-[#f0d2ca] px-3 py-4">
                      <button
                        type="button"
                        onClick={() => openEditor(record)}
                        className="rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/40"
                      >
                        Edit staff
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredStaff.length ? (
              <EmptyState message="No staff records match your search." />
            ) : null}
          </div>
        )}
      </div>
      {editing ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
          onMouseDown={() => setEditing(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-[#251E1F]">
                  Edit staff record
                </h3>
                <p className="text-sm text-[#7b6660]">
                  Employee ID: {editing.employee_id}
                </p>
              </div>
              <button type="button" onClick={() => setEditing(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                ["name", "Name", "text"],
                ["employee_code", "Employee code", "text"],
                ["email", "Email", "email"],
                ["phone", "Phone", "text"],
                ["department_name", "Department", "text"],
                ["base_salary", "Base salary", "number"],
              ].map(([key, label, type]) => (
                <label key={key} className="text-sm font-medium text-[#7b6660]">
                  {label}
                  <input
                    type={type}
                    value={form[key] ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-[#f0d2ca] px-3 py-2.5 text-[#251E1F] outline-none focus:border-[#F38978]"
                  />
                </label>
              ))}
              <label className="text-sm font-medium text-[#7b6660]">
                Employment status
                <select
                  value={form.status || "Active"}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-[#f0d2ca] px-3 py-2.5 text-[#251E1F]"
                >
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl border border-[#f0d2ca] px-4 py-2.5 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={saveStaff}
                className="rounded-xl bg-[#F38978] px-4 py-2.5 font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save staff"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
  users = [],
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
    [roleSummary],
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
      const matchesStatus =
        statusFilter === "All" || statusLabel === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [roleFilter, searchTerm, statusFilter, users]);
  const manageableFilteredUsers = filteredUsers.filter(
    (user) => Number(user.user_id) !== Number(currentUserId),
  );
  const selectedUsers = users.filter((user) =>
    selectedUserIds.includes(user.user_id),
  );
  const toggleUserSelection = (userId) => {
    setSelectedUserIds((currentIds) =>
      currentIds.includes(userId)
        ? currentIds.filter((id) => id !== userId)
        : [...currentIds, userId],
    );
  };
  const toggleFilteredSelection = () => {
    const manageableIds = manageableFilteredUsers.map((user) => user.user_id);
    const allSelected =
      manageableIds.length > 0 &&
      manageableIds.every((id) => selectedUserIds.includes(id));

    setSelectedUserIds((currentIds) =>
      allSelected
        ? currentIds.filter((id) => !manageableIds.includes(id))
        : Array.from(new Set([...currentIds, ...manageableIds])),
    );
  };
  return (
    <PageShell
      heading="User Accounts & Access"
      updatedAt={getLatestTimestamp(users)}
      actions={
        <>
          <ActionButton icon={Users} onClick={() => setIsAddUserOpen(true)}>
            Add User
          </ActionButton>
          <ActionButton
            icon={ShieldCheck}
            variant="secondary"
            onClick={() => setIsBulkAccessOpen(true)}
            disabled={!users.length}
          >
            Bulk Access Settings
          </ActionButton>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-[#f0d2ca] bg-[#FFF6F2] p-4 text-sm text-[#7b6660]">
          Manage login roles, account activation, password resets and
          staff-account links. Salary and employment details are managed under{" "}
          <strong>Staff Management</strong>.
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {roleSummary.map((role) => (
            <div key={role.role_id} className="app-panel rounded-2xl p-5">
              <p className="text-sm text-[#7b6660]">{role.role_name}</p>
              <p className="mt-3 text-3xl font-semibold text-[#251E1F]">
                {role.user_count}
              </p>
              <p className="mt-2 text-sm text-[#7b6660]/80">
                {role.description || "Role access"}
              </p>
            </div>
          ))}
        </div>

        <div className="app-panel rounded-2xl p-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[#251E1F]">
                User Account Directory
              </h3>
              <p className="mt-1 text-sm text-[#7b6660]">
                {filteredUsers.length} of {users.length} user(s) shown
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:w-[46rem]">
              <label className="flex items-center gap-2 rounded-xl border border-[#f0d2ca] bg-white/80 px-3 py-2.5">
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
                  <option key={role} value={role}>
                    {role} roles
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-xl border border-[#f0d2ca] bg-[#ffffff] px-3 py-2.5 text-sm font-semibold text-[#251E1F] outline-none"
              >
                {["All", "Active", "Inactive"].map((status) => (
                  <option key={status} value={status}>
                    {status} status
                  </option>
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
                      checked={
                        manageableFilteredUsers.length > 0 &&
                        manageableFilteredUsers.every((user) =>
                          selectedUserIds.includes(user.user_id),
                        )
                      }
                      onChange={toggleFilteredSelection}
                      aria-label="Select visible users"
                    />
                  </th>
                  <th className="border-b border-[#f0d2ca] px-4 py-3 font-semibold">
                    User
                  </th>
                  <th className="border-b border-[#f0d2ca] px-4 py-3 font-semibold">
                    Role
                  </th>
                  <th className="border-b border-[#f0d2ca] px-4 py-3 font-semibold">
                    Staff Link
                  </th>
                  <th className="border-b border-[#f0d2ca] px-4 py-3 font-semibold">
                    Status
                  </th>
                  <th className="border-b border-[#f0d2ca] px-4 py-3 font-semibold">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const isActive = Number(user.status) === 1;
                  const isCurrentUser =
                    Number(user.user_id) === Number(currentUserId);

                  return (
                    <tr
                      key={user.user_id}
                      className="cursor-pointer text-[#7b6660] transition hover:bg-[#FDD9CD]/45"
                      onClick={() => setManagedUser(user)}
                    >
                      <td
                        className="border-b border-[#f0d2ca] px-4 py-4"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(user.user_id)}
                          onChange={() => toggleUserSelection(user.user_id)}
                          disabled={isCurrentUser}
                          aria-label={`Select ${user.name}`}
                        />
                      </td>
                      <td className="border-b border-[#f0d2ca] px-4 py-4">
                        <p className="font-semibold text-[#251E1F]">
                          {user.name}
                        </p>
                        <p className="mt-1 text-xs text-[#7b6660]/75">
                          {user.email}
                        </p>
                      </td>
                      <td className="border-b border-[#f0d2ca] px-4 py-4">
                        {user.role_name}
                      </td>
                      <td className="border-b border-[#f0d2ca] px-4 py-4">
                        {user.employee_code
                          ? `${user.employee_code} · ${user.department_name || "No department"}`
                          : "Not linked"}
                      </td>
                      <td className="border-b border-[#f0d2ca] px-4 py-4">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${isActive ? "border-[#2f8758]/25 bg-[#2f8758]/10 text-[#2f8758]" : "border-[#D97706]/25 bg-[#D97706]/10 text-[#9A6412]"}`}
                        >
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="border-b border-[#f0d2ca] px-4 py-4">
                        <button
                          type="button"
                          className="rounded-xl border border-[#f0d2ca] bg-white/80 px-3 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/45"
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
  selectedUsers,
}) {
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedCount = selectedUsers.length;
  const activeCount = selectedUsers.filter(
    (user) => Number(user.status) === 1,
  ).length;
  const inactiveCount = selectedUsers.filter(
    (user) => Number(user.status) !== 1,
  ).length;
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
              <h3 className="text-xl font-semibold text-[#251E1F]">
                Bulk Access Settings
              </h3>
              <p className="mt-1 text-sm text-[#7b6660]">
                Update role or account status for selected users.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-xl border border-[#f0d2ca] bg-white/80 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/45"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-4">
            <p className="text-sm text-[#7b6660]">Selected Users</p>
            <p className="mt-2 text-3xl font-semibold text-[#251E1F]">
              {selectedCount}
            </p>
            <p className="mt-2 text-xs text-[#7b6660]/75">
              {activeCount} active / {inactiveCount} inactive
            </p>
          </div>

          <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-4 md:col-span-2">
            <p className="text-sm font-semibold text-[#251E1F]">Selection</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-xl border border-[#f0d2ca] bg-white/80 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/45"
                onClick={() => onSelectionChange(filteredIds)}
                disabled={!filteredIds.length}
              >
                Select Visible Users
              </button>
              <button
                type="button"
                className="rounded-xl border border-[#f0d2ca] bg-white/80 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/45"
                onClick={() => onSelectionChange([])}
                disabled={!selectedCount}
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-4">
            <p className="text-sm font-semibold text-[#251E1F]">Apply Role</p>
            <p className="mt-2 text-sm text-[#7b6660]">
              Assign one role to every selected user.
            </p>
            <div className="mt-4 flex gap-2">
              <select
                value={selectedRoleId}
                onChange={(event) => setSelectedRoleId(event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-[#f0d2ca] bg-[#ffffff] px-3 py-2 text-sm font-semibold text-[#251E1F] outline-none"
              >
                <option value="">Choose role</option>
                {roles.map((role) => (
                  <option key={role.role_id} value={role.role_id}>
                    {role.role_name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="rounded-xl border border-[#F38978]/25 bg-[#F38978]/10 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#F38978]/20 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={applyBulkRole}
                disabled={isSubmitting || !selectedRoleId || !selectedCount}
              >
                Apply
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-4">
            <p className="text-sm font-semibold text-[#251E1F]">
              Account Status
            </p>
            <p className="mt-2 text-sm text-[#7b6660]">
              Activate or deactivate all selected user accounts.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-xl border border-[#2f8758]/25 bg-[#2f8758]/10 px-4 py-2 text-sm font-semibold text-[#2D7C83] hover:bg-[#2f8758]/20 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => applyBulkStatus(1)}
                disabled={isSubmitting || !selectedCount}
              >
                Activate
              </button>
              <button
                type="button"
                className="rounded-xl border border-[#D97706]/25 bg-[#D97706]/10 px-4 py-2 text-sm font-semibold text-[#9A6412] hover:bg-[#D97706]/20 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => applyBulkStatus(0)}
                disabled={isSubmitting || !selectedCount}
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-[#f0d2ca] bg-white/80 p-4">
          <p className="text-sm font-semibold text-[#251E1F]">
            Selected Users Preview
          </p>
          <div className="mt-3 max-h-56 overflow-y-auto">
            {selectedUsers.length ? (
              <div className="divide-y divide-[#ead3cc]">
                {selectedUsers.map((user) => (
                  <div
                    key={user.user_id}
                    className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-[#251E1F]">
                        {user.name}
                      </p>
                      <p className="text-xs text-[#7b6660]/75">{user.email}</p>
                    </div>
                    <p className="text-[#7b6660]">
                      {user.role_name} /{" "}
                      {Number(user.status) === 1 ? "Active" : "Inactive"}
                    </p>
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
    <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#F38978]/75">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-[#251E1F]">
        {value || "Not linked"}
      </p>
    </div>
  );
}

function AddUserModal({
  availableStaff = [],
  onClose,
  onCreateUser,
  roles = [],
}) {
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    roleId: String(roles[0]?.role_id || ""),
    staffEmployeeId: "",
    status: "1",
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (field, value) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleStaffChange = (employeeId) => {
    const selectedStaff = availableStaff.find(
      (staff) => String(staff.employee_id) === String(employeeId),
    );

    setFormData((current) => ({
      ...current,
      staffEmployeeId: employeeId,
      name: selectedStaff?.name || current.name,
      email: selectedStaff?.email || current.email,
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
        staffEmployeeId: formData.staffEmployeeId
          ? Number(formData.staffEmployeeId)
          : null,
        status: Number(formData.status),
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
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#F38978]/80">
              Admin User Access
            </p>
            <h3 className="mt-2 text-xl font-semibold text-[#251E1F]">
              Add New User
            </h3>
            <p className="mt-1 text-sm text-[#7b6660]">
              Create a login account and link it to an existing staff profile
              when needed.
            </p>
          </div>
          <button
            type="button"
            className="rounded-xl border border-[#f0d2ca] bg-white/80 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/45"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-[#251E1F]">
              Link Staff Profile
            </span>
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
              <span className="text-sm font-semibold text-[#251E1F]">
                Email
              </span>
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
                  <option key={role.role_id} value={role.role_id}>
                    {role.role_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-[#251E1F]">
                Status
              </span>
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
              <p className="text-xs font-semibold uppercase tracking-wide text-[#2f8758]">
                Temporary Password
              </p>
              <p className="mt-2 break-all font-mono text-sm text-[#251E1F]">
                {temporaryPassword}
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3 border-t border-[#f0d2ca] pt-5">
            <button
              type="button"
              className="rounded-xl border border-[#f0d2ca] bg-white/80 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/45"
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
  user,
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
              <h3 className="text-xl font-semibold text-[#251E1F]">
                Manage {user.name}
              </h3>
              <p className="mt-1 text-sm text-[#7b6660]">{user.email}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-[#f0d2ca] bg-white/80 px-3 py-1 text-xs font-semibold text-[#7b6660]">
                  {user.role_name}
                </span>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${isActive ? "border-[#2f8758]/25 bg-[#2f8758]/10 text-[#2f8758]" : "border-[#D97706]/25 bg-[#D97706]/10 text-[#9A6412]"}`}
                >
                  {isActive ? "Active account" : "Inactive account"}
                </span>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${hasStaffProfile ? "border-[#F38978]/25 bg-[#F38978]/10 text-[#6F4F47]" : "border-[#D97706]/25 bg-[#D97706]/10 text-[#9A6412]"}`}
                >
                  {hasStaffProfile
                    ? "Staff profile linked"
                    : "No staff profile"}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="rounded-xl border border-[#f0d2ca] bg-white/80 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/45"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-6 space-y-6">
          <div>
            <h4 className="font-semibold text-[#251E1F]">Admin Actions</h4>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-4">
                <p className="text-sm font-semibold text-[#251E1F]">
                  Reset Password
                </p>
                <p className="mt-2 text-sm text-[#7b6660]">
                  Generates a temporary password for the user. Share it through
                  a secure channel.
                </p>
                <button
                  type="button"
                  className="mt-4 rounded-xl border border-[#F38978]/25 bg-[#F38978]/10 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#F38978]/20 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleResetPassword}
                  disabled={isSubmitting}
                >
                  Reset Password
                </button>
                {temporaryPassword ? (
                  <div className="mt-4 rounded-xl border border-[#2f8758]/25 bg-[#2f8758]/10 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#2f8758]">
                      Temporary Password
                    </p>
                    <p className="mt-2 break-all font-mono text-sm text-[#251E1F]">
                      {temporaryPassword}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-4">
                <p className="text-sm font-semibold text-[#251E1F]">
                  Account Status
                </p>
                <p className="mt-2 text-sm text-[#7b6660]">
                  Disable access for inactive users. Self-deactivation is
                  blocked.
                </p>
                <button
                  type="button"
                  className="mt-4 rounded-xl border border-[#f0d2ca] bg-white/80 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/45 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleStatusUpdate}
                  disabled={isSubmitting || isCurrentUser}
                >
                  {isActive ? "Deactivate Account" : "Activate Account"}
                </button>
              </div>

              <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-4">
                <p className="text-sm font-semibold text-[#251E1F]">
                  Role Access
                </p>
                <p className="mt-2 text-sm text-[#7b6660]">
                  Change module access by assigning a different role. Self-role
                  changes are blocked.
                </p>
                <div className="mt-4 flex gap-2">
                  <select
                    value={selectedRoleId}
                    onChange={(event) => setSelectedRoleId(event.target.value)}
                    className="min-w-0 flex-1 rounded-xl border border-[#f0d2ca] bg-[#ffffff] px-3 py-2 text-sm font-semibold text-[#251E1F] outline-none"
                    disabled={isCurrentUser}
                  >
                    {roles.map((role) => (
                      <option key={role.role_id} value={role.role_id}>
                        {role.role_name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="rounded-xl border border-[#F38978]/25 bg-[#F38978]/10 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#F38978]/20 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={handleRoleUpdate}
                    disabled={
                      isSubmitting ||
                      isCurrentUser ||
                      Number(selectedRoleId) === Number(user.role_id)
                    }
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
              <ProfileField
                label="Created"
                value={formatDate(user.created_at)}
              />
              <ProfileField
                label="Updated"
                value={formatDate(user.updated_at)}
              />
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
              <ProfileField
                label="Hire Date"
                value={formatDate(user.hire_date)}
              />
              <ProfileField
                label="Base Salary"
                value={formatMoney(user.base_salary)}
              />
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

function PayslipLayoutsView({
  layouts = [],
  onImportLayout,
  onSetDefaultLayout,
}) {
  const defaultLayout =
    layouts.find((layout) => Number(layout.is_default) === 1) || layouts[0];
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [actionState, setActionState] = useState(null);
  const [preview, setPreview] = useState(null);
  const [business, setBusiness] = useState(null);
  const [savingBusiness, setSavingBusiness] = useState(false);
  useEffect(() => {
    getCompanyProfile()
      .then((result) => setBusiness(result.company))
      .catch((error) => setUploadError(error.message));
  }, []);

  const saveBusiness = async (event) => {
    event.preventDefault();
    setSavingBusiness(true);
    setUploadError("");
    try {
      const { logoUrl: _displayOnlyLogoUrl, ...editableBusiness } = business;
      const result = await updateCompanyProfile(editableBusiness);
      setBusiness(result.company);
      setActionState({
        open: true,
        status: "completed",
        title: "Payslip branding saved",
        phase: "Business registration details will appear on new payslips.",
      });
    } catch (error) {
      setActionState({
        open: true,
        status: "failed",
        title: "Save payslip branding",
        phase: "Unable to save business settings",
        detail: error.message,
      });
    } finally {
      setSavingBusiness(false);
    }
  };
  const selectLogo = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setActionState({
      open: true,
      status: "running",
      title: "Upload brand logo",
      phase: "Validating and saving company branding…",
    });
    try {
      const result = await uploadCompanyLogo(file);
      setBusiness(result.company);
      setActionState({
        open: true,
        status: "completed",
        title: "Brand logo updated",
        phase: "The logo will appear on newly generated payslips.",
      });
    } catch (error) {
      setActionState({
        open: true,
        status: "failed",
        title: "Upload brand logo",
        phase: "Logo upload failed",
        detail: error.message,
      });
    }
  };

  const previewLayout = async (layout) => {
    if (!layout?.layout_id) {
      setUploadError("Upload a payslip layout before previewing it.");
      return;
    }
    setActionState({
      open: true,
      status: "running",
      title: "Prepare payslip preview",
      phase: "Loading the stored PDF…",
    });
    try {
      const blob = await getPayslipLayoutPreview(layout.layout_id);
      const url = URL.createObjectURL(blob);
      setPreview({ url, name: layout.layout_name });
      setActionState({
        open: true,
        status: "completed",
        title: "Payslip preview ready",
        phase: "PDF loaded successfully.",
      });
    } catch (error) {
      setActionState({
        open: true,
        status: "failed",
        title: "Payslip preview",
        phase: "Unable to load preview",
        detail: error.message,
      });
    }
  };
  const previewSample = async () => {
    setActionState({
      open: true,
      status: "running",
      title: "Generate sample payslip",
      phase: "Rendering a safe sample PDF…",
    });
    try {
      const blob = await getPayslipSamplePreview();
      const url = URL.createObjectURL(blob);
      setPreview({ url, name: "Sample Payslip" });
      setActionState({
        open: true,
        status: "completed",
        title: "Sample payslip ready",
        phase: "PDF generated successfully.",
      });
    } catch (error) {
      setActionState({
        open: true,
        status: "failed",
        title: "Sample payslip preview",
        phase: "Unable to generate preview",
        detail: error.message,
      });
    }
  };
  useEffect(
    () => () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    },
    [preview?.url],
  );

  const makeDefault = async (layout) => {
    setActionState({
      open: true,
      status: "running",
      title: "Set default payslip layout",
      phase: "Saving layout selection…",
    });
    try {
      await onSetDefaultLayout(layout.layout_id);
      setActionState({
        open: true,
        status: "completed",
        title: "Default layout updated",
        phase: `${layout.layout_name} is now the default.`,
      });
    } catch (error) {
      setActionState({
        open: true,
        status: "failed",
        title: "Set default payslip layout",
        phase: "Unable to save selection",
        detail: error.message,
      });
    }
  };

  const selectLayoutFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (
      file.type !== "application/pdf" ||
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setUploadError("Select a PDF payslip layout.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("The PDF must not exceed 10MB.");
      return;
    }
    setIsUploading(true);
    setActionState({
      open: true,
      status: "running",
      title: "Upload payslip layout",
      phase: "Validating and saving PDF…",
    });
    setUploadError("");
    const uploaded = await onImportLayout(file);
    if (!uploaded) {
      setUploadError("The payslip layout could not be uploaded.");
      setActionState({
        open: true,
        status: "failed",
        title: "Upload payslip layout",
        phase: "Upload failed",
        detail: "The payslip layout could not be uploaded.",
      });
    } else
      setActionState({
        open: true,
        status: "completed",
        title: "Payslip layout uploaded",
        phase: "The PDF is ready to preview.",
      });
    setIsUploading(false);
  };

  return (
    <PageShell
      heading="Payslip Template"
      updatedAt={getLatestTimestamp(layouts)}
      actions={
        <>
          <ActionButton icon={Eye} variant="secondary" onClick={previewSample}>
            Preview Sample
          </ActionButton>
        </>
      }
    >
      <input
        id="company-logo-file"
        type="file"
        accept="image/png,image/jpeg,.png,.jpg,.jpeg"
        className="sr-only"
        onChange={selectLogo}
      />
      {business ? (
        <form
          onSubmit={saveBusiness}
          className="app-panel mb-5 rounded-2xl p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#F38978]">
                Default system template
              </p>
              <h3 className="mt-1 text-lg font-semibold text-[#251E1F]">
                Company branding and registration
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-[#7b6660]">
                The PayNivo payslip structure is standardised across every
                workspace. Your logo and registered business details are applied
                dynamically without changing payroll calculations.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                document.getElementById("company-logo-file")?.click()
              }
              className="rounded-xl border border-[#F38978]/30 bg-[#F38978]/10 px-4 py-2.5 text-sm font-semibold text-[#9f4438]"
            >
              Upload brand logo
            </button>
          </div>
          {business.logoUrl ? (
            <img
              src={business.logoUrl}
              alt="Current company logo"
              className="mt-5 h-20 w-48 rounded-xl border border-[#f0d2ca] bg-white object-contain p-2"
            />
          ) : null}
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {[
              ["Workspace display name", "name"],
              ["Legal company name", "legalName"],
              ["Company UEN / registration number", "registrationNumber"],
              ["GST registration number", "gstNumber"],
              ["Registered address", "address"],
              ["Business phone", "phone"],
              ["Business email", "email"],
              ["Website", "website"],
            ].map(([label, key]) => (
              <label key={key} className="text-sm font-semibold text-[#5f4c47]">
                {label}
                <input
                  required={[
                    "name",
                    "legalName",
                    "registrationNumber",
                    "address",
                  ].includes(key)}
                  value={business[key] || ""}
                  onChange={(event) =>
                    setBusiness({ ...business, [key]: event.target.value })
                  }
                  type={key === "email" ? "email" : "text"}
                  className="mt-1 block h-11 w-full rounded-xl border border-[#f0d2ca] bg-white px-3 text-sm font-normal text-[#251E1F] outline-none focus:border-[#F38978]"
                />
              </label>
            ))}
          </div>
          <button
            disabled={savingBusiness}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#F38978] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {savingBusiness ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <CheckCircle2 size={17} />
            )}
            Save payslip business settings
          </button>
        </form>
      ) : (
        <div className="app-panel mb-5 flex items-center gap-2 rounded-2xl p-6 text-sm text-[#7b6660]">
          <Loader2 size={17} className="animate-spin" />
          Loading business settings…
        </div>
      )}
      <input
        id="payslip-layout-file"
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={selectLayoutFile}
      />
      {false ? (
        <div className="mb-5 rounded-2xl border border-dashed border-[#F38978]/45 bg-[#FFF6F2] p-6 text-center">
          <Upload size={30} className="mx-auto text-[#F38978]" />
          <h3 className="mt-3 font-semibold text-[#251E1F]">
            Upload a payslip layout
          </h3>
          <p className="mt-1 text-sm text-[#7b6660]">
            Choose a PDF file. Its filename will automatically become the layout
            name.
          </p>
          <button
            type="button"
            disabled={isUploading}
            onClick={() =>
              document.getElementById("payslip-layout-file")?.click()
            }
            className="mt-4 rounded-xl bg-[#F38978] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#df7565] disabled:opacity-50"
          >
            {isUploading ? "Uploading PDF..." : "Choose PDF File"}
          </button>
          {uploadError ? (
            <p className="mt-3 text-sm font-medium text-red-600">
              {uploadError}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section className="app-panel rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#251E1F] text-white">
              <FileText size={22} />
            </span>
            <div>
              <h3 className="font-semibold text-[#251E1F]">
                PayNivo standard payslip
              </h3>
              <p className="mt-1 text-sm text-[#7b6660]">
                One consistent, calculation-driven template is used across the
                platform. Each tenant’s identity is inserted automatically.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              "Company logo, legal name, UEN and GST number",
              "Employee identity, department and work information",
              "Basic salary, allowances and non-CPF reimbursements",
              "Employee CPF, SHG/MBMF and recovery deductions",
              "Employer CPF and SDL shown separately from employee deductions",
              "Calculated gross pay, total deductions and net pay",
            ].map((text) => (
              <div
                key={text}
                className="flex gap-2 rounded-xl bg-[#fff8f5] p-3 text-sm text-[#5f4c47]"
              >
                <CheckCircle2
                  size={17}
                  className="mt-0.5 shrink-0 text-emerald-600"
                />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </section>
        <aside className="app-panel rounded-2xl p-6">
          <Palette size={26} className="text-[#F38978]" />
          <h3 className="mt-4 font-semibold text-[#251E1F]">
            Calculation safeguards
          </h3>
          <p className="mt-2 text-sm leading-6 text-[#7b6660]">
            The template does not recalculate payroll in the browser. It
            displays the immutable payroll-run results produced by CPF, SDL,
            SHG/MBMF, reimbursement and deduction rules.
          </p>
          <button
            type="button"
            onClick={previewSample}
            className="mt-5 w-full rounded-xl bg-[#251E1F] px-4 py-3 text-sm font-semibold text-white"
          >
            Preview current template
          </button>
        </aside>
      </div>
      <AdminActionProgress
        state={actionState}
        onClose={() => setActionState(null)}
      />
      {preview ? (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-[#251E1F]/50 p-4">
          <section className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-[#f0d2ca] p-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-[#F38978]">
                  Payslip layout preview
                </p>
                <h3 className="font-semibold">{preview.name}</h3>
              </div>
              <div className="flex gap-2">
                <a
                  href={preview.url}
                  download={`${preview.name || "payslip-layout"}.pdf`}
                  className="rounded-xl border border-[#f0d2ca] px-4 py-2 text-sm font-semibold"
                >
                  Download PDF
                </a>
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(preview.url);
                    setPreview(null);
                  }}
                  className="rounded-xl border border-[#f0d2ca] p-2"
                >
                  <X size={18} />
                </button>
              </div>
            </header>
            <iframe
              title={`${preview.name} preview`}
              src={preview.url}
              className="min-h-0 flex-1"
            />
          </section>
        </div>
      ) : null}
    </PageShell>
  );
}

function SettingEditor({ definition, setting, onSave }) {
  const [value, setValue] = useState(setting?.setting_value || "");
  const [isSaving, setIsSaving] = useState(false);
  const usage = definition.usage || "Applied to payroll calculations";
  const usageClass =
    usage === "Operational reference only"
      ? "setting-usage--reference"
      : usage === "Used for validation"
        ? "setting-usage--validation"
        : "setting-usage--applied";

  useEffect(() => {
    setValue(setting?.setting_value || "");
  }, [setting?.setting_value]);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      await onSave(definition.key, {
        settingValue: value,
        description: definition.description,
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
          <p className="mt-1 text-sm text-[#7b6660]">
            {definition.description}
          </p>
          <span className={`setting-usage ${usageClass}`}>{usage}</span>
        </div>
      </div>

      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={definition.placeholder}
        className="mt-5 w-full rounded-xl border border-[#f0d2ca] bg-white/80 px-3 py-2.5 text-sm text-[#251E1F] outline-none placeholder:text-[#7b6660]/50 focus:border-[#F38978]/50"
      />

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-[#7b6660]/70">
          {setting?.updated_at
            ? `Updated ${formatDate(setting.updated_at)}`
            : "Not configured"}
        </p>
        <button
          type="button"
          className="rounded-xl border border-[#F38978]/25 bg-[#F38978]/10 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#F38978]/20 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleSave}
          disabled={isSaving || !value.trim()}
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

function SettingsSection({
  definitions,
  settingsByKey,
  title,
  subtitle,
  onSave,
}) {
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
      className="w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-sm text-[#251E1F] outline-none placeholder:text-[#7b6660]/50 focus:border-[#F38978]/50"
    />
  );
}

function CpfRateTable({ onSave, settingsByKey }) {
  const [rows, setRows] = useState(() =>
    cpfAgeTierRows.map((row) => ({
      ...row,
      employeeRate:
        settingsByKey[`cpf_rate_${row.slug}_employee_percent`]?.setting_value ||
        settingsByKey[`cpf_rate_${row.slug}_employee_ordinary`]
          ?.setting_value ||
        row.employeeRate,
      employerRate:
        settingsByKey[`cpf_rate_${row.slug}_employer_percent`]?.setting_value ||
        settingsByKey[`cpf_rate_${row.slug}_employer_ordinary`]
          ?.setting_value ||
        row.employerRate,
    })),
  );
  const [savingSlug, setSavingSlug] = useState("");

  useEffect(() => {
    setRows(
      cpfAgeTierRows.map((row) => ({
        ...row,
        employeeRate:
          settingsByKey[`cpf_rate_${row.slug}_employee_percent`]
            ?.setting_value ||
          settingsByKey[`cpf_rate_${row.slug}_employee_ordinary`]
            ?.setting_value ||
          row.employeeRate,
        employerRate:
          settingsByKey[`cpf_rate_${row.slug}_employer_percent`]
            ?.setting_value ||
          settingsByKey[`cpf_rate_${row.slug}_employer_ordinary`]
            ?.setting_value ||
          row.employerRate,
      })),
    );
  }, [settingsByKey]);

  const updateRow = (slug, field, value) => {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.slug === slug ? { ...row, [field]: value } : row,
      ),
    );
  };

  const saveRow = async (row) => {
    setSavingSlug(row.slug);

    try {
      await Promise.all([
        onSave(`cpf_rate_${row.slug}_employee_percent`, {
          settingValue: row.employeeRate,
          description: `${row.ageGroup} employee CPF rate.`,
        }),
        onSave(`cpf_rate_${row.slug}_employer_percent`, {
          settingValue: row.employerRate,
          description: `${row.ageGroup} employer CPF rate.`,
        }),
      ]);
    } finally {
      setSavingSlug("");
    }
  };

  return (
    <section className="app-panel overflow-hidden rounded-2xl">
      <div className="border-b border-[#f0d2ca] px-5 py-4">
        <h3 className="text-lg font-semibold text-[#251E1F]">
          CPF Age-Tier Rates
        </h3>
        <p className="mt-1 text-sm text-[#7b6660]">
          Set employee and employer CPF percentage rates by age tier.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[44rem] w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-[#F38978]/80">
            <tr>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Age Group</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">
                Employee CPF %
              </th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">
                Employer CPF %
              </th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.slug}>
                <td className="border-b border-[#f0d2ca] px-4 py-4 font-semibold text-[#251E1F]">
                  {row.ageGroup}
                </td>
                <td className="border-b border-[#f0d2ca] px-4 py-4">
                  <SettingInput
                    value={row.employeeRate}
                    onChange={(value) =>
                      updateRow(row.slug, "employeeRate", value)
                    }
                  />
                </td>
                <td className="border-b border-[#f0d2ca] px-4 py-4">
                  <SettingInput
                    value={row.employerRate}
                    onChange={(value) =>
                      updateRow(row.slug, "employerRate", value)
                    }
                  />
                </td>
                <td className="border-b border-[#f0d2ca] px-4 py-4">
                  <button
                    type="button"
                    className="rounded-xl border border-[#F38978]/25 bg-[#F38978]/10 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#F38978]/20 disabled:cursor-not-allowed disabled:opacity-60"
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
      includeCpf:
        settingsByKey[`earning_component_${row.slug}_cpf_applicable`]
          ?.setting_value ||
        settingsByKey[`cpf_component_${row.slug}_included`]?.setting_value ||
        row.includeCpf,
      wageType:
        settingsByKey[`earning_component_${row.slug}_wage_type`]
          ?.setting_value ||
        settingsByKey[`cpf_component_${row.slug}_wage_type`]?.setting_value ||
        row.wageType,
      remarks:
        settingsByKey[`earning_component_${row.slug}_remarks`]?.setting_value ||
        row.remarks,
    })),
  );
  const [savingSlug, setSavingSlug] = useState("");

  useEffect(() => {
    setRows(
      earningComponentRows.map((row) => ({
        ...row,
        includeCpf:
          settingsByKey[`earning_component_${row.slug}_cpf_applicable`]
            ?.setting_value ||
          settingsByKey[`cpf_component_${row.slug}_included`]?.setting_value ||
          row.includeCpf,
        wageType:
          settingsByKey[`earning_component_${row.slug}_wage_type`]
            ?.setting_value ||
          settingsByKey[`cpf_component_${row.slug}_wage_type`]?.setting_value ||
          row.wageType,
        remarks:
          settingsByKey[`earning_component_${row.slug}_remarks`]
            ?.setting_value || row.remarks,
      })),
    );
  }, [settingsByKey]);

  const updateRow = (slug, field, value) => {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.slug === slug ? { ...row, [field]: value } : row,
      ),
    );
  };

  const saveRow = async (row) => {
    setSavingSlug(row.slug);

    try {
      await Promise.all([
        onSave(`earning_component_${row.slug}_cpf_applicable`, {
          settingValue: row.includeCpf,
          description: `${row.component} CPF applicability setting.`,
        }),
        onSave(`earning_component_${row.slug}_wage_type`, {
          settingValue: row.wageType,
          description: `${row.component} CPF wage type setting.`,
        }),
        onSave(`earning_component_${row.slug}_remarks`, {
          settingValue: row.remarks,
          description: `${row.component} earning component remarks.`,
        }),
      ]);
    } finally {
      setSavingSlug("");
    }
  };

  return (
    <section className="app-panel overflow-hidden rounded-2xl">
      <div className="border-b border-[#f0d2ca] px-5 py-4">
        <h3 className="text-lg font-semibold text-[#251E1F]">
          Earning Component Classification
        </h3>
        <p className="mt-1 text-sm text-[#7b6660]">
          Define which earning components feed CPF and how each wage type is
          classified.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[58rem] w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-[#F38978]/80">
            <tr>
              <th className="border-b border-[#f0d2ca] px-4 py-3">
                Component Name
              </th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">
                CPF Applicable
              </th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Wage Type</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Remarks</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.slug}>
                <td className="border-b border-[#f0d2ca] px-4 py-4 font-semibold text-[#251E1F]">
                  {row.component}
                </td>
                <td className="border-b border-[#f0d2ca] px-4 py-4">
                  <select
                    value={row.includeCpf}
                    onChange={(event) =>
                      updateRow(row.slug, "includeCpf", event.target.value)
                    }
                    className="w-full rounded-lg border border-[#f0d2ca] bg-[#ffffff] px-3 py-2 text-sm text-[#251E1F] outline-none"
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </td>
                <td className="border-b border-[#f0d2ca] px-4 py-4">
                  <select
                    value={row.wageType}
                    onChange={(event) =>
                      updateRow(row.slug, "wageType", event.target.value)
                    }
                    className="w-full rounded-lg border border-[#f0d2ca] bg-[#ffffff] px-3 py-2 text-sm text-[#251E1F] outline-none"
                  >
                    <option value="Ordinary Wage">Ordinary Wage</option>
                    <option value="Additional Wage">Additional Wage</option>
                    <option value="Non-CPF">Non-CPF</option>
                  </select>
                </td>
                <td className="border-b border-[#f0d2ca] px-4 py-4">
                  <SettingInput
                    value={row.remarks}
                    onChange={(value) => updateRow(row.slug, "remarks", value)}
                  />
                </td>
                <td className="border-b border-[#f0d2ca] px-4 py-4">
                  <button
                    type="button"
                    className="rounded-xl border border-[#F38978]/25 bg-[#F38978]/10 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#F38978]/20 disabled:cursor-not-allowed disabled:opacity-60"
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
      type:
        settingsByKey[`deduction_component_${row.slug}_type`]?.setting_value ||
        row.type,
      affectsNetPay:
        settingsByKey[`deduction_component_${row.slug}_affects_net_pay`]
          ?.setting_value || row.affectsNetPay,
      affectsCpfWageBase:
        settingsByKey[`deduction_component_${row.slug}_affects_cpf_wage_base`]
          ?.setting_value || row.affectsCpfWageBase,
      remarks:
        settingsByKey[`deduction_component_${row.slug}_remarks`]
          ?.setting_value || row.remarks,
    })),
  );
  const [savingSlug, setSavingSlug] = useState("");

  useEffect(() => {
    setRows(
      deductionComponentRows.map((row) => ({
        ...row,
        type:
          settingsByKey[`deduction_component_${row.slug}_type`]
            ?.setting_value || row.type,
        affectsNetPay:
          settingsByKey[`deduction_component_${row.slug}_affects_net_pay`]
            ?.setting_value || row.affectsNetPay,
        affectsCpfWageBase:
          settingsByKey[`deduction_component_${row.slug}_affects_cpf_wage_base`]
            ?.setting_value || row.affectsCpfWageBase,
        remarks:
          settingsByKey[`deduction_component_${row.slug}_remarks`]
            ?.setting_value || row.remarks,
      })),
    );
  }, [settingsByKey]);

  const updateRow = (slug, field, value) => {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.slug === slug ? { ...row, [field]: value } : row,
      ),
    );
  };

  const saveRow = async (row) => {
    setSavingSlug(row.slug);

    try {
      await Promise.all([
        onSave(`deduction_component_${row.slug}_type`, {
          settingValue: row.type,
          description: `${row.deduction} deduction type.`,
        }),
        onSave(`deduction_component_${row.slug}_affects_net_pay`, {
          settingValue: row.affectsNetPay,
          description: `${row.deduction} affects net pay setting.`,
        }),
        onSave(`deduction_component_${row.slug}_affects_cpf_wage_base`, {
          settingValue: row.affectsCpfWageBase,
          description: `${row.deduction} affects CPF wage base setting.`,
        }),
        onSave(`deduction_component_${row.slug}_remarks`, {
          settingValue: row.remarks,
          description: `${row.deduction} deduction remarks.`,
        }),
      ]);
    } finally {
      setSavingSlug("");
    }
  };

  return (
    <section className="app-panel overflow-hidden rounded-2xl">
      <div className="border-b border-[#f0d2ca] px-5 py-4">
        <h3 className="text-lg font-semibold text-[#251E1F]">
          Deduction Component Classification
        </h3>
        <p className="mt-1 text-sm text-[#7b6660]">
          Define deduction treatment for net pay and CPF wage base validation.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[66rem] w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-[#F38978]/80">
            <tr>
              <th className="border-b border-[#f0d2ca] px-4 py-3">
                Deduction Name
              </th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Type</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">
                Affects Net Pay
              </th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">
                Affects CPF Wage Base
              </th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Remarks</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.slug}>
                <td className="border-b border-[#f0d2ca] px-4 py-4 font-semibold text-[#251E1F]">
                  {row.deduction}
                </td>
                <td className="border-b border-[#f0d2ca] px-4 py-4">
                  <select
                    value={row.type}
                    onChange={(event) =>
                      updateRow(row.slug, "type", event.target.value)
                    }
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
                    onChange={(event) =>
                      updateRow(row.slug, "affectsNetPay", event.target.value)
                    }
                    className="w-full rounded-lg border border-[#f0d2ca] bg-[#ffffff] px-3 py-2 text-sm text-[#251E1F] outline-none"
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </td>
                <td className="border-b border-[#f0d2ca] px-4 py-4">
                  <select
                    value={row.affectsCpfWageBase}
                    onChange={(event) =>
                      updateRow(
                        row.slug,
                        "affectsCpfWageBase",
                        event.target.value,
                      )
                    }
                    className="w-full rounded-lg border border-[#f0d2ca] bg-[#ffffff] px-3 py-2 text-sm text-[#251E1F] outline-none"
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </td>
                <td className="border-b border-[#f0d2ca] px-4 py-4">
                  <SettingInput
                    value={row.remarks}
                    onChange={(value) => updateRow(row.slug, "remarks", value)}
                  />
                </td>
                <td className="border-b border-[#f0d2ca] px-4 py-4">
                  <button
                    type="button"
                    className="rounded-xl border border-[#F38978]/25 bg-[#F38978]/10 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#F38978]/20 disabled:cursor-not-allowed disabled:opacity-60"
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
      type:
        settingsByKey[`employer_contribution_${row.slug}_type`]
          ?.setting_value || row.type,
      basis:
        settingsByKey[`employer_contribution_${row.slug}_basis`]
          ?.setting_value || row.basis,
      remarks:
        settingsByKey[`employer_contribution_${row.slug}_remarks`]
          ?.setting_value || row.remarks,
    })),
  );
  const [savingSlug, setSavingSlug] = useState("");

  useEffect(() => {
    setRows(
      employerContributionRows.map((row) => ({
        ...row,
        type:
          settingsByKey[`employer_contribution_${row.slug}_type`]
            ?.setting_value || row.type,
        basis:
          settingsByKey[`employer_contribution_${row.slug}_basis`]
            ?.setting_value || row.basis,
        remarks:
          settingsByKey[`employer_contribution_${row.slug}_remarks`]
            ?.setting_value || row.remarks,
      })),
    );
  }, [settingsByKey]);

  const updateRow = (slug, field, value) => {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.slug === slug ? { ...row, [field]: value } : row,
      ),
    );
  };

  const saveRow = async (row) => {
    setSavingSlug(row.slug);

    try {
      await Promise.all([
        onSave(`employer_contribution_${row.slug}_type`, {
          settingValue: row.type,
          description: `${row.item} employer contribution type.`,
        }),
        onSave(`employer_contribution_${row.slug}_basis`, {
          settingValue: row.basis,
          description: `${row.item} employer contribution basis.`,
        }),
        onSave(`employer_contribution_${row.slug}_remarks`, {
          settingValue: row.remarks,
          description: `${row.item} employer contribution remarks.`,
        }),
      ]);
    } finally {
      setSavingSlug("");
    }
  };

  return (
    <section className="app-panel overflow-hidden rounded-2xl">
      <div className="border-b border-[#f0d2ca] px-5 py-4">
        <h3 className="text-lg font-semibold text-[#251E1F]">
          Employer Contribution Items
        </h3>
        <p className="mt-1 text-sm text-[#7b6660]">
          Define employer-side statutory and payroll cost items for Finance
          review.
        </p>
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
                <td className="border-b border-[#f0d2ca] px-4 py-4 font-semibold text-[#251E1F]">
                  {row.item}
                </td>
                <td className="border-b border-[#f0d2ca] px-4 py-4">
                  <select
                    value={row.type}
                    onChange={(event) =>
                      updateRow(row.slug, "type", event.target.value)
                    }
                    className="w-full rounded-lg border border-[#f0d2ca] bg-[#ffffff] px-3 py-2 text-sm text-[#251E1F] outline-none"
                  >
                    <option value="Statutory">Statutory</option>
                    <option value="Other">Other</option>
                  </select>
                </td>
                <td className="border-b border-[#f0d2ca] px-4 py-4">
                  <SettingInput
                    value={row.basis}
                    onChange={(value) => updateRow(row.slug, "basis", value)}
                  />
                </td>
                <td className="border-b border-[#f0d2ca] px-4 py-4">
                  <SettingInput
                    value={row.remarks}
                    onChange={(value) => updateRow(row.slug, "remarks", value)}
                  />
                </td>
                <td className="border-b border-[#f0d2ca] px-4 py-4">
                  <button
                    type="button"
                    className="rounded-xl border border-[#F38978]/25 bg-[#F38978]/10 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#F38978]/20 disabled:cursor-not-allowed disabled:opacity-60"
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
  const expectedValue = String(value || "")
    .trim()
    .toLowerCase();

  return users.filter(
    (user) =>
      String(user?.[field] || "")
        .trim()
        .toLowerCase() === expectedValue,
  );
}

function MbmfContributionPanel({ eligibility, onSave, settingsByKey }) {
  const readBands = () => {
    try {
      const parsed = JSON.parse(
        getMbmfValue(
          settingsByKey,
          "mbmf_wage_bands",
          JSON.stringify(mbmfDefaultSettings.bands),
        ),
      );
      return Array.isArray(parsed) && parsed.length
        ? parsed
        : mbmfDefaultSettings.bands;
    } catch (_error) {
      return mbmfDefaultSettings.bands;
    }
  };
  const readVersions = () => {
    try {
      const parsed = JSON.parse(
        getMbmfValue(settingsByKey, "mbmf_wage_band_versions", "[]"),
      );
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  };
  const [form, setForm] = useState(() => ({
    enabled: getMbmfValue(
      settingsByKey,
      "mbmf_enabled",
      mbmfDefaultSettings.enabled,
    ),
    effectiveFrom: getMbmfValue(
      settingsByKey,
      "mbmf_effective_from",
      mbmfDefaultSettings.effectiveFrom,
    ),
    rateType: getMbmfValue(
      settingsByKey,
      "mbmf_rate_type",
      mbmfDefaultSettings.rateType,
    ),
    bands: readBands(),
    versions: readVersions(),
    sourceUrl:
      "https://www.cpf.gov.sg/employer/employer-obligations/contributions-to-self-help-groups",
    changeReason: "",
    employeePayableAccount: getMbmfValue(
      settingsByKey,
      "mbmf_gl_employee_payable_account",
      mbmfDefaultSettings.employeePayableAccount,
    ),
    clearingAccount: getMbmfValue(
      settingsByKey,
      "mbmf_gl_clearing_account",
      mbmfDefaultSettings.clearingAccount,
    ),
    paymentBankAccount: getMbmfValue(
      settingsByKey,
      "mbmf_payment_bank_account",
      mbmfDefaultSettings.paymentBankAccount,
    ),
    applicableReligion: getMbmfValue(
      settingsByKey,
      "mbmf_applicable_religion",
      mbmfDefaultSettings.applicableReligion,
    ),
  }));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setForm({
      enabled: getMbmfValue(
        settingsByKey,
        "mbmf_enabled",
        mbmfDefaultSettings.enabled,
      ),
      effectiveFrom: getMbmfValue(
        settingsByKey,
        "mbmf_effective_from",
        mbmfDefaultSettings.effectiveFrom,
      ),
      rateType: getMbmfValue(
        settingsByKey,
        "mbmf_rate_type",
        mbmfDefaultSettings.rateType,
      ),
      bands: readBands(),
      versions: readVersions(),
      sourceUrl: getMbmfValue(
        settingsByKey,
        "mbmf_source_url",
        "https://www.cpf.gov.sg/employer/employer-obligations/contributions-to-self-help-groups",
      ),
      changeReason: "",
      employeePayableAccount: getMbmfValue(
        settingsByKey,
        "mbmf_gl_employee_payable_account",
        mbmfDefaultSettings.employeePayableAccount,
      ),
      clearingAccount: getMbmfValue(
        settingsByKey,
        "mbmf_gl_clearing_account",
        mbmfDefaultSettings.clearingAccount,
      ),
      paymentBankAccount: getMbmfValue(
        settingsByKey,
        "mbmf_payment_bank_account",
        mbmfDefaultSettings.paymentBankAccount,
      ),
      applicableReligion: getMbmfValue(
        settingsByKey,
        "mbmf_applicable_religion",
        mbmfDefaultSettings.applicableReligion,
      ),
    });
  }, [settingsByKey]);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };
  const updateBand = (index, field, value) => {
    setForm((current) => ({
      ...current,
      bands: current.bands.map((band, bandIndex) =>
        bandIndex === index
          ? [
              field === "maximum"
                ? value === ""
                  ? null
                  : Number(value)
                : band[0],
              field === "amount" ? Number(value) : band[1],
            ]
          : band,
      ),
    }));
  };
  const validationErrors = (() => {
    const errors = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.effectiveFrom))
      errors.push("Enter a valid effective date.");
    if (!form.changeReason.trim())
      errors.push("Enter the government announcement or change reason.");
    try {
      new URL(form.sourceUrl);
    } catch (_error) {
      errors.push("Enter a valid government source URL.");
    }
    if (form.bands.length < 2)
      errors.push("At least two wage bands are required.");
    form.bands.forEach(([maximumWage, amount], index) => {
      if (Number(amount) < 0 || !Number.isFinite(Number(amount)))
        errors.push(`Band ${index + 1} needs a valid non-negative amount.`);
      if (
        index < form.bands.length - 1 &&
        (!Number.isFinite(Number(maximumWage)) ||
          Number(maximumWage) <= Number(form.bands[index - 1]?.[0] || 0))
      )
        errors.push(`Band ${index + 1} needs an increasing upper wage limit.`);
    });
    if (form.bands.at(-1)?.[0] !== null)
      errors.push("The final wage band must be open-ended.");
    if (
      form.versions.some(
        (version) =>
          String(version.effectiveFrom).slice(0, 10) === form.effectiveFrom,
      )
    )
      errors.push(
        "A saved MBMF version already uses this effective date. Choose a new date.",
      );
    return [...new Set(errors)];
  })();
  const examples = [4000, 7000, 9500].map((grossSalary) => {
    const band = form.bands.find(
      ([maximumWage]) =>
        maximumWage === null || grossSalary <= Number(maximumWage),
    );
    const employeeAmount = Number(band?.[1] || 0);

    return {
      grossSalary,
      employeeAmount,
      total: employeeAmount,
    };
  });

  const saveMbmfSettings = async () => {
    if (validationErrors.length) return;
    setIsSaving(true);

    try {
      const nextVersion = {
        effectiveFrom: form.effectiveFrom,
        bands: form.bands,
        sourceUrl: form.sourceUrl.trim(),
        reason: form.changeReason.trim(),
      };
      const versions = [...form.versions, nextVersion].sort((a, b) =>
        String(a.effectiveFrom).localeCompare(String(b.effectiveFrom)),
      );
      await Promise.all([
        onSave("mbmf_enabled", {
          settingValue: form.enabled,
          description:
            "Enable MBMF contribution for eligible Muslim employees.",
        }),
        onSave("mbmf_applicable_religion", {
          settingValue: form.applicableReligion,
          description:
            "Religion value that makes an employee eligible for MBMF.",
        }),
        onSave("mbmf_effective_from", {
          settingValue: form.effectiveFrom,
          description: "MBMF contribution effective date.",
        }),
        onSave("mbmf_rate_type", {
          settingValue: form.rateType,
          description: "MBMF contribution rate type.",
        }),
        onSave("mbmf_wage_bands", {
          settingValue: JSON.stringify(form.bands),
          description:
            "Official MBMF employee contribution bands by monthly total wages.",
          effectiveFrom: form.effectiveFrom,
          ruleCategory: "Community Funds",
          usageType: "calculation",
        }),
        onSave("mbmf_wage_band_versions", {
          settingValue: JSON.stringify(versions),
          description: "Effective-dated MBMF contribution schedules.",
          effectiveFrom: form.effectiveFrom,
          ruleCategory: "Community Funds",
          usageType: "calculation",
        }),
        onSave("mbmf_source_url", {
          settingValue: form.sourceUrl.trim(),
          description: "Government source for the latest MBMF schedule.",
        }),
        onSave("mbmf_change_reason", {
          settingValue: form.changeReason.trim(),
          description: "Reason for the latest MBMF schedule version.",
        }),
        onSave("mbmf_gl_employee_payable_account", {
          settingValue: form.employeePayableAccount,
          description: "MBMF employee payable GL account.",
        }),
        onSave("mbmf_gl_clearing_account", {
          settingValue: form.clearingAccount,
          description: "MBMF payable clearing GL account.",
        }),
        onSave("mbmf_payment_bank_account", {
          settingValue: form.paymentBankAccount,
          description: "MBMF payment bank account.",
        }),
      ]);
      setForm((current) => ({ ...current, versions, changeReason: "" }));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-[#251E1F]">
          MBMF Contribution Rules
        </h3>
        <p className="mt-1 text-sm text-[#7b6660]">
          Configure MBMF so payroll applies it only to employees whose staff
          religion is Muslim.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <section className="app-panel rounded-2xl p-5">
              <h4 className="font-semibold text-[#251E1F]">1. Enable MBMF</h4>
              <div className="mt-5 flex items-center justify-between gap-3">
                <span className="text-sm text-[#7b6660]">
                  Enable MBMF Contribution
                </span>
                <select
                  value={form.enabled}
                  onChange={(event) =>
                    updateForm("enabled", event.target.value)
                  }
                  className="rounded-lg border border-[#f0d2ca] bg-[#ffffff] px-3 py-2 text-sm text-[#251E1F] outline-none"
                >
                  <option value="Enabled">Enabled</option>
                  <option value="Disabled">Disabled</option>
                </select>
              </div>
              <p className="mt-4 rounded-xl border border-[#2D7C83]/25 bg-[#2D7C83]/10 p-3 text-sm text-[#2D7C83]">
                MBMF is calculated only for employees with religion set to{" "}
                {form.applicableReligion}.
              </p>
            </section>

            <section className="app-panel rounded-2xl p-5">
              <h4 className="font-semibold text-[#251E1F]">2. Rule details</h4>
              <div className="mt-4 space-y-3">
                <label className="block text-sm text-[#7b6660]">
                  Effective from
                </label>
                <SettingInput
                  value={form.effectiveFrom}
                  onChange={(value) => updateForm("effectiveFrom", value)}
                  placeholder="2016-06-01"
                />
                <div className="rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-sm text-[#251E1F]">
                  Fixed amount by monthly total-wage band
                </div>
                <p className="text-xs text-[#7b6660]">
                  MBMF is entirely deducted from the employee. There is no
                  employer contribution.
                </p>
              </div>
            </section>

            <section className="app-panel rounded-2xl p-5">
              <h4 className="font-semibold text-[#251E1F]">
                3. Official wage bands
              </h4>
              <div className="mt-4 max-h-52 space-y-2 overflow-y-auto pr-1 text-sm">
                {form.bands.map(([maximumWage, amount], index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[1fr_0.8fr_auto] items-center gap-2 rounded-lg border border-[#f0d2ca] bg-white/80 p-2"
                  >
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={maximumWage ?? ""}
                      disabled={index === form.bands.length - 1}
                      onChange={(event) =>
                        updateBand(index, "maximum", event.target.value)
                      }
                      placeholder="No upper limit"
                      aria-label={`Band ${index + 1} maximum wage`}
                      className="min-w-0 rounded-md border border-[#f0d2ca] px-2 py-1.5 disabled:bg-[#f8f2f0]"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={(event) =>
                        updateBand(index, "amount", event.target.value)
                      }
                      aria-label={`Band ${index + 1} contribution`}
                      className="min-w-0 rounded-md border border-[#f0d2ca] px-2 py-1.5"
                    />
                    <button
                      type="button"
                      disabled={form.bands.length <= 2}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          bands: current.bands.filter(
                            (_, bandIndex) => bandIndex !== index,
                          ),
                        }))
                      }
                      className="rounded-md px-2 py-1 text-[#b64646] disabled:opacity-30"
                      aria-label={`Remove band ${index + 1}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      bands: [
                        ...current.bands.slice(0, -1),
                        [Number(current.bands.at(-2)?.[0] || 0) + 1000, 0],
                        current.bands.at(-1),
                      ],
                    }))
                  }
                  className="rounded-lg border border-[#2D7C83]/25 px-3 py-1.5 text-xs font-semibold text-[#2D7C83]"
                >
                  Add band
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      bands: mbmfDefaultSettings.bands,
                    }))
                  }
                  className="rounded-lg border border-[#f0d2ca] px-3 py-1.5 text-xs font-semibold text-[#7b6660]"
                >
                  Restore official defaults
                </button>
              </div>
              <p className="mt-3 text-xs text-[#7b6660]">
                Left: upper monthly wage limit. Right: employee contribution.
                The final row is always open-ended.
              </p>
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
            <section className="app-panel rounded-2xl p-5">
              <h4 className="font-semibold text-[#251E1F]">
                4. Map GL Accounts
              </h4>
              <div className="mt-4 grid gap-3">
                <SettingInput
                  value={form.employeePayableAccount}
                  onChange={(value) =>
                    updateForm("employeePayableAccount", value)
                  }
                />
                <SettingInput
                  value={form.clearingAccount}
                  onChange={(value) => updateForm("clearingAccount", value)}
                />
                <SettingInput
                  value={form.paymentBankAccount}
                  onChange={(value) => updateForm("paymentBankAccount", value)}
                />
              </div>
            </section>

            <section className="app-panel rounded-2xl p-5">
              <h4 className="font-semibold text-[#251E1F]">5. Save & Apply</h4>
              <div className="mt-4 rounded-xl border border-[#2f8758]/25 bg-[#2f8758]/10 p-4 text-sm text-[#2D7C83]">
                Saved MBMF settings are applied to eligible Muslim employees
                only.
              </div>
              <label className="mt-4 block text-xs font-semibold uppercase text-[#7b6660]">
                Government source URL
              </label>
              <input
                value={form.sourceUrl}
                onChange={(event) =>
                  updateForm("sourceUrl", event.target.value)
                }
                className="mt-1 w-full rounded-lg border border-[#f0d2ca] px-3 py-2 text-sm"
                placeholder="https://..."
              />
              <label className="mt-3 block text-xs font-semibold uppercase text-[#7b6660]">
                Change reason
              </label>
              <textarea
                value={form.changeReason}
                onChange={(event) =>
                  updateForm("changeReason", event.target.value)
                }
                className="mt-1 min-h-20 w-full rounded-lg border border-[#f0d2ca] px-3 py-2 text-sm"
                placeholder="Example: Government rates announced for 1 January 2027"
              />
              {validationErrors.length ? (
                <ul className="mt-3 space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                  {validationErrors.map((error) => (
                    <li key={error}>• {error}</li>
                  ))}
                </ul>
              ) : null}
              <button
                type="button"
                className="mt-5 rounded-xl border border-[#F38978]/25 bg-[#F38978]/10 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#F38978]/20 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={saveMbmfSettings}
                disabled={isSaving || validationErrors.length > 0}
              >
                {isSaving ? "Saving..." : "Save MBMF Settings"}
              </button>
            </section>
          </div>

          <section className="app-panel overflow-hidden rounded-2xl">
            <div className="border-b border-[#f0d2ca] px-5 py-4">
              <h4 className="font-semibold text-[#251E1F]">
                Contribution Calculation Example
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[52rem] w-full border-separate border-spacing-0 text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-[#F38978]/80">
                  <tr>
                    <th className="border-b border-[#f0d2ca] px-4 py-3">
                      Gross Salary
                    </th>
                    <th className="border-b border-[#f0d2ca] px-4 py-3">
                      Employee
                    </th>
                    <th className="border-b border-[#f0d2ca] px-4 py-3">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {examples.map((example) => (
                    <tr key={example.grossSalary}>
                      <td className="border-b border-[#f0d2ca] px-4 py-3 text-[#251E1F]">
                        {formatMoney(example.grossSalary)}
                      </td>
                      <td className="border-b border-[#f0d2ca] px-4 py-3 text-[#7b6660]">
                        {formatMoney(example.employeeAmount)}
                      </td>
                      <td className="border-b border-[#f0d2ca] px-4 py-3 font-semibold text-[#251E1F]">
                        {formatMoney(example.total)}
                      </td>
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
              <p className="text-sm font-semibold text-[#251E1F]">
                Applicable To
              </p>
              <p className="mt-1 text-sm text-[#7b6660]">
                All employees where staff.religion = {form.applicableReligion}
              </p>
            </div>
            <div className="mt-4 grid gap-3 text-sm">
              <div className="flex items-center justify-between rounded-xl border border-[#f0d2ca] bg-white/80 px-4 py-3">
                <span className="text-[#7b6660]">Total Staff</span>
                <span className="font-semibold text-[#251E1F]">
                  {eligibility?.totalStaff ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-[#f0d2ca] bg-white/80 px-4 py-3">
                <span className="text-[#7b6660]">
                  Eligible {form.applicableReligion} Staff
                </span>
                <span className="font-semibold text-[#2f8758]">
                  {eligibility?.eligibleMuslimEmployees ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-[#f0d2ca] bg-white/80 px-4 py-3">
                <span className="text-[#7b6660]">Not Applied</span>
                <span className="font-semibold text-[#251E1F]">
                  {eligibility?.nonEligibleEmployees ?? 0}
                </span>
              </div>
            </div>
            {!eligibility?.hasReligionColumn ? (
              <p className="mt-4 rounded-xl border border-[#D97706]/25 bg-[#D97706]/10 p-3 text-sm text-[#9A6412]">
                Add a religion column to the staff table so the system can
                identify Muslim employees.
              </p>
            ) : null}
            {eligibility?.sampleEmployees?.length ? (
              <div className="mt-4 rounded-xl border border-[#f0d2ca] bg-white/80 p-4">
                <p className="text-sm font-semibold text-[#251E1F]">
                  Eligible Staff Preview
                </p>
                <div className="mt-3 space-y-2 text-sm text-[#7b6660]">
                  {eligibility.sampleEmployees.map((employee) => (
                    <div
                      key={employee.employee_id}
                      className="flex items-center justify-between gap-3"
                    >
                      <span>
                        {employee.name ||
                          employee.employee_code ||
                          `Employee ${employee.employee_id}`}
                      </span>
                      <span className="font-semibold text-[#251E1F]">
                        {employee.religion}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="app-panel rounded-2xl p-5">
            <h4 className="font-semibold text-[#251E1F]">Process Flow</h4>
            <ol className="mt-4 space-y-3 text-sm text-[#7b6660]">
              <li>
                1. Payroll reads staff religion from the employee database.
              </li>
              <li>2. MBMF is calculated only when religion is Muslim.</li>
              <li>3. Non-Muslim employees are skipped automatically.</li>
              <li>
                4. The fixed contribution is deducted from the employee only.
              </li>
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
        <h3 className="text-lg font-semibold text-[#251E1F]">
          Wage Ceiling History
        </h3>
        <div className="mt-4 space-y-3">
          {cpfCeilingHistory.map(([effectiveFrom, ceiling]) => (
            <div
              key={effectiveFrom}
              className="flex items-center justify-between rounded-xl border border-[#f0d2ca] bg-white/80 px-4 py-3 text-sm"
            >
              <span className="text-[#7b6660]">{effectiveFrom}</span>
              <span className="font-semibold text-[#251E1F]">
                SGD {ceiling}
              </span>
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
  const communityFundConfigs = selfHelpGroupConfigs.filter(
    (scheme) => scheme.key !== "mbmf",
  );
  const [rows, setRows] = useState(() =>
    communityFundConfigs.map((scheme) => ({
      ...scheme,
      enabled: getSchemeValue(settingsByKey, scheme.key, "enabled", "Enabled"),
      effectiveFrom: getSchemeValue(
        settingsByKey,
        scheme.key,
        "effective_from",
        "2026-01-01",
      ),
      eligibilityValue: getSchemeValue(
        settingsByKey,
        scheme.key,
        `applicable_${scheme.eligibilityField}`,
        scheme.eligibilityValue,
      ),
      contributionRule: getSchemeValue(
        settingsByKey,
        scheme.key,
        "contribution_rule",
        "Apply current CPF Board contribution table",
      ),
      payableAccount: getSchemeValue(
        settingsByKey,
        scheme.key,
        "payable_account",
        `21${scheme.key.length}0 - ${scheme.label} Payable`,
      ),
    })),
  );
  const [savingKey, setSavingKey] = useState("");

  useEffect(() => {
    setRows(
      communityFundConfigs.map((scheme) => ({
        ...scheme,
        enabled: getSchemeValue(
          settingsByKey,
          scheme.key,
          "enabled",
          "Enabled",
        ),
        effectiveFrom: getSchemeValue(
          settingsByKey,
          scheme.key,
          "effective_from",
          "2026-01-01",
        ),
        eligibilityValue: getSchemeValue(
          settingsByKey,
          scheme.key,
          `applicable_${scheme.eligibilityField}`,
          scheme.eligibilityValue,
        ),
        contributionRule: getSchemeValue(
          settingsByKey,
          scheme.key,
          "contribution_rule",
          "Apply current CPF Board contribution table",
        ),
        payableAccount: getSchemeValue(
          settingsByKey,
          scheme.key,
          "payable_account",
          `21${scheme.key.length}0 - ${scheme.label} Payable`,
        ),
      })),
    );
  }, [settingsByKey]);

  const updateRow = (schemeKey, field, value) => {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.key === schemeKey ? { ...row, [field]: value } : row,
      ),
    );
  };

  const saveRow = async (row) => {
    setSavingKey(row.key);

    try {
      await Promise.all([
        onSave(`${row.key}_enabled`, {
          settingValue: row.enabled,
          description: `${row.label} contribution enabled setting.`,
        }),
        onSave(`${row.key}_effective_from`, {
          settingValue: row.effectiveFrom,
          description: `${row.label} contribution effective date.`,
        }),
        onSave(`${row.key}_applicable_${row.eligibilityField}`, {
          settingValue: row.eligibilityValue,
          description: `${row.label} eligibility ${row.eligibilityField}.`,
        }),
        onSave(`${row.key}_contribution_rule`, {
          settingValue: row.contributionRule,
          description: `${row.label} contribution rule.`,
        }),
        onSave(`${row.key}_payable_account`, {
          settingValue: row.payableAccount,
          description: `${row.label} payable account mapping.`,
        }),
      ]);
    } finally {
      setSavingKey("");
    }
  };

  return (
    <section className="app-panel overflow-hidden rounded-2xl">
      <div className="border-b border-[#f0d2ca] px-5 py-4">
        <h3 className="text-lg font-semibold text-[#251E1F]">
          Community Fund Contribution Rules
        </h3>
        <p className="mt-1 text-sm text-[#7b6660]">
          Configure CDAC, SINDA and ECF using staff race fields. MBMF remains in
          its dedicated religion-based panel.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[82rem] w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-[#F38978]/80">
            <tr>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Scheme</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Enabled</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">
                Effective From
              </th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">
                Eligibility
              </th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">
                Eligible Staff
              </th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Rule</th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">
                Payable Account
              </th>
              <th className="border-b border-[#f0d2ca] px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const eligibleUsers = getEligibleUsers(
                users,
                row.eligibilityField,
                row.eligibilityValue,
              );

              return (
                <tr key={row.key}>
                  <td className="border-b border-[#f0d2ca] px-4 py-4">
                    <p className="font-semibold text-[#251E1F]">{row.label}</p>
                    <p className="mt-1 text-xs text-[#7b6660]">
                      {row.description}
                    </p>
                  </td>
                  <td className="border-b border-[#f0d2ca] px-4 py-4">
                    <select
                      value={row.enabled}
                      onChange={(event) =>
                        updateRow(row.key, "enabled", event.target.value)
                      }
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
                      onChange={(event) =>
                        updateRow(row.key, "effectiveFrom", event.target.value)
                      }
                      className="w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-sm text-[#251E1F] outline-none"
                    />
                  </td>
                  <td className="border-b border-[#f0d2ca] px-4 py-4">
                    <SettingInput
                      value={row.eligibilityValue}
                      onChange={(value) =>
                        updateRow(row.key, "eligibilityValue", value)
                      }
                      placeholder={row.eligibilityField}
                    />
                    <p className="mt-1 text-xs text-[#7b6660]/80">
                      staff.{row.eligibilityField}
                    </p>
                  </td>
                  <td className="border-b border-[#f0d2ca] px-4 py-4 text-[#7b6660]">
                    <span className="font-semibold text-[#251E1F]">
                      {eligibleUsers.length}
                    </span>{" "}
                    staff
                  </td>
                  <td className="border-b border-[#f0d2ca] px-4 py-4">
                    <SettingInput
                      value={row.contributionRule}
                      onChange={(value) =>
                        updateRow(row.key, "contributionRule", value)
                      }
                    />
                  </td>
                  <td className="border-b border-[#f0d2ca] px-4 py-4">
                    <SettingInput
                      value={row.payableAccount}
                      onChange={(value) =>
                        updateRow(row.key, "payableAccount", value)
                      }
                    />
                  </td>
                  <td className="border-b border-[#f0d2ca] px-4 py-4">
                    <button
                      type="button"
                      className="rounded-xl border border-[#F38978]/25 bg-[#F38978]/10 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#F38978]/20 disabled:cursor-not-allowed disabled:opacity-60"
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

function SettingsView({
  mbmfEligibility,
  onUpdateSetting,
  settings = [],
  users = [],
}) {
  const settingsByKey = useMemo(() => buildSettingsByKey(settings), [settings]);
  const testAppliedRules = () => {
    const config = resolveFinancePayrollConfig(settings);
    window.alert(
      `Applied payroll rules check\n\nCPF wage ceiling: SGD ${config.monthlyWageCeiling.toFixed(2)}\nCPF age tiers: ${config.rateTiers.length}\nBank details required: ${config.compliance.bankAccountEnabled ? "Yes" : "No"}\nDepartment required: ${config.compliance.departmentEnabled ? "Yes" : "No"}\nMaximum other deductions: ${config.compliance.maxOtherDeductionPercent}%\n\nThese settings will be applied to newly generated payroll runs.`,
    );
  };

  return (
    <PageShell
      heading="Payroll Configuration"
      updatedAt={getLatestTimestamp(settings)}
      actions={
        <>
          <ActionButton
            icon={Settings}
            onClick={() =>
              document
                .getElementById("payroll-settings-start")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Configuration Sections
          </ActionButton>
          <ActionButton
            icon={PlayCircle}
            variant="secondary"
            onClick={testAppliedRules}
          >
            Preview Effective Payroll Rules
          </ActionButton>
        </>
      }
    >
      <div id="payroll-settings-start" className="space-y-8">
        <section className="app-panel rounded-2xl p-5">
          <h3 className="text-lg font-semibold text-[#251E1F]">
            Configuration Overview
          </h3>
          <p className="mt-1 text-sm text-[#7b6660]">
            CPF rates, wage ceilings, SDL and self-help fund rules are managed
            in Compliance Rules.
          </p>
        </section>
        <SettingsSection
          definitions={cpfAccountMappings}
          settingsByKey={settingsByKey}
          title="CPF Accounting Reference Mappings"
          subtitle="Maintain reference accounts for future accounting and journal integrations. These values do not post journals by themselves."
          onSave={onUpdateSetting}
        />
        <SettingsSection
          definitions={otherCpfSettings}
          settingsByKey={settingsByKey}
          title="CPF Payment & Submission Controls"
          subtitle="Maintain operational references for CPF payment, reminder and submission tracking."
          onSave={onUpdateSetting}
        />
      </div>
    </PageShell>
  );
}

function ComplianceRulesView({
  mbmfEligibility,
  onRulesPublished,
  settings = [],
  users = [],
}) {
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [reviewing, setReviewing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [changeReason, setChangeReason] = useState("");
  const [referenceTitle, setReferenceTitle] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [draftError, setDraftError] = useState("");
  const settingsByKey = useMemo(() => buildSettingsByKey(settings), [settings]);
  const stageSetting = async (settingKey, payload) => {
    if (!editing) return;
    const existing = settings.find((item) => item.setting_key === settingKey);
    setDrafts((current) => ({
      ...current,
      [settingKey]: {
        ...payload,
        settingKey,
        beforeValue: existing?.setting_value ?? null,
        referenceTitle:
          payload.referenceTitle || existing?.reference_title || "",
        referenceUrl: payload.referenceUrl || existing?.reference_url || "",
        effectiveFrom:
          payload.effectiveFrom ||
          existing?.effective_from ||
          new Date().toISOString().slice(0, 10),
      },
    }));
    setDraftError("");
  };
  const draftList = Object.values(drafts);
  const publishDraft = async () => {
    if (!changeReason.trim())
      return setDraftError("Enter a reason for this rule publication.");
    try {
      setPublishing(true);
      setDraftError("");
      const enriched = draftList.map((item) => ({
        ...item,
        referenceTitle: item.referenceTitle || referenceTitle,
        referenceUrl: item.referenceUrl || referenceUrl,
      }));
      await onRulesPublished(enriched, changeReason);
      setDrafts({});
      setEditing(false);
      setReviewing(false);
      setChangeReason("");
      setReferenceTitle("");
      setReferenceUrl("");
    } catch (error) {
      setDraftError(error.message);
    } finally {
      setPublishing(false);
    }
  };
  const complianceUpdates = [
    {
      label: "CPF rates",
      value: "SC/SPR 3rd year onward, effective 01 Jan 2026",
      updatedAt: getLatestTimestamp(
        settings.filter((setting) =>
          setting.setting_key.startsWith("cpf_rate_"),
        ),
      ),
      cardClass: "compliance-summary--purple",
    },
    {
      label: "CPF wage ceiling",
      value: "Ordinary Wage ceiling SGD 8,000 from 01 Jan 2026",
      updatedAt: getLatestTimestamp(
        settings.filter((setting) =>
          setting.setting_key.includes("cpf_wage_ceiling"),
        ),
      ),
      cardClass: "compliance-summary--blue",
    },
    {
      label: "SDL",
      value: "0.25% of remuneration, min SGD 2 and max SGD 11.25 monthly",
      updatedAt: getLatestTimestamp(
        settings.filter(
          (setting) =>
            setting.setting_key.includes("sdl") ||
            setting.setting_key.includes("employer_contribution_sdl"),
        ),
      ),
      cardClass: "compliance-summary--green",
    },
    {
      label: "Foreign worker levy",
      value: "Managed by MOM sector, quota and worker type",
      updatedAt: getLatestTimestamp(
        settings.filter((setting) =>
          setting.setting_key.includes("foreign_worker_levy"),
        ),
      ),
      cardClass: "compliance-summary--amber",
    },
    {
      label: "Self-help groups",
      value: "MBMF, CDAC, SINDA and ECF by staff religion/race",
      updatedAt: getLatestTimestamp(
        settings.filter((setting) =>
          ["mbmf_", "cdac_", "sinda_", "ecf_"].some((prefix) =>
            setting.setting_key.startsWith(prefix),
          ),
        ),
      ),
      cardClass: "compliance-summary--teal",
    },
    {
      label: "IRAS reporting",
      value: "AIS employment income and IR21 tax clearance tracking",
      updatedAt: getLatestTimestamp(
        settings.filter(
          (setting) =>
            setting.setting_key.startsWith("iras_") ||
            setting.setting_key.startsWith("ir21_"),
        ),
      ),
      cardClass: "compliance-summary--coral",
    },
  ];
  const testAppliedRules = () => {
    const config = resolveFinancePayrollConfig(settings);
    const tierSummary = config.rateTiers
      .map(
        (tier) =>
          `${tier.ageGroup}: ${tier.employeeOrdinaryRate}% employee / ${tier.employerOrdinaryRate}% employer`,
      )
      .join("\n");
    window.alert(
      `Applied Singapore payroll rules\n\n${tierSummary}\n\nCPF ceiling: SGD ${config.monthlyWageCeiling.toFixed(2)} from ${config.effectiveFrom}\nSDL: ${config.compliance.sdlEnabled ? "Enabled" : "Disabled"}\nMBMF: ${config.mbmf.enabled ? "Enabled" : "Disabled"}\n\nThe active values are used for new payroll calculations.`,
    );
  };

  return (
    <PageShell
      heading="Compliance Rules"
      updatedAt={getLatestTimestamp(settings)}
      actions={
        <>
          {!editing ? (
            <ActionButton icon={Settings} onClick={() => setEditing(true)}>
              Configure rules
            </ActionButton>
          ) : (
            <>
              <ActionButton
                icon={X}
                variant="secondary"
                onClick={() => {
                  setEditing(false);
                  setDrafts({});
                  setDraftError("");
                }}
              >
                Cancel draft
              </ActionButton>
              <ActionButton
                icon={ShieldCheck}
                disabled={!draftList.length}
                onClick={() => setReviewing(true)}
              >
                Review {draftList.length || ""} change(s)
              </ActionButton>
            </>
          )}
          <ActionButton
            icon={PlayCircle}
            variant="secondary"
            onClick={testAppliedRules}
          >
            Preview Effective Payroll Rules
          </ActionButton>
        </>
      }
    >
      <div id="compliance-rules-start" className="space-y-8">
        <section className="app-panel rounded-2xl p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[#251E1F]">
                Singapore Payroll Compliance Baseline
              </h3>
              <p className="mt-1 text-sm text-[#7b6660]">
                Published values are locked by default. Use Configure rules to
                create a reviewed, atomic change set.
              </p>
            </div>
            <p className="text-sm font-semibold text-[#F38978]">
              Verified for 2026 payroll periods
            </p>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {complianceUpdates.map((item) => (
              <div
                key={item.label}
                className={`compliance-summary ${item.cardClass}`}
              >
                <p className="text-sm font-semibold text-[#251E1F]">
                  {item.label}
                </p>
                <p className="mt-2 text-xs leading-5 text-[#7b6660]">
                  {item.value}
                </p>
                <p className="mt-3 text-xs font-semibold text-[#F38978]">
                  {item.updatedAt
                    ? `Edited ${formatDateTime(item.updatedAt)}`
                    : "Using default rule"}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div
          className={`space-y-8 ${!editing ? "pointer-events-none select-none opacity-70" : ""}`}
          aria-disabled={!editing}
        >
          <CpfRateTable settingsByKey={settingsByKey} onSave={stageSetting} />
          <CpfCeilingPanel
            settingsByKey={settingsByKey}
            onSave={stageSetting}
          />
          <CustomComplianceRulesPanel
            settings={settings}
            onSave={stageSetting}
          />
          <SelfHelpGroupRulesPanel
            settingsByKey={settingsByKey}
            users={users}
            onSave={stageSetting}
          />
          <WageComponentTable
            settingsByKey={settingsByKey}
            onSave={stageSetting}
          />
          <DeductionComponentTable
            settingsByKey={settingsByKey}
            onSave={stageSetting}
          />
          <EmployerContributionTable
            settingsByKey={settingsByKey}
            onSave={stageSetting}
          />
          <SettingsSection
            definitions={statutorySchemeSettings}
            settingsByKey={settingsByKey}
            title="Singapore Statutory Scheme Settings"
            subtitle="Configure SDL, Foreign Worker Levy, IRAS AIS and IR21 tracking settings for payroll administration."
            onSave={stageSetting}
          />
          <MbmfContributionPanel
            eligibility={mbmfEligibility}
            settingsByKey={settingsByKey}
            onSave={stageSetting}
          />
        </div>
      </div>
      {reviewing ? (
        <div
          className="fixed inset-0 z-[1300] flex items-center justify-center bg-[#251E1F]/55 p-4"
          role="dialog"
          aria-modal="true"
        >
          <section className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#F38978]">
                  Review before publication
                </p>
                <h3 className="mt-1 text-xl font-semibold">
                  Publish {draftList.length} payroll rule change(s)
                </h3>
              </div>
              <button onClick={() => setReviewing(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="mt-4 max-h-56 overflow-y-auto rounded-xl border border-[#f0d2ca]">
              {draftList.map((item) => (
                <div
                  key={item.settingKey}
                  className="grid gap-2 border-b border-[#f0d2ca] p-3 text-sm md:grid-cols-[1fr_1fr_1fr]"
                >
                  <strong className="capitalize">
                    {item.settingKey.replaceAll("_", " ")}
                  </strong>
                  <span className="text-[#7b6660]">
                    Before: {String(item.beforeValue ?? "Not configured")}
                  </span>
                  <span className="text-[#2D7C83]">
                    After: {String(item.settingValue)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-sm font-semibold">
                Reference title
                <input
                  value={referenceTitle}
                  onChange={(e) => setReferenceTitle(e.target.value)}
                  placeholder="e.g. CPF Board contribution rates"
                  className="mt-1 w-full rounded-xl border border-[#f0d2ca] px-3 py-2"
                />
              </label>
              <label className="text-sm font-semibold">
                HTTPS reference URL
                <input
                  value={referenceUrl}
                  onChange={(e) => setReferenceUrl(e.target.value)}
                  placeholder="https://www.cpf.gov.sg/..."
                  className="mt-1 w-full rounded-xl border border-[#f0d2ca] px-3 py-2"
                />
              </label>
            </div>
            <label className="mt-3 block text-sm font-semibold">
              Change reason
              <textarea
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="Explain why these published rules are changing"
                className="mt-1 min-h-20 w-full rounded-xl border border-[#f0d2ca] px-3 py-2"
              />
            </label>
            {draftError ? (
              <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {draftError}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setReviewing(false)}
                className="rounded-xl border border-[#f0d2ca] px-4 py-2 text-sm font-semibold"
              >
                Back to draft
              </button>
              <button
                disabled={publishing}
                onClick={publishDraft}
                className="inline-flex items-center gap-2 rounded-xl bg-[#F38978] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {publishing ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <ShieldCheck size={16} />
                )}{" "}
                {publishing ? "Publishing transaction…" : "Confirm and publish"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
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
    title: "",
  };
  const customRules = useMemo(
    () =>
      settings
        .filter((setting) =>
          setting.setting_key.startsWith("custom_compliance_rule_"),
        )
        .map(parseCustomComplianceRule)
        .sort(
          (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0),
        ),
    [settings],
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
      effectiveFrom:
        rule.effectiveFrom || new Date().toISOString().slice(0, 10),
      ruleText: rule.ruleText,
      source: rule.source,
      status: rule.status,
      title: rule.title,
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
      const settingKey =
        editingKey || `custom_compliance_rule_${slugify(title)}_${Date.now()}`;

      await onSave(settingKey, {
        settingValue: JSON.stringify({
          category: form.category.trim() || "Payroll Compliance",
          effectiveFrom: form.effectiveFrom,
          ruleText,
          source: form.source.trim(),
          status: form.status,
          title,
        }),
        description: `Custom compliance rule: ${title}`,
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
          <h3 className="text-lg font-semibold text-[#251E1F]">
            Custom Compliance Rules
          </h3>
          <p className="mt-1 text-sm text-[#7b6660]">
            Add company-specific payroll compliance references and keep their
            effective dates visible.
          </p>
          <span className="setting-usage setting-usage--reference">
            Operational reference only
          </span>
        </div>
        <p className="text-sm font-semibold text-[#F38978]">
          {customRules.length} custom rule(s)
        </p>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-[#f0d2ca] bg-white/80 p-5">
          <h4 className="font-semibold text-[#251E1F]">
            {editingKey ? "Edit Rule" : "Add Rule"}
          </h4>
          <div className="mt-4 grid gap-3">
            <SettingInput
              value={form.title}
              onChange={(value) => updateForm("title", value)}
              placeholder="Rule title"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <SettingInput
                value={form.category}
                onChange={(value) => updateForm("category", value)}
                placeholder="Category"
              />
              <input
                type="date"
                value={form.effectiveFrom}
                onChange={(event) =>
                  updateForm("effectiveFrom", event.target.value)
                }
                className="w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#F38978]/50"
              />
            </div>
            <textarea
              value={form.ruleText}
              onChange={(event) => updateForm("ruleText", event.target.value)}
              placeholder="Rule details"
              rows={5}
              className="w-full resize-y rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-sm text-[#251E1F] outline-none placeholder:text-[#7b6660]/50 focus:border-[#F38978]/50"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <SettingInput
                value={form.source}
                onChange={(value) => updateForm("source", value)}
                placeholder="Source or reference"
              />
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
                className="rounded-xl border border-[#F38978]/25 bg-[#F38978]/10 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#F38978]/20 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={saveRule}
                disabled={
                  isSaving || !form.title.trim() || !form.ruleText.trim()
                }
              >
                {isSaving ? "Saving..." : editingKey ? "Save Rule" : "Add Rule"}
              </button>
              {editingKey ? (
                <button
                  type="button"
                  className="rounded-xl border border-[#f0d2ca] bg-white/80 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/45"
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
              <article
                key={rule.settingKey}
                className="rounded-2xl border border-[#f0d2ca] bg-white/80 p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-[#251E1F]">
                        {rule.title}
                      </h4>
                      <span className="rounded-full border border-[#f0d2ca] bg-white/80 px-3 py-1 text-xs font-semibold text-[#7b6660]">
                        {rule.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#7b6660]">
                      {rule.ruleText}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-xl border border-[#f0d2ca] bg-white/80 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/45"
                    onClick={() => startEdit(rule)}
                  >
                    Edit
                  </button>
                </div>
                <div className="mt-4 grid gap-3 text-xs text-[#7b6660] sm:grid-cols-3">
                  <span>
                    Category:{" "}
                    <span className="font-semibold text-[#251E1F]">
                      {rule.category}
                    </span>
                  </span>
                  <span>
                    Effective:{" "}
                    <span className="font-semibold text-[#251E1F]">
                      {rule.effectiveFrom
                        ? formatDate(rule.effectiveFrom)
                        : "Not set"}
                    </span>
                  </span>
                  <span>
                    Updated:{" "}
                    <span className="font-semibold text-[#251E1F]">
                      {formatDateTime(rule.updatedAt)}
                    </span>
                  </span>
                </div>
                {rule.source ? (
                  <p className="mt-3 text-xs text-[#F38978]">
                    Source: {rule.source}
                  </p>
                ) : null}
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

function getRunOperationalState(run) {
  const status = String(run.status || "Draft").toLowerCase();
  const completed = [
    "payment processed",
    "payslips sent",
    "reconciled",
    "closed",
    "completed",
    "success",
  ].some((value) => status.includes(value));
  const failed = ["failed", "error", "rejected"].some((value) =>
    status.includes(value),
  );
  const lastActivity = new Date(run.updated_at || run.created_at || 0);
  const delayed =
    !completed &&
    !failed &&
    Number.isFinite(lastActivity.getTime()) &&
    Date.now() - lastActivity.getTime() > 48 * 60 * 60 * 1000;
  if (failed) return { label: "Failed", tone: "failed", needsAttention: true };
  if (delayed)
    return { label: "Delayed", tone: "delayed", needsAttention: true };
  if (completed)
    return { label: "Complete", tone: "complete", needsAttention: false };
  return { label: "In progress", tone: "progress", needsAttention: false };
}

function getRunResponsibleRole(statusValue) {
  const status = String(statusValue || "Draft").toLowerCase();
  if (["failed", "error"].some((value) => status.includes(value)))
    return "Admin technical review";
  if (
    ["finance", "approved for payment", "payment"].some((value) =>
      status.includes(value),
    )
  )
    return "Finance";
  if (
    ["sent", "reconciled", "closed", "completed"].some((value) =>
      status.includes(value),
    )
  )
    return "Completed";
  return "HR";
}

function PayrollMonitorView({ payrollRuns = [], onNavigate }) {
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
  const states = payrollRuns.map(getRunOperationalState);
  const attentionCount = states.filter((state) => state.needsAttention).length;
  const completedCount = states.filter(
    (state) => state.tone === "complete",
  ).length;
  const inProgressCount = states.filter(
    (state) => state.tone === "progress",
  ).length;

  return (
    <PageShell
      heading="Payroll Run Monitor"
      updatedAt={getLatestTimestamp(payrollRuns)}
      actions={
        <ActionButton
          icon={History}
          variant="secondary"
          onClick={() =>
            onNavigate("/dashboard/payroll/admin/system-audit-trail")
          }
        >
          View System Audit Trail
        </ActionButton>
      }
    >
      <div className="payroll-run-monitor">
        <div className="payroll-run-monitor__notice">
          <ShieldCheck size={19} />
          <div>
            <strong>Read-only operational oversight</strong>
            <p>
              HR and Finance own payroll processing. Admin can review workflow
              health and technical exceptions but cannot approve, edit or
              process payroll.
            </p>
          </div>
        </div>
        <section
          className="payroll-run-monitor__metrics"
          aria-label="Payroll run monitoring summary"
        >
          {[
            {
              label: "Total Runs",
              value: payrollRuns.length,
              icon: FileBarChart,
              className: "payroll-run-monitor__metric--total",
            },
            {
              label: "In Progress",
              value: inProgressCount,
              icon: PlayCircle,
              className: "payroll-run-monitor__metric--progress",
            },
            {
              label: "Need Attention",
              value: attentionCount,
              icon: AlertCircle,
              className: "payroll-run-monitor__metric--attention",
            },
            {
              label: "Completed",
              value: completedCount,
              icon: CheckCircle2,
              className: "payroll-run-monitor__metric--complete",
            },
          ].map((metric) => (
            <article
              key={metric.label}
              className={`payroll-run-monitor__metric ${metric.className}`}
            >
              <span>
                <metric.icon size={20} />
              </span>
              <div>
                <small>{metric.label}</small>
                <strong>{metric.value}</strong>
              </div>
            </article>
          ))}
        </section>
        <div className="payroll-run-monitor__filters">
          <label className="space-y-2">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#F38978]/80">
              <Filter size={14} />
              Date Filter
            </span>
            <select
              value={periodMode}
              onChange={(event) => setPeriodMode(event.target.value)}
              className="payroll-run-monitor__control"
            >
              <option value="all">All payroll periods</option>
              <option value="range">From date to date</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#F38978]/80">
              From Date
            </span>
            <input
              type="date"
              value={fromDate}
              disabled={periodMode === "all"}
              onChange={(event) => setFromDate(event.target.value)}
              className="payroll-run-monitor__control disabled:opacity-50"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#F38978]/80">
              To Date
            </span>
            <input
              type="date"
              value={toDate}
              min={fromDate}
              disabled={periodMode === "all"}
              onChange={(event) => setToDate(event.target.value)}
              className="payroll-run-monitor__control disabled:opacity-50"
            />
          </label>
          <div className="flex items-end">
            <div className="payroll-run-monitor__count">
              {filteredRuns.length} of {payrollRuns.length} run(s)
            </div>
          </div>
        </div>

        <div className="payroll-run-monitor__table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pay Period</th>
                <th>Workflow Stage</th>
                <th>Responsible Role</th>
                <th>Last Activity</th>
                <th>Health</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRuns.length ? (
                filteredRuns.map((run) => {
                  const state = getRunOperationalState(run);
                  return (
                    <tr
                      key={
                        run.payroll_run_id ||
                        `${run.payroll_month}-${run.payroll_year}`
                      }
                    >
                      <td>
                        <strong>{formatPayrollPeriod(run)}</strong>
                        <small>
                          {Number(run.employee_count || 0)} employees ·
                          Initiated by {run.created_by_name || "System"}
                        </small>
                      </td>
                      <td>
                        <span className="payroll-run-monitor__stage">
                          {run.status || "Draft"}
                        </span>
                      </td>
                      <td>
                        <strong>{getRunResponsibleRole(run.status)}</strong>
                      </td>
                      <td>
                        <strong>
                          {formatDateTime(run.updated_at || run.created_at)}
                        </strong>
                        <small>Created {formatDate(run.created_at)}</small>
                      </td>
                      <td>
                        <span
                          className={`payroll-run-monitor__health ${
                            {
                              complete: "payroll-run-monitor__health--complete",
                              progress: "payroll-run-monitor__health--progress",
                              delayed: "payroll-run-monitor__health--delayed",
                              failed: "payroll-run-monitor__health--failed",
                            }[state.tone] ||
                            "payroll-run-monitor__health--progress"
                          }`}
                        >
                          <i />
                          {state.label}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="payroll-run-monitor__view"
                          onClick={() => setSelectedRun(run)}
                        >
                          <Eye size={15} />
                          View details
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6">
                    <EmptyState message="No payroll runs match the selected date filter." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {selectedRun ? (
          <div className="payroll-run-monitor__detail">
            <header>
              <div>
                <small>Operational run details</small>
                <h3>{formatPayrollPeriod(selectedRun)}</h3>
                <p>
                  No employee salary or banking information is exposed here.
                </p>
              </div>
              <button
                onClick={() => setSelectedRun(null)}
                aria-label="Close details"
              >
                <X size={19} />
              </button>
            </header>
            <div className="payroll-run-monitor__detail-grid">
              <div>
                <span>Workflow stage</span>
                <strong>{selectedRun.status || "Draft"}</strong>
              </div>
              <div>
                <span>Responsible role</span>
                <strong>{getRunResponsibleRole(selectedRun.status)}</strong>
              </div>
              <div>
                <span>Employees included</span>
                <strong>{Number(selectedRun.employee_count || 0)}</strong>
              </div>
              <div>
                <span>Initiated by</span>
                <strong>{selectedRun.created_by_name || "System"}</strong>
              </div>
              <div>
                <span>Created</span>
                <strong>{formatDateTime(selectedRun.created_at)}</strong>
              </div>
              <div>
                <span>Last activity</span>
                <strong>
                  {formatDateTime(
                    selectedRun.updated_at || selectedRun.created_at,
                  )}
                </strong>
              </div>
              <div>
                <span>Approved</span>
                <strong>
                  {selectedRun.approved_at
                    ? formatDateTime(selectedRun.approved_at)
                    : "Not yet approved"}
                </strong>
              </div>
              <div>
                <span>Payment reference</span>
                <strong>
                  {selectedRun.payment_reference || "Not available"}
                </strong>
              </div>
            </div>
            <footer>
              <button
                onClick={() =>
                  onNavigate("/dashboard/payroll/admin/system-audit-trail")
                }
              >
                <History size={15} />
                Open related audit trail
              </button>
              <button onClick={() => setSelectedRun(null)}>Close</button>
            </footer>
          </div>
        ) : null}
      </div>
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
    system: "System",
  };

  return (
    areaLabels[entityType] ||
    String(entityType || "system")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

function AuditLogsView({ auditLogs = [] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [entityFilter, setEntityFilter] = useState("All");

  const entityTypes = useMemo(
    () => [
      "All",
      ...new Set(auditLogs.map((log) => log.entity_type).filter(Boolean)),
    ],
    [auditLogs],
  );

  const filteredLogs = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return auditLogs.filter((log) => {
      const matchesEntity =
        entityFilter === "All" || log.entity_type === entityFilter;
      const matchesSearch =
        !normalizedSearch ||
        [log.action, log.entity_type, log.entity_id, log.user_name]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(normalizedSearch),
          );

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
        log.user_name || "System",
      ],
    }));
    const url = URL.createObjectURL(
      createPdfBlob("Audit Logs", rows, periodLabel),
    );
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
      actions={
        <ActionButton icon={FileText} variant="secondary" onClick={exportLogs}>
          Export Logs
        </ActionButton>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <div className="app-panel rounded-2xl p-5">
          <p className="text-sm text-[#7b6660]">Total Events</p>
          <p className="mt-3 text-3xl font-semibold text-[#251E1F]">
            {auditLogs.length}
          </p>
        </div>
        <div className="app-panel rounded-2xl p-5">
          <p className="text-sm text-[#7b6660]">Visible Events</p>
          <p className="mt-3 text-3xl font-semibold text-[#F38978]">
            {filteredLogs.length}
          </p>
        </div>
        <div className="app-panel rounded-2xl p-5">
          <p className="text-sm text-[#7b6660]">Entity Types</p>
          <p className="mt-3 text-3xl font-semibold text-[#2f8758]">
            {Math.max(entityTypes.length - 1, 0)}
          </p>
        </div>
      </div>

      <div className="mt-6 app-panel rounded-2xl p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#251E1F]">
              Activity Trail
            </h3>
            <p className="mt-1 text-sm text-[#7b6660]">
              Search and filter admin changes with exact timestamps.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_14rem] lg:w-[38rem]">
            <label className="flex items-center gap-2 rounded-xl border border-[#f0d2ca] bg-white/80 px-3 py-2.5">
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
                <option key={entityType} value={entityType}>
                  {entityType} entities
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[56rem] w-full border-separate border-spacing-0 text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-[#F38978]/80">
              <tr>
                <th className="border-b border-[#f0d2ca] px-4 py-3 font-semibold">
                  Timestamp
                </th>
                <th className="border-b border-[#f0d2ca] px-4 py-3 font-semibold">
                  Action
                </th>
                <th className="border-b border-[#f0d2ca] px-4 py-3 font-semibold">
                  Area
                </th>
                <th className="border-b border-[#f0d2ca] px-4 py-3 font-semibold">
                  Entity ID
                </th>
                <th className="border-b border-[#f0d2ca] px-4 py-3 font-semibold">
                  Performed By
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr
                  key={
                    log.log_id ||
                    `${log.entity_type}-${log.entity_id}-${log.created_at}`
                  }
                  className="text-[#7b6660] transition hover:bg-[#FDD9CD]/45"
                >
                  <td className="border-b border-[#f0d2ca] px-4 py-4 font-semibold text-[#251E1F]">
                    {formatDateTime(log.created_at)}
                  </td>
                  <td className="border-b border-[#f0d2ca] px-4 py-4">
                    {log.action || "System activity"}
                  </td>
                  <td className="border-b border-[#f0d2ca] px-4 py-4">
                    <span className="rounded-full border border-[#f0d2ca] bg-white/80 px-3 py-1 text-xs font-semibold text-[#7b6660]">
                      {formatAuditArea(log.entity_type)}
                    </span>
                  </td>
                  <td className="border-b border-[#f0d2ca] px-4 py-4">
                    {log.entity_id || "-"}
                  </td>
                  <td className="border-b border-[#f0d2ca] px-4 py-4">
                    {log.user_name || "System"}
                  </td>
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
        headers: getAuthHeaders(session?.token),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to load payslips");
      }

      const data = await response.json();
      setPayslips(
        Array.isArray(data)
          ? data.filter((payslip) => payslip.status === "admin_pending")
          : [],
      );
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

      const response = await fetch(
        `${API_BASE_URL}/api/payroll/payslips/${payslipId}/admin-approve`,
        {
          method: "PUT",
          headers: {
            ...getAuthHeaders(session?.token),
            "Content-Type": "application/json",
          },
        },
      );

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

      const response = await fetch(
        `${API_BASE_URL}/api/payroll/payslips/${payslipId}/admin-reject`,
        {
          method: "PUT",
          headers: {
            ...getAuthHeaders(session?.token),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: rejectReason }),
        },
      );

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
            <h3 className="text-lg font-semibold text-[#251E1F]">
              Payslips Pending Final Approval
            </h3>
            <p className="mt-1 text-sm text-[#7b6660]">
              Review payslips approved by Finance. Final approval will send them
              to staff.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchPayslips}
            className="rounded-lg border border-[#f0d2ca] bg-white/80 px-4 py-2 text-sm font-medium text-[#251E1F] hover:bg-[#FDD9CD]/45"
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
            <p className="text-sm text-[#7b6660]">
              No payslips pending final approval
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#f0d2ca] bg-white/80 text-[#7b6660]">
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
                  <tr
                    key={payslip.payslip_id}
                    className="border-b border-[#f0d2ca] text-[#251E1F]"
                  >
                    <td className="px-4 py-3 text-xs text-[#7b6660]">
                      {payslip.payslip_id}
                    </td>
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
                          className="rounded-lg bg-[#2D7C83]/20 px-3 py-1 text-xs text-[#2D7C83] hover:bg-[#2D7C83]/30 disabled:opacity-50"
                        >
                          {actionInProgress === payslip.payslip_id ? (
                            <Loader2
                              className="inline animate-spin"
                              size={12}
                            />
                          ) : (
                            "Send"
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setRejectingPayslipId(payslip.payslip_id)
                          }
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#251E1F]/50">
          <div className="app-panel m-4 w-full max-w-md rounded-2xl p-6">
            <div className="mb-4 flex items-center gap-3">
              <AlertCircle className="text-red-700" size={20} />
              <h3 className="text-lg font-semibold text-[#251E1F]">
                Reject Payslip
              </h3>
            </div>
            <p className="mb-4 text-sm text-[#7b6660]">
              Please provide a reason for rejecting this payslip.
            </p>
            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-sm text-[#251E1F] placeholder-white/30"
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
                className="flex-1 rounded-lg border border-[#f0d2ca] bg-white/80 px-4 py-2 text-sm font-medium text-[#251E1F] hover:bg-[#FDD9CD]/45"
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
  const brandedRows = rows.map((row) =>
    typeof row === "string" ? [row] : row.columns || [row.summary || ""],
  );
  const reportHeaders = {
    "User Access & Account Status Report": [
      "Employee",
      "Role",
      "Account / Department / Staff Link",
    ],
    "Audit Activity Report": [
      "Date / Time",
      "Action or Event",
      "Record / Module",
      "Actor",
      "Outcome",
    ],
    "Audit Logs": [
      "Date / Time",
      "Action or Event",
      "Record / Module",
      "User / Role",
    ],
    "Statutory Configuration Report": [
      "Setting",
      "Configured Value",
      "Description",
    ],
    "Payroll Governance Summary": ["Control Item", "Current Value"],
    "Payroll Run Status & Exception Report": [
      "Payroll Period",
      "Workflow Stage",
      "Health / Responsible Role",
    ],
    "Effective Payroll Rules Report": [
      "Rule / Category",
      "Current Value",
      "Usage",
      "Source",
      "Effective From",
      "Status / Updated By",
    ],
  };
  const headers =
    reportHeaders[title] ||
    Array.from(
      { length: Math.max(1, ...brandedRows.map((row) => row.length)) },
      (_, index) => `Detail ${index + 1}`,
    );

  return createPayrollReportPdf({
    category: "ADMIN PAYROLL",
    categorySubtitle: "Governance, access, compliance and payroll oversight",
    footer:
      "Prepared for Admin review. Generated by the Automated Payroll System.",
    subtitle: `Reporting Period: ${periodLabel}`,
    summaryRows: [
      ["Report", title, "Admin review"],
      ["Records", String(brandedRows.length), periodLabel],
    ],
    tableRows: [headers, ...brandedRows],
    title,
  });
}

function isWithinReportPeriod(value, periodMode, fromDate, toDate) {
  if (!value || !fromDate) return true;

  const itemDate = new Date(value);
  const startDate = new Date(`${fromDate}T00:00:00`);
  const endDate = new Date(
    `${periodMode === "single" ? fromDate : toDate || fromDate}T23:59:59`,
  );

  return itemDate >= startDate && itemDate <= endDate;
}

function getPeriodLabel(periodMode, fromDate, toDate) {
  if (!fromDate) return "All available dates";

  if (periodMode === "single") {
    return `On ${formatDate(fromDate)}`;
  }

  return `From ${formatDate(fromDate)} to ${formatDate(toDate || fromDate)}`;
}

function humanizeSettingKey(key) {
  const acronyms = new Set([
    "cpf",
    "sdl",
    "mbmf",
    "cdac",
    "sinda",
    "ecf",
    "iras",
    "ir21",
    "gl",
  ]);
  return String(key || "")
    .split("_")
    .map((part) =>
      acronyms.has(part.toLowerCase())
        ? part.toUpperCase()
        : `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
    )
    .join(" ");
}

function getReportLines(
  report,
  data = {},
  periodMode = "range",
  fromDate = "",
  toDate = "",
) {
  const stats = data.stats || {};

  if (report === "Payroll Governance Summary") {
    return [
      {
        summary: `Active users: ${stats.activeUsers ?? 0}`,
        columns: ["Active users", String(stats.activeUsers ?? 0)],
      },
      {
        summary: `Pending approvals: ${data.pendingApprovalCount ?? 0}`,
        columns: [
          "Pending admin approvals",
          String(data.pendingApprovalCount ?? 0),
        ],
      },
      {
        summary: `Payroll runs: ${data.payrollRuns?.length || 0}`,
        columns: [
          "Payroll runs monitored",
          String(data.payrollRuns?.length || 0),
        ],
      },
      {
        summary: `Payroll records: ${stats.payrollRecords ?? 0}`,
        columns: [
          "Employee records included in monitored runs",
          String(stats.payrollRecords ?? 0),
        ],
      },
      {
        summary: `Payroll rules: ${stats.payrollRules ?? 0}`,
        columns: ["Configured payroll rules", String(stats.payrollRules ?? 0)],
      },
      {
        summary: `Audit events: ${stats.adminLogs ?? 0}`,
        columns: [
          "Recent audit events available",
          String(stats.adminLogs ?? 0),
        ],
      },
    ];
  }

  if (report === "User Access & Account Status Report") {
    return (data.users || []).map((user) => ({
      columns: [
        user.name,
        user.role_name,
        `${Number(user.status) === 1 ? "Active" : "Inactive"} / ${user.department_name || "No department"} / ${user.employee_code || "No linked staff"}`,
      ],
    }));
  }

  if (report === "Statutory Configuration Report") {
    return (data.settings || [])
      .filter(
        (setting) =>
          [
            "statutory_",
            "cpf_",
            "sdl_",
            "mbmf_",
            "cdac_",
            "sinda_",
            "ecf_",
            "iras_",
            "ir21_",
            "foreign_worker_levy_",
          ].some((prefix) => setting.setting_key.startsWith(prefix)) &&
          ![
            "bank",
            "account",
            "payable",
            "expense",
            "clearing",
            "payment_method",
          ].some((fragment) =>
            setting.setting_key.toLowerCase().includes(fragment),
          ),
      )
      .map((setting) => ({
        summary: `${humanizeSettingKey(setting.setting_key)}: ${setting.setting_value}`,
        columns: [
          humanizeSettingKey(setting.setting_key),
          setting.setting_value,
          setting.description || "No description",
        ],
      }));
  }

  if (report === "Payslip Layout Report") {
    return (data.layouts || []).map((layout) => ({
      columns: [
        layout.layout_name,
        layout.file_type,
        Number(layout.is_default) === 1
          ? "Default layout"
          : layout.status || "Imported",
      ],
    }));
  }

  if (report === "Payroll Run Status & Exception Report") {
    return (data.payrollRuns || [])
      .filter((run) =>
        isWithinReportPeriod(run.created_at, periodMode, fromDate, toDate),
      )
      .map((run) => ({
        columns: [
          `${String(run.payroll_month).padStart(2, "0")}/${run.payroll_year}`,
          run.status || "Pending",
          `${getRunOperationalState(run).label} / ${getRunResponsibleRole(run.status)} / ${Number(run.employee_count || 0)} employees`,
        ],
      }));
  }

  if (report === "Effective Payroll Rules Report") {
    return (data.effectiveRules?.rules || []).map((rule) => ({
      columns: [
        `${rule.name} / ${rule.category}`,
        rule.value,
        rule.usage === "calculation"
          ? "Applied to calculations"
          : "Used for validation",
        rule.source,
        formatDate(rule.effectiveFrom),
        `${rule.status} / ${rule.updatedBy || "System default"}`,
      ],
    }));
  }

  return (data.auditLogs || [])
    .map((log) => log)
    .filter((log) =>
      isWithinReportPeriod(log.created_at, periodMode, fromDate, toDate),
    )
    .map((log) => ({
      columns: [
        formatDateTime(log.created_at),
        log.action || "System activity",
        `${formatAuditArea(log.entity_type)} / ${log.module || "System"}`,
        log.user_name || "System",
        log.status || "Info",
      ],
    }));
}

function ReportPreviewModal({ data, report, onClose }) {
  const [pdfUrl, setPdfUrl] = useState("");
  const [exportState, setExportState] = useState(null);
  const today = new Date().toISOString().slice(0, 10);
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const [periodMode, setPeriodMode] = useState("range");
  const [fromDate, setFromDate] = useState(yearStart);
  const [toDate, setToDate] = useState(today);
  const supportsPeriod = [
    "Payroll Run Status & Exception Report",
    "Audit Activity Report",
  ].includes(report);
  const supportsExcel = [
    "User Access & Account Status Report",
    "Statutory Configuration Report",
    "Payroll Run Status & Exception Report",
    "Audit Activity Report",
    "Effective Payroll Rules Report",
  ].includes(report);
  const downloadExcel = async () => {
    setExportState({
      open: true,
      status: "running",
      title: "Generate Excel report",
      phase: "Preparing filtered workbook…",
    });
    try {
      await exportAdminPayrollReport(
        report,
        supportsPeriod
          ? { from: fromDate, to: periodMode === "single" ? fromDate : toDate }
          : {},
      );
      setExportState({
        open: true,
        status: "completed",
        title: "Excel report downloaded",
        phase: "The workbook was generated successfully.",
      });
    } catch (error) {
      setExportState({
        open: true,
        status: "failed",
        title: "Generate Excel report",
        phase: "Export failed",
        detail: error.message,
      });
    }
  };

  useEffect(() => {
    const periodLabel = supportsPeriod
      ? getPeriodLabel(periodMode, fromDate, toDate)
      : `As of ${formatDate(today)}`;
    const lines = getReportLines(
      report,
      data,
      periodMode,
      supportsPeriod ? fromDate : "",
      supportsPeriod ? toDate : "",
    );
    const blob = createPdfBlob(report, lines, periodLabel);
    const url = URL.createObjectURL(blob);
    setPdfUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [data, fromDate, periodMode, report, supportsPeriod, toDate, today]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#fff8f5]/80 px-4 backdrop-blur-sm">
      <section className="app-panel flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl p-6">
        <div className="flex flex-col gap-4 border-b border-[#f0d2ca] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#F38978]/80">
              PDF Preview
            </p>
            <h3 className="mt-2 text-xl font-semibold text-[#251E1F]">
              {report}
            </h3>
            <p className="mt-1 text-sm text-[#7b6660]">
              {supportsPeriod
                ? getPeriodLabel(periodMode, fromDate, toDate)
                : `As of ${formatDate(today)}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={pdfUrl}
              download={`${report.toLowerCase().replaceAll(" ", "-")}.pdf`}
              onClick={() =>
                setExportState({
                  open: true,
                  status: "completed",
                  title: "PDF report downloaded",
                  phase: "The current report preview was saved.",
                })
              }
              className="primary-button inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold"
            >
              <FileText size={17} />
              Download PDF
            </a>
            {supportsExcel ? (
              <button
                type="button"
                onClick={downloadExcel}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700"
              >
                <FileBarChart size={17} />
                Download Excel
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-xl border border-[#f0d2ca] bg-white/80 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/45"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
        {supportsPeriod ? (
          <div className="mt-5 grid gap-3 rounded-xl border border-[#f0d2ca] bg-white/80 p-4 md:grid-cols-3">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#F38978]/80">
                Period Type
              </span>
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
                <span className="text-xs font-semibold uppercase tracking-wide text-[#F38978]/80">
                  To Date
                </span>
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
        ) : (
          <div className="mt-5 rounded-xl border border-[#f0d2ca] bg-[#fff8f5] p-4 text-sm text-[#7b6660]">
            Current-state snapshot using the latest available configuration and
            account data. Date filters do not apply.
          </div>
        )}
        <div className="mt-5 min-h-0 flex-1 overflow-hidden rounded-xl border border-[#f0d2ca] bg-white">
          {pdfUrl ? (
            <iframe
              title={`${report} preview`}
              src={pdfUrl}
              className="h-[68vh] w-full"
            />
          ) : null}
        </div>
        <AdminActionProgress
          state={exportState}
          onClose={() => setExportState(null)}
        />
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
    let active = true;
    getAdminPayrollReports()
      .then((result) => {
        if (active) setReportData(result);
      })
      .catch((error) => {
        if (active)
          setReportError(
            error.message || "Unable to load payroll report data.",
          );
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
      title: "Payroll Governance Summary",
      category: "Payroll oversight",
      description:
        "A management snapshot of payroll readiness and operating volume.",
      contains:
        "Active users, pending approvals, monitored runs, configured rules and audit coverage.",
      purpose: "Monthly governance review",
      filter: "Current snapshot",
      cardClass: "admin-report-card--coral",
      iconClass: "admin-report-icon--coral",
    },
    {
      title: "User Access & Account Status Report",
      category: "Access & governance",
      description:
        "Shows who can enter each payroll role and whether their account is usable.",
      contains: "Roles, account status, department and linked staff record.",
      purpose: "Access and onboarding reviews",
      filter: "Current snapshot",
      cardClass: "admin-report-card--purple",
      iconClass: "admin-report-icon--purple",
    },
    {
      title: "Statutory Configuration Report",
      category: "Compliance",
      description:
        "Explains the statutory settings applied to payroll calculations.",
      contains: "CPF, SDL, self-help funds, IRAS, IR21 and levy settings.",
      purpose: "Compliance configuration review",
      filter: "Current snapshot",
      cardClass: "admin-report-card--blue",
      iconClass: "admin-report-icon--blue",
    },
    {
      title: "Payroll Run Status & Exception Report",
      category: "Payroll oversight",
      description:
        "Reviews workflow progress, ownership, delays and processing exceptions without exposing pay values.",
      contains:
        "Employee count, workflow stage, responsible role and operational health.",
      purpose: "Operational exception review",
      filter: "Date range",
      cardClass: "admin-report-card--teal",
      iconClass: "admin-report-icon--teal",
    },
    {
      title: "Audit Activity Report",
      category: "Access & governance",
      description:
        "Provides a traceable history of payroll administration activity.",
      contains: "Time, action, affected area, outcome and performing account.",
      purpose: "Audit and change investigation",
      filter: "Date range",
      cardClass: "admin-report-card--amber",
      iconClass: "admin-report-icon--amber",
    },
    {
      title: "Effective Payroll Rules Report",
      category: "Compliance",
      description:
        "Documents the calculation and validation rules currently resolved by the payroll engine.",
      contains:
        "Rule groups, resolved values, usage, source, effective dates, status and updater.",
      purpose: "As-of rule governance and compliance evidence",
      filter: "Current snapshot",
      cardClass: "admin-report-card--green",
      iconClass: "admin-report-icon--green",
    },
  ];
  const reportGroups = [
    "Payroll oversight",
    "Access & governance",
    "Compliance",
  ].map((category) => ({
    category,
    reports: reportCards.filter((report) => report.category === category),
  }));
  const lastRefresh = formatDateTime(getOverallUpdatedAt(effectiveData));

  return (
    <PageShell
      heading="Reports"
      updatedAt={getOverallUpdatedAt(effectiveData)}
      actions={
        <>
          <ActionButton
            icon={FileBarChart}
            onClick={() => setSelectedReport(reportCards[0].title)}
          >
            Generate Report
          </ActionButton>
          <ActionButton
            icon={FileText}
            variant="secondary"
            onClick={() =>
              setSelectedReport("Payroll Run Status & Exception Report")
            }
          >
            Run Status Report
          </ActionButton>
        </>
      }
    >
      {reportLoading ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-[#f0d2ca] bg-white/80 p-4 text-sm text-[#7b6660]">
          <Loader2 size={17} className="animate-spin" /> Loading consolidated
          payroll report data...
        </div>
      ) : null}
      {reportError ? (
        <div className="mb-4 rounded-xl border border-red-300/40 bg-[#FDD9CD] p-4 text-sm text-red-700">
          {reportError}
        </div>
      ) : null}
      <div className="space-y-7">
        {reportGroups.map((group) => (
          <section key={group.category}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#7b6660]">
              {group.category}
            </h3>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {group.reports.map((report) => (
                <article
                  key={report.title}
                  className={`app-panel admin-report-card ${report.cardClass}`}
                >
                  <span className={`admin-report-icon ${report.iconClass}`}>
                    <FileBarChart size={22} />
                  </span>
                  <h3 className="mt-4 font-semibold text-[#251E1F]">
                    {report.title}
                  </h3>
                  <p className="mt-2 text-sm text-[#7b6660]">
                    {report.description}
                  </p>
                  <dl className="mt-4 space-y-3 rounded-xl bg-[#fff8f5] p-4 text-sm">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-[#F38978]">
                        Contains
                      </dt>
                      <dd className="mt-1 text-[#7b6660]">{report.contains}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-[#F38978]">
                        Best used for
                      </dt>
                      <dd className="mt-1 text-[#7b6660]">{report.purpose}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-[#F38978]">
                        Filter
                      </dt>
                      <dd className="mt-1 text-[#7b6660]">{report.filter}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-[#F38978]">
                        Last refreshed
                      </dt>
                      <dd className="mt-1 text-[#7b6660]">{lastRefresh}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    className="mt-auto pt-5 text-left text-sm font-semibold text-[#F38978] hover:underline"
                    onClick={() => setSelectedReport(report.title)}
                  >
                    Preview report →
                  </button>
                </article>
              ))}
            </div>
          </section>
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
  onRulesPublished,
  onUpdateRole,
  onUpdateStatus,
  pathname,
}) {
  if (pathname.endsWith("/company-profile")) return <CompanyProfileView />;
  if (pathname.endsWith("/user-management")) {
    return <PayrollUserManagement role="Admin" />;
  }

  if (
    pathname.endsWith("/user-accounts") ||
    pathname.endsWith("/users-roles") ||
    pathname.endsWith("/staff-management") ||
    pathname.endsWith("/staff-setup")
  ) {
    return <Navigate replace to="/dashboard/payroll/admin/user-management" />;
  }
  if (pathname.endsWith("/effective-rules"))
    return <EffectivePayrollRulesView onNavigate={onNavigate} />;
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
        onRulesPublished={onRulesPublished}
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
  if (pathname.endsWith("/payroll-monitor"))
    return (
      <PayrollMonitorView
        payrollRuns={data?.payrollRuns}
        onNavigate={onNavigate}
      />
    );
  if (pathname.endsWith("/audit-logs"))
    return (
      <Navigate replace to="/dashboard/payroll/admin/system-audit-trail" />
    );
  if (pathname.endsWith("/system-audit-trail")) return <PayrollAuditLogPage />;
  if (pathname.endsWith("/reports")) return <ReportsView data={data} />;

  return <DashboardView data={data} onNavigate={onNavigate} />;
}

export default function AdminPayrollPage() {
  const session = getStoredSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadDashboard = async ({ silent = false } = {}) => {
    try {
      setErrorMessage("");
      setSuccessMessage("");
      if (!silent) setIsLoading(true);
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

  useEffect(() => {
    if (location.pathname.endsWith("/reports")) return undefined;
    const refreshDashboard = () => loadDashboard({ silent: true });
    window.addEventListener("focus", refreshDashboard);
    return () => window.removeEventListener("focus", refreshDashboard);
  }, [location.pathname]);

  const handleImportLayout = async (file) => {
    try {
      const result = await addPayslipLayout(file);
      setDashboardData((current) => ({
        ...current,
        layouts: result.layouts,
        stats: {
          ...(current?.stats || {}),
          payslipLayouts: result.layouts.filter(
            (layout) => layout.status === "Active",
          ).length,
        },
      }));
      setErrorMessage("");
      return true;
    } catch (error) {
      setErrorMessage(error.message);
      return false;
    }
  };

  const handleSetDefaultLayout = async (layoutId) => {
    try {
      const selectedLayout = dashboardData?.layouts?.find(
        (layout) => Number(layout.layout_id) === Number(layoutId),
      );
      const result = await setDefaultPayslipLayout(layoutId);
      setDashboardData((current) => ({
        ...current,
        layouts: result.layouts,
      }));
      setErrorMessage("");
      setSuccessMessage(
        `${selectedLayout?.layout_name || "Payslip layout"} is now the default layout.`,
      );
      return true;
    } catch (error) {
      setSuccessMessage("");
      setErrorMessage(error.message);
      throw error;
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
        ...result.stats,
      },
      users: result.users,
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
        settings: (() => {
          const savedSetting = result.settings?.find(
            (setting) => setting.setting_key === settingKey,
          ) || {
            setting_key: settingKey,
            setting_value: payload.settingValue,
            description: payload.description,
            updated_at: new Date().toISOString(),
          };
          const currentSettings = current?.settings || [];
          return currentSettings.some(
            (setting) => setting.setting_key === settingKey,
          )
            ? currentSettings.map((setting) =>
                setting.setting_key === settingKey ? savedSetting : setting,
              )
            : [...currentSettings, savedSetting];
        })(),
        stats: {
          ...(current?.stats || {}),
          ...result.stats,
        },
      }));
      setErrorMessage("");
      setSuccessMessage(
        `${settingKey.replaceAll("_", " ")} saved and will apply to new payroll runs.`,
      );
    } catch (error) {
      setSuccessMessage("");
      setErrorMessage(error.message);
      throw error;
    }
  };

  const handlePublishPayrollRules = async (changes, changeReason) => {
    const result = await publishPayrollRules(changes, changeReason);
    setDashboardData((current) => ({
      ...current,
      settings: result.settings || current?.settings,
      auditLogs: result.auditLogs || current?.auditLogs,
      mbmfEligibility: result.mbmfEligibility || current?.mbmfEligibility,
      rulePublication: result.publication || current?.rulePublication,
      stats: { ...(current?.stats || {}), ...(result.stats || {}) },
    }));
    setErrorMessage("");
    setSuccessMessage(
      `Payroll rules version ${result.publication?.version || "new"} published. Finance users must review the update.`,
    );
    return result;
  };

  return (
    <DashboardLayout
      pageTitle={pageTitle}
      user={session?.user}
      sidebarSections={payrollSidebarSections}
      sidebarTitle="Automated Invoicing & Payroll System"
      homePath="/dashboard/payroll/admin"
      searchPlaceholder="Search payroll, staff, approvals..."
      moduleClassName="payroll-module"
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
      {successMessage ? (
        <div className="mb-4 rounded-xl border border-[#2f8758]/25 bg-[#2f8758]/10 p-4 text-sm font-semibold text-[#2f8758]">
          {successMessage}
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
          onRulesPublished={handlePublishPayrollRules}
          onUpdateRole={handleUpdateUserRole}
          onUpdateStatus={handleUpdateUserStatus}
        />
      ) : null}
    </DashboardLayout>
  );
}
