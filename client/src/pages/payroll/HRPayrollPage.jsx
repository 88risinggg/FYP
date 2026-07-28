import {
  AlertCircle,
  BarChart3,
  Bell,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  FileUp,
  FileText,
  HandCoins,
  Send,
  Loader2,
  LayoutDashboard,
  PlayCircle,
  Upload,
  Users,
  ShieldCheck,
  RefreshCw,
  X
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import payNivoLogoDataUrl from "../../assets/paynivo-logo.png?inline";
import HRLeaveManagement from "./HRLeaveManagement.jsx";
import HRLoanManagement from "./HRLoanManagement.jsx";
import HRPublicHolidays from "./HRPublicHolidays.jsx";
import HRReportsPage from "./HRReportsPage.jsx";
import ClaimManagementPage from "./ClaimManagementPage.jsx";
import PayrollUserManagement from "../../components/payroll/PayrollUserManagement.jsx";
import PayrollNotificationsView from "../../components/payroll/PayrollNotificationsView.jsx";
import PayrollProgressTracker from "../../components/payroll/PayrollProgressTracker.jsx";
import { getCompanyScopedKey, getStoredSession } from "../../services/sessionService.js";
import { printConfiguredPayslip } from "../../utils/payslipPdf.js";
import { getEffectivePayrollRules } from "../../services/adminPayrollService.js";
import {
  getPayslipDeliveryFailureCount,
  getPayslipDeliveryStartedAt,
  isPayslipDeliveryAttemptComplete,
  readPayslipDeliveryResponse
} from "../../utils/payslipDelivery.js";

const pageTitle = "Automated Payroll System – HR Payroll Upload & Payslip Generation";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

function normalizeSearchValue(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function recordMatchesSearch(record, query, fields = []) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery || !record) return false;

  const haystack = fields
    .map((field) => {
      const value = typeof field === "function" ? field(record) : record?.[field];
      return normalizeSearchValue(value);
    })
    .filter(Boolean)
    .join(" ");

  if (!haystack) return false;

  return normalizedQuery.split(/\s+/).filter(Boolean).some((token) => haystack.includes(token));
}

function getSearchCountLabel(filteredCount, totalCount, query = "") {
  if (query && filteredCount === 0) {
    return "No records match your search.";
  }

  return `Showing ${filteredCount} of ${totalCount} records`;
}

function HighlightText({ text, query }) {
  if (!query || !text) return <span>{text || "—"}</span>;

  const str = String(text);
  const idx = str.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <span>{str}</span>;

  return (
    <span>
      {str.slice(0, idx)}
      <mark className="bg-[#F38978]/40 text-[#251E1F] rounded px-0.5">
        {str.slice(idx, idx + query.length)}
      </mark>
      {str.slice(idx + query.length)}
    </span>
  );
}

function getDeptName(deptId) {
  const names = { 1: "Human Resources", 2: "Finance & Accounting", 3: "Sales", 4: "Customer Service", 5: "Operations", 6: "Management", 7: "IT / System Administrator" };
  return names[deptId] || "—";
}

async function printPayslip(payslip) {
  try {
    await printConfiguredPayslip(payslip);
  } catch (error) {
    console.error("Payslip print error:", error);
  }
}

const payrollSidebarSections = [
  {
    label: "MAIN",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard/payroll/hr", end: true }
    ]
  },
  {
    label: "STAFF MANAGEMENT",
    items: [
      { label: "Staff Management", icon: Users, path: "/dashboard/payroll/hr/staff" }
    ]
  },
  {
    label: "PAYROLL",
    items: [
      { label: "Payroll Upload", icon: Upload, path: "/dashboard/payroll/hr/upload" },
      { label: "Payroll Runs", icon: PlayCircle, path: "/dashboard/payroll/hr/payroll-runs" },
      { label: "Payslip Delivery", icon: Send, path: "/dashboard/payroll/hr/payslips" }
    ]
  },
  {
    label: "LEAVE",
    items: [
      { label: "Leave Management", icon: CalendarCheck, path: "/dashboard/payroll/hr/leave-management" },
      { label: "Public Holidays", icon: Calendar, path: "/dashboard/payroll/hr/public-holidays" }
    ]
  },
  {
    label: "LOANS",
    items: [
      { label: "Loan Management", icon: HandCoins, path: "/dashboard/payroll/hr/loans" }
    ]
  },
  {
    label: "CLAIMS",
    items: [
      { label: "Claim Management", icon: ClipboardList, path: "/dashboard/payroll/hr/claims" }
    ]
  },
  {
    label: "MONITORING & REPORTS",
    items: [
      { label: "Payroll Policies & Sources", icon: ShieldCheck, path: "/dashboard/payroll/hr/payroll-policies" },
      { label: "Reports", icon: BarChart3, path: "/dashboard/payroll/hr/reports" },
      { label: "Notifications", icon: Bell, path: "/dashboard/payroll/hr/notifications" }
    ]
  }
];

const routeHeadings = {
  "/dashboard/payroll/hr": "Dashboard",
  "/dashboard/payroll/hr/staff": "Staff Management",
  "/dashboard/payroll/hr/user-management": "Staff Management",
  "/dashboard/payroll/hr/upload": "Payroll Upload",
  "/dashboard/payroll/hr/payroll-runs": "Payroll Runs",
  "/dashboard/payroll/hr/leave-management": "Leave Management",
  "/dashboard/payroll/hr/public-holidays": "Public Holidays",
  "/dashboard/payroll/hr/loans": "Loan Management",
  "/dashboard/payroll/hr/claims": "Claim Management",
  "/dashboard/payroll/hr/payslips": "Payslip Delivery",
  "/dashboard/payroll/hr/payroll-policies": "Payroll Policies & Sources",
  "/dashboard/payroll/hr/reports": "Reports",
  "/dashboard/payroll/hr/notifications": "Notifications"
};

function CircularProgress({ percentage, size = 80, color = "#F38978", label, value }) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={8}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="text-center -mt-1">
        <p className="text-lg font-bold text-[#251E1F]">{value}</p>
        <p className="text-xs text-[#7b6660]">{label}</p>
      </div>
    </div>
  );
}

function timeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getDaysUntil(targetDay) {
  const today = new Date();
  const target = new Date(today.getFullYear(), today.getMonth(), targetDay);
  if (target < today) target.setMonth(target.getMonth() + 1);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

function getDaysUntilCpf() {
  // CPF contributions are due by 14th of the following month
  const today = new Date();
  const target = new Date(today.getFullYear(), today.getMonth() + 1, 14);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

function getDaysUntilIR8A() {
  // IR8A filing is due by 1st March every year
  const today = new Date();
  let target = new Date(today.getFullYear(), 2, 1);
  if (target <= today) target.setFullYear(target.getFullYear() + 1);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

const DEPARTMENT_NAMES = {
  1: "Human Resources", 2: "Finance & Accounting", 3: "Sales",
  4: "Customer Service", 5: "Operations", 6: "Management", 7: "IT / System Administrator"
};

function HRDashboardView() {
  const session = getStoredSession();
  const navigate = useNavigate();
  const [staffList, setStaffList] = useState([]);
  const [payslipList, setPayslipList] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [advanceRequests, setAdvanceRequests] = useState([]);
  const [showRequests, setShowRequests] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      try {
        const [staffData, payslipData, auditData, requestsData] = await Promise.all([
          fetch(`${API_BASE_URL}/api/hr/staff`, { headers: getAuthHeaders(session?.token) }).then(r => r.json()),
          fetch(`${API_BASE_URL}/api/hr/payslips`, { headers: getAuthHeaders(session?.token) }).then(r => r.json()),
          fetch(`${API_BASE_URL}/api/hr/audit-log`, { headers: getAuthHeaders(session?.token) }).then(r => r.json()),
          fetch(`${API_BASE_URL}/api/hr/advance-requests`, { headers: getAuthHeaders(session?.token) }).then(r => r.json())
        ]);
        setStaffList(Array.isArray(staffData) ? staffData : []);
        setPayslipList(Array.isArray(payslipData) ? payslipData : []);
        setAuditLog(Array.isArray(auditData) ? auditData : []);
        setAdvanceRequests(Array.isArray(requestsData) ? requestsData : []);
      } catch {
        setStaffList([]);
        setPayslipList([]);
        setAuditLog([]);
        setAdvanceRequests([]);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, [session?.token]);

  const handleApproveRequest = async (requestId) => {
    setProcessingId(requestId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/hr/advance-requests/${requestId}/approve`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(session?.token), 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        setAdvanceRequests(prev => prev.map(r => r.request_id === requestId ? { ...r, status: 'hr_approved' } : r));
      }
    } catch {} finally { setProcessingId(null); }
  };

  const handleRejectRequest = async (requestId) => {
    setProcessingId(requestId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/hr/advance-requests/${requestId}/reject`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(session?.token), 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        setAdvanceRequests(prev => prev.map(r => r.request_id === requestId ? { ...r, status: 'hr_rejected' } : r));
      }
    } catch {} finally { setProcessingId(null); }
  };

  const pendingRequests = advanceRequests.filter(r => r.status === 'pending');

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const payrollHistoryData = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth() - (5 - i), 1);
      const month = d.getMonth();
      const year = d.getFullYear();
      const monthPayslips = payslipList.filter(p => {
        const pMonth = typeof p.period_month === 'string'
          ? monthNames.indexOf(p.period_month.slice(0, 3))
          : Number(p.period_month) - 1;
        return pMonth === month && Number(p.period_year) === year;
      });
      const total = monthPayslips.reduce((sum, p) => sum + Number(p.net_pay || 0), 0);
      return {
        label: `${monthNames[month]} ${year}`,
        shortLabel: monthNames[month],
        total,
        count: monthPayslips.length
      };
    });
  }, [payslipList]);

  const maxPayroll = Math.max(...payrollHistoryData.map(d => d.total), 1);

  // Total Payroll: use actual net pay from the latest month's payslips (real disbursed amount)
  const totalPayroll = useMemo(() => {
    if (payslipList.length === 0) return 0;
    // Find the most recent month/year with payslip data
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-indexed
    const currentYear = now.getFullYear();

    // Try current month first, then find the latest available month
    let latestPayslips = payslipList.filter(p =>
      Number(p.period_month) === currentMonth && Number(p.period_year) === currentYear
    );

    if (latestPayslips.length === 0) {
      // Find the most recent month in the data
      const sorted = [...payslipList].sort((a, b) => {
        const yearDiff = Number(b.period_year) - Number(a.period_year);
        if (yearDiff !== 0) return yearDiff;
        return Number(b.period_month) - Number(a.period_month);
      });
      if (sorted.length > 0) {
        const latestMonth = Number(sorted[0].period_month);
        const latestYear = Number(sorted[0].period_year);
        latestPayslips = payslipList.filter(p =>
          Number(p.period_month) === latestMonth && Number(p.period_year) === latestYear
        );
      }
    }

    return latestPayslips.reduce((sum, p) => sum + Number(p.net_pay || 0), 0);
  }, [payslipList]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-[#F38978]" size={32} />
    </div>
  );

  // Computed values
  const activeStaff = staffList.filter(s => s.status === 1 || s.status === '1').length;
  const totalStaff = staffList.length;

  const pendingFinance = payslipList.filter(p => p.status === 'finance_pending').length;
  const totalPayslips = payslipList.length;
  const sentThisMonth = payslipList.filter(p => {
    if (p.status !== 'sent_to_staff') return false;
    const sent = new Date(p.sent_to_staff_at || p.updated_at);
    const now = new Date();
    return sent.getMonth() === now.getMonth() && sent.getFullYear() === now.getFullYear();
  }).length;

  const deadlines = [
    { label: "Payroll Cutoff", days: getDaysUntil(25), icon: "📋" },
    { label: "CPF Submission", days: getDaysUntilCpf(), icon: "🏦" },
    { label: "IR8A Filing", days: getDaysUntilIR8A(), icon: "📄" }
  ];

  const birthdaysThisMonth = staffList
    .filter(s => {
      if (!s.date_of_birth) return false;
      return new Date(s.date_of_birth).getMonth() === new Date().getMonth();
    })
    .map(s => {
      const dob = new Date(s.date_of_birth);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const birthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
      const daysUntil = Math.round((birthday - today) / (1000 * 60 * 60 * 24));
      return { ...s, daysUntil };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const deptTotals = Object.entries(
    staffList
      .filter(s => s.status === 1 || s.status === '1')
      .reduce((acc, s) => {
        const dept = DEPARTMENT_NAMES[s.department_id] || "Other";
        acc[dept] = (acc[dept] || 0) + Number(s.base_salary || 0);
        return acc;
      }, {})
  ).map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);

  const maxTotal = Math.max(...deptTotals.map(d => d.total), 1);

  return (
    <div className="space-y-6">
      {/* Section 1 — Welcome Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#251E1F]">
          Good {timeOfDay()}, {session?.user?.name} 👋
        </h2>
        <p className="text-sm text-[#7b6660] mt-1">
          {new Date().toLocaleDateString("en-SG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Section 2 — Stats Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-5 flex flex-col items-center justify-center">
          <CircularProgress
            percentage={totalStaff > 0 ? (activeStaff / totalStaff) * 100 : 0}
            color="#F38978"
            value={activeStaff}
            label="Active Staff"
          />
          <p className="text-xs text-[#251E1F]/30 mt-2">{totalStaff} total</p>
        </div>

        <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-5 flex flex-col justify-between min-h-[140px]">
          <p className="text-xs text-[#7b6660]">Total Payroll</p>
          <p className="text-2xl font-bold text-[#251E1F]">
            ${totalPayroll.toLocaleString()}
          </p>
          <p className="text-xs text-[#251E1F]/30">Net pay (latest run)</p>
        </div>

        <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-5 flex flex-col items-center justify-center">
          <CircularProgress
            percentage={totalPayslips > 0 ? (pendingFinance / totalPayslips) * 100 : 0}
            color="#E87562"
            value={pendingFinance}
            label="Pending Finance"
          />
          <p className="text-xs text-[#251E1F]/30 mt-2">awaiting approval</p>
        </div>

        <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-5 flex flex-col justify-between min-h-[140px]">
          <p className="text-xs text-[#7b6660]">Sent This Month</p>
          <p className="text-2xl font-bold text-emerald-700">{sentThisMonth}</p>
          <p className="text-xs text-[#251E1F]/30">payslips delivered</p>
        </div>
      </div>

      {/* Section 3 — Quick Actions */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#251E1F]/30 mb-3">
          Quick Actions
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Upload Payroll", icon: "↑", path: "/dashboard/payroll/hr/upload", color: "bg-[#F38978]/20 hover:bg-[#F38978]/40" },
            { label: "New Payroll Run", icon: "+", path: "/dashboard/payroll/hr/payroll-runs", color: "bg-emerald-500/20 hover:bg-emerald-500/40" },
            { label: "View Pending", icon: "👁", path: "/dashboard/payroll/hr/payslips", color: "bg-yellow-500/20 hover:bg-yellow-500/40" },
            { label: "Staff Records", icon: "👥", path: "/dashboard/payroll/hr/staff", color: "bg-[#2D7C83]/20 hover:bg-[#2D7C83]/40" }
          ].map(action => (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              className={`${action.color} rounded-xl border border-[#f0d2ca] p-4 text-left transition`}
            >
              <span className="text-2xl">{action.icon}</span>
              <p className="text-sm font-semibold text-[#251E1F] mt-2">{action.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Section 3.5 — Advance Pay Requests */}
      {pendingRequests.length > 0 && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
          <button
            type="button"
            onClick={() => setShowRequests(!showRequests)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🔔</span>
              <span className="text-sm font-semibold text-[#251E1F]">
                Pending Advance Requests ({pendingRequests.length})
              </span>
            </div>
            <span className="text-xs text-[#251E1F]/50">{showRequests ? "▲ Hide" : "▼ View"}</span>
          </button>

          {showRequests && (
            <div className="mt-4 space-y-3">
              {pendingRequests.map(req => (
                <div key={req.request_id} className="flex items-center justify-between rounded-lg border border-[#f0d2ca] bg-white/80 p-3">
                  <div>
                    <p className="text-sm font-medium text-[#251E1F]">{req.staff_id}</p>
                    <p className="text-xs text-[#7b6660]">
                      ${Number(req.requested_amount).toLocaleString()} — {req.reason || "No reason provided"}
                    </p>
                    <p className="text-xs text-[#251E1F]/30 mt-1">{timeAgo(req.created_at)}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleApproveRequest(req.request_id)}
                      disabled={processingId === req.request_id}
                      className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-500/30 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectRequest(req.request_id)}
                      disabled={processingId === req.request_id}
                      className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-500/30 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Section 4 — Four Column Bottom Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Column 1 — Upcoming Deadlines */}
        <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#251E1F]/30 mb-3">
            📅 Upcoming Deadlines
          </p>
          {deadlines.map(d => (
            <div key={d.label} className="flex items-center justify-between py-2 border-b border-[#f0d2ca] last:border-b-0">
              <div className="flex items-center gap-2">
                <span>{d.icon}</span>
                <span className="text-sm text-[#251E1F]">{d.label}</span>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                d.days <= 7 ? "bg-red-500/20 text-red-700" :
                d.days <= 14 ? "bg-yellow-500/20 text-yellow-700" :
                "bg-emerald-500/20 text-emerald-700"
              }`}>
                {d.days}d
              </span>
            </div>
          ))}
        </div>

        {/* Column 2 — Recent Activity */}
        <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#251E1F]/30 mb-3">
            🕓 Recent Activity
          </p>
          {auditLog.length === 0 ? (
            <p className="text-xs text-[#251E1F]/30">No recent activity</p>
          ) : (
            auditLog.map((log, i) => (
              <div key={i} className="flex items-start gap-2 py-2 border-b border-[#f0d2ca] last:border-b-0">
                <div className="mt-1 h-2 w-2 rounded-full bg-[#F38978] shrink-0" />
                <div>
                  <p className="text-xs text-[#251E1F]">{log.action}</p>
                  <p className="text-xs text-[#251E1F]/30">{timeAgo(log.created_at)}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Column 3 — Birthdays This Month */}
        <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#251E1F]/30 mb-3">
            🎂 Birthdays This Month
          </p>
          {birthdaysThisMonth.length === 0 ? (
            <p className="text-xs text-[#251E1F]/30">No birthdays this month</p>
          ) : (
            birthdaysThisMonth.map(s => (
              <div key={s.employee_id} className="flex items-center justify-between py-2 border-b border-[#f0d2ca] last:border-b-0">
                <div>
                  <p className="text-sm text-[#251E1F]">{s.name}</p>
                  <p className="text-xs text-[#251E1F]/30">
                    {new Date(s.date_of_birth).toLocaleDateString("en-SG", { day: "numeric", month: "short" })}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                  s.daysUntil === 0 ? "bg-red-500/20 text-red-700" :
                  s.daysUntil < 0   ? "bg-gray-400/20 text-gray-500" :
                  s.daysUntil <= 7  ? "bg-yellow-500/20 text-yellow-700" :
                                      "bg-emerald-500/20 text-emerald-700"
                }`}>
                  {s.daysUntil === 0 ? "Today! 🎉" :
                   s.daysUntil < 0  ? `${Math.abs(s.daysUntil)}d ago` :
                   `in ${s.daysUntil}d`}
                </span>
              </div>
            ))
          )}
          <p className="text-xs text-[#251E1F]/20 mt-3">For reference only</p>
        </div>

        {/* Column 4 — Payroll Cost by Department */}
        <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#251E1F]/30 mb-3">
            📊 Payroll by Department
          </p>
          {deptTotals.map(dept => (
            <div key={dept.name} className="mb-3 last:mb-0">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#251E1F]">{dept.name}</span>
                <span className="text-[#7b6660]">${dept.total.toLocaleString()}</span>
              </div>
              <div className="h-2 rounded-full bg-white/80">
                <div
                  className="h-2 rounded-full bg-[#F38978] transition-all duration-700"
                  style={{ width: `${(dept.total / maxTotal) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 5 — Payroll History */}
      <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-[#251E1F]">📊 Payroll Cost — Last 6 Months</p>
          <p className="text-xs text-[#251E1F]/30">Net pay distributed</p>
        </div>

        {payrollHistoryData.every(d => d.total === 0) ? (
          <p className="text-xs text-[#251E1F]/20">No payroll data yet</p>
        ) : (
          <div className="space-y-3">
            {payrollHistoryData.map((month, i) => {
              const isCurrent = i === payrollHistoryData.length - 1;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className={`text-xs w-16 shrink-0 ${isCurrent ? "text-[#251E1F] font-semibold" : "text-[#251E1F]/50"}`}>
                    {month.shortLabel} {String(month.label).split(" ")[1]?.slice(2)}
                  </span>
                  <div className="flex-1 h-5 rounded-full bg-white/80 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${month.total > 0 ? (month.total / maxPayroll) * 100 : 0}%`,
                        background: "linear-gradient(to right, #F38978, #F38978)",
                        opacity: isCurrent ? 1 : 0.4
                      }}
                    />
                  </div>
                  <span className={`text-xs w-20 text-right shrink-0 ${isCurrent ? "text-[#251E1F] font-semibold" : "text-[#251E1F]/50"}`}>
                    {month.total > 0 ? `$${month.total.toLocaleString()}` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function getAuthHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function displayCellValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  // Excel hyperlink cells may come as objects, e.g. { text, hyperlink }
  if (typeof value === "object") {
    if (typeof value.text === "string" && value.text.trim()) {
      return value.text;
    }
    if (typeof value.hyperlink === "string" && value.hyperlink.trim()) {
      return value.hyperlink;
    }
    try {
      return JSON.stringify(value);
    } catch (_err) {
      return "[object]";
    }
  }

  return String(value);
}

function getStaffDisplayName(staff) {
  return staff?.staff_name || staff?.name || staff?.full_name || "-";
}

function getStaffDisplayId(staff) {
  return staff?.employee_id || staff?.staff_id || staff?.id || "-";
}

function getStaffDisplayDepartment(staff) {
  return staff?.department || staff?.department_name || staff?.department_id || "-";
}

function getStaffDisplayHireDate(staff) {
  const raw = staff?.hire_date || staff?.hireDate || staff?.hired_at;
  if (!raw) return "-";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-SG", { day: "2-digit", month: "short", year: "numeric" });
}

function getStaffActionId(staff) {
  return staff?.employee_id || staff?.staff_id || staff?.id || "";
}

function StaffRecordsView({ onStartHire }) {
  const session = getStoredSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [staffRecords, setStaffRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const departmentNames = {
    1: "Human Resources",
    2: "Finance & Accounting",
    3: "Sales",
    4: "Customer Service",
    5: "Operations",
    6: "Management",
    7: "IT / System Administrator"
  };
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [advanceRequests, setAdvanceRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [highlightedStaffId, setHighlightedStaffId] = useState("");
  const rowRefs = useRef(new Map())
  const [historyStaff, setHistoryStaff] = useState(null);
  const [historyPayslips, setHistoryPayslips] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const handleViewHistory = async (staff) => {
    setHistoryStaff(staff);
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/hr/payslips`, {
        headers: { ...getAuthHeaders(session?.token) }
      });
      const data = await res.json();
      const staffId = staff.employee_id || staff.staff_id;
      const filtered = Array.isArray(data)
        ? data.filter(p => p.employee_id === staffId)
        : [];
      setHistoryPayslips(filtered);
    } catch {
      setHistoryPayslips([]);
    } finally {
      setHistoryLoading(false);
    }
};

  const getRowKey = (staff) => String(staff.employee_id || staff.staff_id || staff.email || staff.staff_name || staff.name || "");

  const filteredStaff = useMemo(() => {
    const query = searchTerm.trim();
    if (!query) return staffRecords;

    return staffRecords.filter((staff) =>
      recordMatchesSearch(staff, query, ["name", "staff_name", "email", "department", "department_id", "position", "job_title", "employee_id", "staff_id", "employee_code"])
    );
  }, [staffRecords, searchTerm]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const totalPages = Math.ceil(filteredStaff.length / PAGE_SIZE);
  const paginatedStaff = filteredStaff.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  async function exportStaffCSV() {
    try {
      const session = getStoredSession();
      const token = session?.token;
      const response = await fetch(`${API_BASE_URL}/api/hr/staff/export/excel`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `staff_records_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Staff export failed:", err);
    }
  }

  const registerRowRef = (key) => (node) => {
    if (!key) return;
    if (node) {
      rowRefs.current.set(key, node);
    } else {
      rowRefs.current.delete(key);
    }
  };

  useEffect(() => {
    const highlight = new URLSearchParams(location.search).get("highlight") || "";
    if (!highlight) {
      setHighlightedStaffId("");
      return undefined;
    }

    setHighlightedStaffId(highlight);
    const row = rowRefs.current.get(highlight);
    if (row && typeof row.scrollIntoView === "function") {
      row.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    const timer = setTimeout(() => {
      setHighlightedStaffId("");
      navigate("/dashboard/payroll/hr/staff", { replace: true });
    }, 1400);

    return () => clearTimeout(timer);
  }, [location.search, navigate, staffRecords.length]);

  useEffect(() => {
    const query = searchTerm.trim();
    if (!query || filteredStaff.length === 0) return undefined;

    const firstMatchKey = getRowKey(filteredStaff[0]);
    const timer = setTimeout(() => {
      const row = rowRefs.current.get(firstMatchKey);
      if (row && typeof row.scrollIntoView === "function") {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [filteredStaff, searchTerm]);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(`${API_BASE_URL}/api/hr/staff`, {
        headers: {
          ...getAuthHeaders(session?.token)
        }
      });

      if (response.status === 401 || response.status === 403) {
        return handleUnauthorized();
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to load staff records");
      }

      const data = await response.json();
      setStaffRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load staff records");
      setError(err.name === 'TypeError' ? "Network error: Server unreachable" : err.message || "Failed to load staff records");
      setStaffRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUnauthorized = () => {
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("authUser");
    navigate("/login", { state: { from: location, message: "Session expired. Please login again." } });
    return null;
  };

  const handleEdit = (staff) => {
    setEditingStaff(staff);
    // Normalize DB tinyint status (1/0) to string for the select
    const rawStatus = staff.status;
    let statusStr = "Active";
    if (rawStatus === 0 || rawStatus === "0" || String(rawStatus).toLowerCase() === "inactive") statusStr = "Inactive";
    else if (String(rawStatus).toLowerCase() === "leave") statusStr = "Leave";
    setEditFormData({
      email: staff.email || "",
      phone: staff.phone || "",
      address: staff.address || "",
      department_id: staff.department_id || "",
      base_salary: staff.base_salary || "",
      status: statusStr,
      date_of_birth: staff.date_of_birth ? new Date(staff.date_of_birth).toISOString().slice(0, 10) : "",
      race: staff.race || "",
      religion: staff.religion || "",
      staffRequestConfirmed: false
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateStaff = async () => {
    if (!editingStaff) return;

    const emailChanged  = editFormData.email   !== (editingStaff.email   || "");
    const phoneChanged  = editFormData.phone   !== (editingStaff.phone   || "");
    const addressChanged = editFormData.address !== (editingStaff.address || "");

    if ((emailChanged || phoneChanged || addressChanged) && !editFormData.staffRequestConfirmed) {
      setFieldError("Confirm that personal field changes were requested by the staff member.");
      setError("Confirm that personal field changes were requested by the staff member.");
      return;
    }

    try {
      setError("");
      setFieldError("");

      // Build payload carefully — never overwrite a DB value with an empty string.
      // Each field is only included if it has a real value OR the form field changed.
      const payload = {};

      // status — always send, it's the main reason HR opens this modal
      payload.status = editFormData.status;

      // base_salary — only send if the form field has a numeric value
      if (editFormData.base_salary !== "" && editFormData.base_salary !== null) {
        payload.base_salary = editFormData.base_salary;
      }

      // department_id — only send if not empty
      if (editFormData.department_id !== "" && editFormData.department_id !== null) {
        payload.department_id = editFormData.department_id;
      }

      // email — send the new value if changed, or preserve existing if unchanged
      if (emailChanged) {
        payload.email = editFormData.email || null;
      } else if (editingStaff.email) {
        payload.email = editingStaff.email;
      }

      // phone — same logic
      if (phoneChanged) {
        payload.phone = editFormData.phone || null;
      } else if (editingStaff.phone) {
        payload.phone = editingStaff.phone;
      }

      // date_of_birth, race, religion — HR-managed fields, always include if present
      if (editFormData.date_of_birth !== "") payload.date_of_birth = editFormData.date_of_birth || null;
      if (editFormData.race     !== "")  payload.race     = editFormData.race     || null;
      if (editFormData.religion !== "")  payload.religion = editFormData.religion || null;

      const response = await fetch(`${API_BASE_URL}/api/hr/staff/${getStaffActionId(editingStaff)}`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(session?.token),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (response.status === 401 || response.status === 403) {
        return handleUnauthorized();
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to update staff record");
      }

      setSuccessMessage("Staff record updated successfully");
      setIsEditModalOpen(false);
      setEditingStaff(null);
      await fetchStaff();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(err.name === 'TypeError' ? "Network error: Unable to reach server" : err.message || "Failed to update staff record");
    }
  };

  const handleDeleteStaff = async (staffId) => {
    if (!window.confirm("Are you sure you want to delete this staff record?")) return;

    try {
      setError("");
      const response = await fetch(`${API_BASE_URL}/api/hr/staff/${staffId}`, {
        method: "DELETE",
        headers: {
          ...getAuthHeaders(session?.token)
        }
      });

      if (response.status === 401 || response.status === 403) {
        return handleUnauthorized();
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to delete staff record");
      }

      setSuccessMessage("Staff record deleted successfully");
      await fetchStaff();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(err.name === 'TypeError' ? "Network error: Unable to reach server" : err.message || "Failed to delete staff record");
    }
  };

  const fetchAdvanceRequests = async () => {
    try {
      setLoadingRequests(true);
      setError("");
      const response = await fetch(`${API_BASE_URL}/api/hr/advance-requests`, {
        headers: {
          ...getAuthHeaders(session?.token)
        }
      });

      if (response.status === 401 || response.status === 403) {
        return handleUnauthorized();
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to load advance requests');
      }

      const data = await response.json();
      setAdvanceRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError(err.name === 'TypeError' ? "Network error: Server unreachable" : "Failed to load requests");
    } finally {
      setLoadingRequests(false);
    }
  };


  const approveAdvanceRequest = async (requestId) => {
    try {
      setApprovingId(requestId);
      setError('');
      const response = await fetch(`${API_BASE_URL}/api/hr/advance-requests/${requestId}/approve`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(session?.token),
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401 || response.status === 403) {
        return handleUnauthorized();
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to approve');
      }

      await fetchAdvanceRequests();
      setSuccessMessage('Advance request approved and queued for Finance');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      setError(err.name === 'TypeError' ? "Network error: Unable to reach server" : err.message || 'Failed to approve');
    } finally {
      setApprovingId(null);
    }
  };

  useEffect(() => {
    fetchStaff();
    fetchAdvanceRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  useEffect(() => {
    if (!isEditModalOpen) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setIsEditModalOpen(false);
        setEditingStaff(null);
        setFieldError("");
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isEditModalOpen]);

  return (
    <div className="space-y-5">
      <div className="app-panel rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-[#251E1F]">Staff Records</h3>
          </div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={fetchStaff} className="rounded-lg border border-[#f0d2ca] bg-white/80 px-4 py-2 text-sm font-medium text-[#251E1F] hover:bg-[#FDD9CD]/45">Refresh</button><button type="button" onClick={onStartHire} className="primary-button inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"><Users size={16}/>Hire staff and create user</button></div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
          <label className="block text-sm text-[#7b6660]">
            Search staff records...
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search staff records..."
              className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-[#251E1F] outline-none placeholder:text-[#7b6660]/50"
            />
          </label>
          <button
            type="button"
            onClick={exportStaffCSV}
            className="rounded-lg bg-emerald-500/20 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-500/40 flex items-center gap-2 shrink-0"
          >
            ⬇ Export XLSX
          </button>
          <div className="text-sm text-[#7b6660]">
            {getSearchCountLabel(filteredStaff.length, staffRecords.length, searchTerm.trim())}
          </div>
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

      <div className="app-panel rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center gap-3 p-6 text-[#7b6660]">
            <Loader2 className="animate-spin" size={18} />
            Loading staff records...
          </div>
        ) : staffRecords.length === 0 ? (
          <div className="p-6 text-sm text-[#7b6660]">
            No staff records found. Add a new staff member or upload a payroll file to get started.
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-6 text-sm text-[#7b6660]">
            No records match your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#f0d2ca] bg-white/80 text-[#7b6660]">
                <tr>
                  <th className="px-4 py-3 font-medium">Employee Code</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Base Salary</th>
                  <th className="px-4 py-3 font-medium">Hire Date</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStaff.map((staff) => {
                  const rowKey = getRowKey(staff);
                  const isHighlighted = highlightedStaffId && highlightedStaffId === rowKey;
                  const isSearchMatched = searchTerm.trim().length > 0;

                  return (
                    <tr
                      key={rowKey}
                      ref={registerRowRef(rowKey)}
                      className={`border-b border-[#f0d2ca] text-[#251E1F] transition-colors duration-700 ${isSearchMatched ? "bg-amber-400/10" : ""} ${isHighlighted ? "bg-yellow-400/20 ring-2 ring-yellow-300/70" : ""}`}
                    >
                    <td className="px-4 py-3 text-[#7b6660]"><HighlightText text={staff.employee_code || getStaffDisplayId(staff)} query={searchTerm.trim()} /></td>
                    <td className="px-4 py-3"><HighlightText text={staff.name || staff.staff_name || ""} query={searchTerm.trim()} /></td>
                    <td className="px-4 py-3 text-[#7b6660]"><HighlightText text={departmentNames[staff.department_id] || "—"} query={searchTerm.trim()} /></td>
                    <td className="px-4 py-3 text-[#7b6660]">
                      ${staff.base_salary || "-"}</td>
                    <td className="px-4 py-3 text-[#7b6660]">{getStaffDisplayHireDate(staff)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        staff.status === 1 || staff.status === '1'
                          ? "bg-emerald-500/20 text-emerald-700"
                          : "bg-red-500/20 text-red-700"
                      }`}>
                        {staff.status === 1 || staff.status === '1' ? "Active" : "Inactive"}
                      </span>
                    </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                            <button type="button" onClick={() => handleEdit(staff)} className="rounded-lg bg-[#2D7C83]/20 px-3 py-1 text-xs text-[#2D7C83] hover:bg-[#2D7C83]/30">Edit</button>
                            <button type="button" onClick={() => handleDeleteStaff(getStaffActionId(staff))} className="rounded-lg bg-red-500/20 px-3 py-1 text-xs text-red-700 hover:bg-red-500/30" >
                            Delete
                          </button>
                          <button type="button" onClick={() => handleViewHistory(staff)} className="rounded-lg bg-white/80 px-3 py-1 text-xs text-[#251E1F]/60 hover:bg-white/20">History</button>
                        </div>
                      </td>
                      </tr>
                  );
                })}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 px-4 pb-4">
                <p className="text-xs text-[#251E1F]/30">
                  Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filteredStaff.length)} of {filteredStaff.length} staff
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-1 text-sm text-[#251E1F] disabled:opacity-30 hover:bg-[#FDD9CD]/45"
                  >
                    ← Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`rounded-lg border px-3 py-1 text-sm transition ${
                        page === currentPage
                          ? 'border-[#F38978] bg-[#F38978]/30 text-[#251E1F]'
                          : 'border-[#f0d2ca] bg-white/80 text-[#251E1F]/50 hover:bg-[#FDD9CD]/45'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-1 text-sm text-[#251E1F] disabled:opacity-30 hover:bg-[#FDD9CD]/45"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {isEditModalOpen && editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#251E1F]/50">
          <div className="app-panel rounded-2xl w-full max-w-md p-6 m-4 max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="staff-edit-title">
            <h3 id="staff-edit-title" className="text-lg font-semibold text-[#251E1F]">Edit Staff Record</h3>
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-4">
                <p className="text-sm font-medium text-[#251E1F]">{getStaffDisplayName(editingStaff)}</p>
                <p className="mt-1 text-xs text-[#7b6660]">{getStaffDisplayId(editingStaff)}</p>
                <p className="mt-3 text-xs text-[#7b6660]">
                  Personal fields below must only be updated when requested by the staff member.
                </p>
              </div>
              <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-4">
                <p className="text-sm font-semibold text-[#251E1F]">Personal Fields</p>
                <div className="mt-3 space-y-3">
                  <div>
                    <label htmlFor="staff-edit-email" className="block text-sm font-medium text-[#7b6660]">Email</label>
                    <input
                      id="staff-edit-email"
                      type="email"
                      value={editFormData.email || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-[#251E1F] placeholder-white/30"
                    />
                  </div>
                  <div>
                    <label htmlFor="staff-edit-phone" className="block text-sm font-medium text-[#7b6660]">Phone</label>
                    <input
                      id="staff-edit-phone"
                      type="tel"
                      value={editFormData.phone || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-[#251E1F] placeholder-white/30"
                    />
                  </div>
                  <div>
                    <label htmlFor="staff-edit-address" className="block text-sm font-medium text-[#7b6660]">Address</label>
                    <input
                      id="staff-edit-address"
                      type="text"
                      value={editFormData.address || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-[#251E1F] placeholder-white/30"
                    />
                  </div>
                  <label className="flex items-start gap-2 text-xs text-[#7b6660]">
                    <input
                      type="checkbox"
                      checked={Boolean(editFormData.staffRequestConfirmed)}
                      onChange={(e) => setEditFormData({ ...editFormData, staffRequestConfirmed: e.target.checked })}
                      aria-invalid={Boolean(fieldError)}
                      aria-describedby={fieldError ? "staff-request-error" : undefined}
                      className="mt-0.5"
                    />
                    Staff member formally requested these personal field changes.
                  </label>
                  {fieldError ? (
                    <p id="staff-request-error" className="text-xs text-red-700">
                      {fieldError}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-4">
                <p className="text-sm font-semibold text-[#251E1F]">Employment Fields</p>
              <div>
                <label htmlFor="staff-edit-department" className="block text-sm font-medium text-[#7b6660]">Department ID</label>
                <input
                  id="staff-edit-department"
                  type="text"
                  value={editFormData.department_id || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, department_id: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-[#251E1F] placeholder-white/30"
                />
              </div>
              <div>
                <label htmlFor="staff-edit-base-salary" className="block text-sm font-medium text-[#7b6660]">Base Salary</label>
                <input
                  id="staff-edit-base-salary"
                  type="number"
                  value={editFormData.base_salary || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, base_salary: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-[#251E1F] placeholder-white/30"
                />
              </div>
              <div>
                <label htmlFor="staff-edit-dob" className="block text-sm font-medium text-[#7b6660]">Date of Birth</label>
                <input
                  id="staff-edit-dob"
                  type="date"
                  value={editFormData.date_of_birth || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, date_of_birth: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-[#251E1F]"
                />
              </div>
              <div>
                <label htmlFor="staff-edit-race" className="block text-sm font-medium text-[#7b6660]">Race</label>
                <input
                  id="staff-edit-race"
                  type="text"
                  value={editFormData.race || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, race: e.target.value })}
                  placeholder="e.g. Chinese, Malay, Indian, Others"
                  className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-[#251E1F] placeholder-[#251E1F]/30"
                />
              </div>
              <div>
                <label htmlFor="staff-edit-religion" className="block text-sm font-medium text-[#7b6660]">Religion</label>
                <input
                  id="staff-edit-religion"
                  type="text"
                  value={editFormData.religion || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, religion: e.target.value })}
                  placeholder="e.g. Buddhism, Islam, Christianity, Hinduism"
                  className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-[#251E1F] placeholder-[#251E1F]/30"
                />
              </div>
              <div>
                <label htmlFor="staff-edit-status" className="block text-sm font-medium text-[#7b6660]">Status</label>
                <select
                  id="staff-edit-status"
                  value={editFormData.status || "Active"}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-[#251E1F]"
                >
                  <option value="Active" style={{ backgroundColor: '#251E1F', color: '#ffffff' }}>Active</option>
                  <option value="Inactive" style={{ backgroundColor: '#251E1F', color: '#ffffff' }}>Inactive</option>
                  <option value="Leave" style={{ backgroundColor: '#251E1F', color: '#ffffff' }}>Leave</option>
                </select>
              </div>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleUpdateStaff}
                className="flex-1 rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-500/30"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingStaff(null);
                }}
                className="flex-1 rounded-lg border border-[#f0d2ca] bg-white/80 px-4 py-2 text-sm font-medium text-[#251E1F] hover:bg-[#FDD9CD]/45"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {historyStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#251E1F]/50">
          <div className="app-panel rounded-2xl w-full max-w-2xl p-6 m-4" role="dialog">
            <h3 className="text-lg font-semibold text-[#251E1F]">
              Payroll History — {historyStaff.name || historyStaff.staff_name}
            </h3>
            <div className="mt-4 overflow-x-auto">
              {historyLoading ? (
                <p className="text-[#7b6660] text-sm">Loading...</p>
              ) : historyPayslips.length === 0 ? (
                <p className="text-[#7b6660] text-sm">No payroll history found for this employee.</p>
              ) : (
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-[#f0d2ca] text-[#7b6660]">
                    <tr>
                      <th className="px-3 py-2">Period</th>
                      <th className="px-3 py-2">Gross</th>
                      <th className="px-3 py-2">Deductions</th>
                      <th className="px-3 py-2">Net Pay</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyPayslips.map(p => (
                      <tr key={p.payslip_id} className="border-b border-[#f0d2ca] text-[#251E1F]">
                        <td className="px-3 py-2">{p.period_month} {p.period_year}</td>
                        <td className="px-3 py-2">${Number(p.gross_salary || 0).toFixed(2)}</td>
                        <td className="px-3 py-2 text-red-700">${Number(p.total_deductions || 0).toFixed(2)}</td>
                        <td className="px-3 py-2 text-emerald-700">${Number(p.net_pay || 0).toFixed(2)}</td>
                        <td className="px-3 py-2">{p.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <button
              className="mt-4 rounded-lg border border-[#f0d2ca] bg-white/80 px-4 py-2 text-sm text-[#251E1F] hover:bg-[#FDD9CD]/45"
              onClick={() => { setHistoryStaff(null); setHistoryPayslips([]); }}
            >
              Close
            </button>
          </div>
        </div>
      )}
      

      {/* Advance requests list for HR */}
      <div className="rounded-2xl border border-[#f0d2ca] bg-white/80 p-4">
        <h4 className="text-sm font-semibold text-[#251E1F]">Advance Pay Requests</h4>
        <div className="mt-3">
          {loadingRequests ? (
            <div className="text-sm text-[#7b6660]">Loading requests...</div>
          ) : advanceRequests.length === 0 ? (
            <div className="text-sm text-[#7b6660]">No advance requests</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[#f0d2ca] text-[#7b6660]"><tr><th className="px-3 py-2">ID</th><th className="px-3 py-2">Staff</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Actions</th></tr></thead>
                <tbody>
                  {advanceRequests.map(r=> (
                    <tr key={r.request_id} className="border-b border-[#f0d2ca] text-[#251E1F]"><td className="px-3 py-2 text-[#7b6660]">{r.request_id}</td><td className="px-3 py-2">{r.staff_id}</td><td className="px-3 py-2">${r.requested_amount}</td><td className="px-3 py-2 text-[#7b6660]">{r.status}</td><td className="px-3 py-2">{r.status==='pending' ? <button onClick={()=>approveAdvanceRequest(r.request_id)} disabled={approvingId===r.request_id} className="rounded-lg bg-[#F38978]/20 px-3 py-1 text-xs text-[#F38978] hover:bg-[#F38978]/30">{approvingId===r.request_id ? 'Approving...' : 'Approve'}</button> : '-'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PayrollUploadView() {
  const session = getStoredSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationResult, setValidationResult] = useState(null);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState(null);
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");
  const [alert, setAlert] = useState(null);

  const handleUnauthorized = () => {
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("authUser");
    navigate("/login", { state: { from: location, message: "Session expired." } });
  };

  // Step 1: Validate (preview only, no DB writes)
  const handleValidate = async (event) => {
    event.preventDefault();
    if (!selectedFile) { setError("Choose a CSV or XLSX file first."); return; }
    if (!/\.(csv|xlsx|xls)$/i.test(selectedFile.name)) { setError("Invalid file format. Please upload a CSV or XLSX file."); return; }
    if (selectedFile.size > 5 * 1024 * 1024) setWarning("Large file detected. Processing may take a moment.");

    let progressTimer;
    try {
      setUploading(true); setUploadProgress(10); setError(""); setValidationResult(null); setCommitResult(null); setAlert(null);
      progressTimer = window.setInterval(() => { setUploadProgress((c) => Math.min(c + 15, 90)); }, 120);

      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(`${API_BASE_URL}/api/hr/employees/validate`, {
        method: "POST", headers: { ...getAuthHeaders(session?.token) }, body: formData
      });
      if (response.status === 401 || response.status === 403) return handleUnauthorized();
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Validation failed");

      setValidationResult(body);
      // Auto-select all "new" rows
      const newIds = new Set((body.rows || []).filter(r => r.status === "new").map(r => r.id));
      setSelectedRows(newIds);
      setUploadProgress(100);

      // Show alert if duplicates or errors found
      if (body.summary?.duplicates > 0 || body.summary?.errors > 0) {
        setAlert({ severity: body.summary.errors > 0 ? "error" : "warning", title: "Issues Found", message: `${body.summary.duplicates} duplicate(s), ${body.summary.errors} error(s) detected. Review below before confirming.` });
      }
    } catch (err) {
      setError(err.name === "TypeError" ? "Network error: Server unreachable" : err.message || "Validation failed");
    } finally {
      if (progressTimer) window.clearInterval(progressTimer);
      setUploading(false); window.setTimeout(() => setUploadProgress(0), 500); window.setTimeout(() => setWarning(""), 5000);
    }
  };

  // Step 2: Commit selected rows
  const handleCommit = async () => {
    if (selectedRows.size === 0) { setError("Select at least one row to commit."); return; }
    try {
      setCommitting(true); setError("");
      const response = await fetch(`${API_BASE_URL}/api/hr/employees/commit`, {
        method: "POST",
        headers: { ...getAuthHeaders(session?.token), "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: validationResult.sessionId, selectedRowIds: [...selectedRows] })
      });
      if (response.status === 401 || response.status === 403) return handleUnauthorized();
      const body = await response.json().catch(() => ({}));
      if (response.status === 409) {
        setAlert({ severity: "error", title: "Concurrent Conflict", message: `${body.conflicts?.length || 0} record(s) were added by another user. Please re-upload to refresh.` });
        setCommitResult(body);
      } else if (!response.ok) {
        throw new Error(body.message || "Commit failed");
      } else {
        setCommitResult(body);
        setAlert({ severity: "success", title: "Records Created", message: `${body.totalCreated} record(s) saved successfully.` });
        setValidationResult(null); setSelectedFile(null);
      }
    } catch (err) {
      setError(err.message || "Commit failed");
    } finally {
      setCommitting(false);
    }
  };

  const toggleRow = (id) => {
    setSelectedRows(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const toggleAll = () => {
    const selectableIds = (validationResult?.rows || []).filter(r => r.status === "new").map(r => r.id);
    setSelectedRows(prev => prev.size === selectableIds.length ? new Set() : new Set(selectableIds));
  };

  return (
    <div className="space-y-5">
      <div className="app-panel rounded-2xl p-6">
        <div
          className="flex items-start gap-4 outline-none focus-within:ring-2 focus-within:ring-[#F38978] rounded-xl"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') document.getElementById('hr-sample-upload').click();
          }}
        >
          <div className="rounded-xl bg-[#F38978]/15 p-3 text-[#F38978] ring-1 ring-[#F38978]/25">
            <FileUp size={22} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#251E1F]">Upload Payroll Data</h3>
          </div>
        </div>
      </div>

      {/* Info banner — import is optional */}
      <div className="rounded-xl border border-[#2D7C83]/30 bg-[#2D7C83]/10 p-4 text-sm text-[#2D7C83]">
        <p className="mt-1 text-xs opacity-80">
          If your staff are already in <strong>Staff Records</strong>, you don't need to import anything.<br /><br />
          Employees already in the database will show as duplicates here. This is expected and correct.<br /><br />
          This page only performs validation.<br />
          Go to <strong>Payslips → Generate Payslips from Database</strong> to run payroll using existing staff records directly.</p>
          <button
          type="button"
          onClick={() => navigate("/dashboard/payroll/hr/payslips")}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#2D7C83] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2D7C83]/80"
        >
          Go to Generate Payslips →
        </button>
      </div>

      <form onSubmit={handleValidate} className="app-panel rounded-2xl p-6">
        <label htmlFor="hr-sample-upload" className="block text-sm font-medium text-[#251E1F]">Choose file to preview</label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            id="hr-sample-upload"
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(event) => {
              setSelectedFile(event.target.files?.[0] || null);
              setUploadProgress(0);
              setError(""); setValidationResult(null); setCommitResult(null); setAlert(null);
            }}
            className="block w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-sm text-[#251E1F] file:mr-4 file:rounded-md file:border-0 file:bg-[#F38978] file:px-4 file:py-2 file:text-white hover:file:bg-[#F38978]"
          />
          <button
            type="submit"
            disabled={uploading}
            className="inline-flex items-center justify-center rounded-lg bg-[#F38978] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#F38978] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {uploading ? (
              <span className="inline-flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Validating...</span>
            ) : (
              "Upload & Preview"
            )}
          </button>
        </div>
        <div className="mt-4 rounded-xl border border-[#f0d2ca] bg-white/80 px-4 py-3 text-sm text-[#7b6660]">
          Selected file: <span className="font-semibold text-[#251E1F]">{selectedFile?.name || "none"}</span>
        </div>
        {(uploading || uploadProgress > 0) ? (
          <div className="mt-4" role="progressbar" aria-label="Upload progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={uploadProgress}>
            <div className="h-3 overflow-hidden rounded-full border border-[#f0d2ca] bg-[#251E1F]/30">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all duration-150"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : null}
      </form>

      {error ? (
        <div className="app-panel rounded-2xl border-red-500/40 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {warning ? (
        <div className="app-panel rounded-2xl border-yellow-500/40 p-4 text-sm text-yellow-700">
          <span className="font-semibold">Note:</span> {warning}
        </div>
      ) : null}

      {/* Alert notification popup */}
      {alert ? (
        <div className={`rounded-2xl border p-4 text-sm flex items-start gap-3 ${
          alert.severity === "error" ? "border-red-500/40 bg-red-500/10 text-red-700" :
          alert.severity === "warning" ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-700" :
          "border-emerald-400/40 bg-emerald-400/10 text-emerald-700"
        }`}>
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">{alert.title}</p>
            <p className="mt-1 text-xs opacity-80">{alert.message}</p>
          </div>
          <button onClick={() => setAlert(null)} className="text-[#251E1F]/50 hover:text-[#251E1F] text-lg leading-none">&times;</button>
        </div>
      ) : null}

      {/* Preview table with status badges */}
      {validationResult ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#f0d2ca] bg-[#fff3ee]/90 p-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="text-[#251E1F] font-semibold">Preview:</span>
              <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-emerald-700">{validationResult.summary?.valid ?? 0} New</span>
              <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-yellow-700">{validationResult.summary?.duplicates ?? 0} Duplicates</span>
              <span className="rounded-full bg-red-500/20 px-3 py-1 text-red-700">{validationResult.summary?.errors ?? 0} Errors</span>
              <span className="text-[#7b6660]">Total: {validationResult.summary?.total ?? 0}</span>
            </div>
            {validationResult.summary?.valid === 0 && validationResult.summary?.errors === 0 && (validationResult.summary?.duplicates ?? 0) > 0 ? (
              <div className="mt-3 rounded-lg border border-[#2D7C83]/30 bg-[#2D7C83]/10 px-4 py-3 text-xs text-[#2D7C83]">
                <strong>All employees already exist in Staff Records.</strong> No new records to import — this is expected.
                You can proceed directly to <strong>Payslips → ⚡ Generate Payslips from Database</strong> to run payroll.
                <button type="button" onClick={() => navigate("/dashboard/payroll/hr/payslips")} className="ml-2 underline font-semibold">Go now →</button>
              </div>
            ) : null}
          </div>
          <div className="rounded-2xl border border-[#f0d2ca] bg-[#fff3ee]/90 p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-base font-semibold text-[#251E1F]">Records Preview</h4>
              <span className="text-xs text-[#7b6660]">{selectedRows.size} selected</span>
            </div>
            <div className="overflow-x-auto text-sm max-h-[400px] overflow-y-auto">
              <table className="min-w-full text-left">
                <thead className="border-b border-[#f0d2ca] text-[#7b6660] sticky top-0 bg-[#fff3ee]">
                  <tr>
                    <th className="px-2 py-2"><input type="checkbox" checked={selectedRows.size === (validationResult.rows || []).filter(r => r.status === "new").length && selectedRows.size > 0} onChange={toggleAll} className="accent-[#F38978]" /></th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Employee ID</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {(validationResult.rows || []).map((row) => (
                    <tr key={row.id} className={`border-b border-[#f0d2ca] ${row.status === "error" ? "bg-red-500/5" : row.status === "duplicate" ? "bg-yellow-500/5" : ""}`}>
                      <td className="px-2 py-2">{row.status === "new" ? <input type="checkbox" checked={selectedRows.has(row.id)} onChange={() => toggleRow(row.id)} className="accent-[#F38978]" /> : <span className="text-[#251E1F]/20">—</span>}</td>
                      <td className="px-3 py-2"><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${row.status === "new" ? "bg-emerald-500/20 text-emerald-700" : row.status === "duplicate" ? "bg-yellow-500/20 text-yellow-700" : "bg-red-500/20 text-red-700"}`}>{row.status}</span></td>
                      <td className="px-3 py-2 text-[#7b6660] text-xs">{row.rowNumber}</td>
                      <td className="px-3 py-2 text-[#251E1F]">{displayCellValue(row.data?.employee_id)}</td>
                      <td className="px-3 py-2 text-[#251E1F]">{displayCellValue(row.data?.name)}</td>
                      <td className="px-3 py-2 text-[#7b6660]">{displayCellValue(row.data?.email)}</td>
                      <td className="px-3 py-2 text-xs text-red-700/80">{row.errors?.length > 0 ? row.errors.join("; ") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-5 flex items-center gap-4">
              <button onClick={handleCommit} disabled={committing || selectedRows.size === 0} className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-[#251E1F] transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">
                {committing ? <span className="inline-flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Saving...</span> : `Confirm & Save ${selectedRows.size} Record(s)`}
              </button>
              <button onClick={() => { setValidationResult(null); setSelectedFile(null); setAlert(null); }} className="text-sm text-[#7b6660] hover:text-[#251E1F]">Cancel</button>
            </div>
          </div>
        </div>
      ) : null}

      {commitResult ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-6 text-[#251E1F]">
          <div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 size={18} /><span className="font-semibold">Commit Complete</span></div>
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-lg border border-[#f0d2ca] bg-[#251E1F]/10 px-3 py-2">Created: <span className="font-semibold text-[#251E1F]">{commitResult.totalCreated ?? 0}</span></div>
            <div className="rounded-lg border border-[#f0d2ca] bg-[#251E1F]/10 px-3 py-2">Skipped: <span className="font-semibold text-[#251E1F]">{commitResult.totalSkipped ?? 0}</span></div>
            <div className="rounded-lg border border-[#f0d2ca] bg-[#251E1F]/10 px-3 py-2">Conflicts: <span className="font-semibold text-[#251E1F]">{commitResult.conflicts?.length ?? 0}</span></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const HR_SELECTED_RUN_KEY = "hrPayrollSelectedRunId";

function SharedPayrollRunTracker({ workflow, run }) {
  const stages = (workflow?.stages || []).map((stage) => ({ ...stage, detail: `${stage.status}${stage.owner ? ` · ${stage.owner}` : ""}` }));
  return <PayrollProgressTracker ariaLabel="Shared payroll run progress" title="Shared payroll run progress" runId={run?.id} stages={stages} badge={<span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Live shared state</span>} />;
}

function HRPayrollRunWorkflowView({ deliveryMode = false }) {
  const session = getStoredSession();
  const hrSelectedRunKey = getCompanyScopedKey(HR_SELECTED_RUN_KEY, session?.user?.companyId);
  const navigate = useNavigate();
  const [runs, setRuns] = useState([]);
  const [selectedId, setSelectedId] = useState(() => sessionStorage.getItem(hrSelectedRunKey) || "");
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [payrollMonth, setPayrollMonth] = useState(new Date().toLocaleString("en-US", { month: "long" }));
  const [payrollYear, setPayrollYear] = useState(new Date().getFullYear());
  const headers = { Authorization: `Bearer ${session?.token || ""}` };

  const removeToast = (id) => setToasts((t) => t.filter(x => x.id !== id));
  const addToast = (type, message) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter(x => x.id !== id)), type === 'success' ? 5000 : 6000);
  };

  const loadRuns = async () => {
    const response = await fetch(`${API_BASE_URL}/api/payroll/workflow/runs`, { headers });
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(`Payroll service returned an unexpected ${response.status} response. Wait briefly and refresh.`);
    }
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || "Unable to load payroll runs.");
    const values = body.runs || [];
    setRuns(values);
    const next = values.some((run) => run.id === selectedId) ? selectedId : values[0]?.id || "";
    if (next !== selectedId) setSelectedId(next);
    return next;
  };
  const loadWorkflow = async (runId) => {
    if (!runId) return;
    const response = await fetch(`${API_BASE_URL}/api/payroll/workflow/runs/${encodeURIComponent(runId)}`, { headers });
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(`Payroll service returned an unexpected ${response.status} response. Wait briefly and refresh.`);
    }
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || "Unable to restore payroll workflow.");
    setState(body);
  };
  useEffect(() => { let active = true; (async () => { try { setLoading(true); const id = await loadRuns(); if (active) await loadWorkflow(id); } catch (e) { if (active) setError(e.message); } finally { if (active) setLoading(false); } })(); return () => { active = false; }; }, []);
  useEffect(() => { if (!selectedId) return undefined; sessionStorage.setItem(hrSelectedRunKey, selectedId); loadWorkflow(selectedId).catch((e) => setError(e.message)); const timer = window.setInterval(() => loadWorkflow(selectedId).catch(() => {}), sending ? 1000 : 4000); return () => window.clearInterval(timer); }, [selectedId, sending, hrSelectedRunKey]);
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview?.url]);

  const quickGenerate = async () => {
    try {
      setGenerating(true);
      setError("");
      const response = await fetch(`${API_BASE_URL}/api/hr/payslips/quick-generate`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ period_month: payrollMonth, period_year: payrollYear })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Failed to generate payroll run.");
      await loadRuns();
      setSelectedId(String(body.payroll_run_id || selectedId));
      await loadWorkflow(String(body.payroll_run_id || selectedId));
    } catch (e) {
      setError(e.message || "Failed to generate payroll run.");
    } finally {
      setGenerating(false);
    }
  };

  const sendRunToFinance = async () => {
    const draftIds = (run?.employees || [])
      .filter((employee) => String(employee.financeStatus || employee.status || "").toLowerCase() === "draft")
      .map((employee) => employee.payrollId);
    if (draftIds.length === 0) {
      setSuccessMessage("✅ All payslips are already with Finance. No action needed.");
      addToast("success", "All payslips are already with Finance. No action needed.");
      setTimeout(() => setSuccessMessage(""), 5000);
      return;
    }
    try {
      setSending(true);
      setError("");
      const response = await fetch(`${API_BASE_URL}/api/payroll/payslips/bulk-send-to-finance`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ payslip_ids: draftIds })
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 401 || response.status === 403) return handleUnauthorized();
      if (!response.ok) throw new Error(body.message || "Bulk send failed");
      setState((prev) => ({ ...prev, workflow: body.workflow || prev?.workflow, run: body.run || prev?.run }));
      setSuccessMessage(`✅ ${draftIds.length} payslip(s) sent to Finance.`);
      addToast("success", `${draftIds.length} payslip(s) sent to Finance.`);
      setTimeout(() => setSuccessMessage(""), 5000);
      setError("");
    } catch (e) {
      setError(e.message || "Bulk send failed");
      addToast("error", e.message || "Bulk send failed");
    } finally {
      setSending(false);
    }
  };

  const sendRunToStaff = async () => {
    const approvedIds = (run?.employees || [])
      .filter((employee) => String(employee.financeStatus || employee.status || "").toLowerCase() === "finance_approved")
      .map((employee) => employee.payrollId);
    if (approvedIds.length === 0) {
      setError("No approved payslips to send to staff");
      return;
    }
    try {
      setSending(true);
      setError("");
      let sentCount = 0;
      for (const id of approvedIds) {
        const res = await fetch(`${API_BASE_URL}/api/hr/payslips/${id}/send-to-staff`, {
          method: "PUT",
          headers
        });
        if (res.status === 401 || res.status === 403) return handleUnauthorized();
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || "Failed to send to staff");
        sentCount += 1;
      }
      setError("");
      setSuccessMessage(`✅ ${sentCount} payslip(s) sent to staff.`);
      addToast("success", `${sentCount} payslip(s) sent to staff.`);
      setTimeout(() => setSuccessMessage(""), 4000);
      await loadWorkflow(selectedId);
    } catch (e) {
      setError(e.message || "Failed to send to staff");
      addToast("error", e.message || "Failed to send to staff");
    } finally {
      setSending(false);
    }
  };

  const sendPending = async () => {
    try {
      setSending(true);
      setError("");
      const response = await fetch(`${API_BASE_URL}/api/hr/payroll-runs/${encodeURIComponent(selectedId)}/payslips/send`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: "{}"
      });
      const body = await readPayslipDeliveryResponse(response);
      if (!response.ok) throw new Error(body.message || "Payslip delivery could not be started.");

      const startedAt = getPayslipDeliveryStartedAt(body.startedAt);
      setSuccessMessage(body.message || "Payslip delivery started. Progress will update automatically.");
      addToast("success", body.message || "Payslip delivery started.");

      for (let attempt = 0; attempt < 150; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        const workflowResponse = await fetch(`${API_BASE_URL}/api/payroll/workflow/runs/${encodeURIComponent(selectedId)}`, { headers });
        const workflowType = workflowResponse.headers.get("content-type") || "";
        if (!workflowType.includes("application/json")) continue;
        const workflowBody = await workflowResponse.json();
        if (!workflowResponse.ok) throw new Error(workflowBody.message || "Unable to refresh payslip delivery progress.");
        setState(workflowBody);
        if (isPayslipDeliveryAttemptComplete(workflowBody, startedAt)) {
          const failed = getPayslipDeliveryFailureCount(workflowBody);
          if (failed) throw new Error(`${failed} payslip(s) could not be delivered. Correct the failed employee details, then retry.`);
          setSuccessMessage("Payslip delivery completed successfully.");
          return;
        }
      }
      throw new Error("Payslip delivery is still running. Use Refresh shortly to check its progress.");
    } catch (e) {
      setError(e.message || "Payslip delivery was not completed.");
      await loadWorkflow(selectedId).catch(() => {});
    } finally {
      setSending(false);
    }
  };
  const previewPayslip = async (employee) => { try { setError(""); const response = await fetch(`${API_BASE_URL}/api/payslips/${employee.payrollId}/pdf`, { headers }); if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.message || "Unable to preview payslip."); } const url = URL.createObjectURL(await response.blob()); setPreview({ url, name: employee.name }); } catch (e) { setError(e.message); } };
  const run = state?.run || runs.find((item) => item.id === selectedId);
  const progress = state?.workflow?.payslipProgress || {};
  if (loading) return <div className="app-panel flex items-center gap-2 rounded-2xl p-6"><Loader2 className="animate-spin" size={18}/>Loading shared payroll workflow…</div>;
  return <div className="space-y-5">
    {/* Toasts */}
    <div className="fixed top-4 right-4 z-50 space-y-2 min-w-[280px]">
      {toasts.map(t => (
        <div key={t.id} className={`rounded-xl px-4 py-3 shadow-xl border flex items-start gap-3 ${t.type === 'success' ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-red-600 text-white border-red-700'}`}>
          <span className="text-lg leading-none mt-0.5">{t.type === 'success' ? '✅' : '❌'}</span>
          <div className="flex-1 text-sm font-medium">{t.message}</div>
          <button onClick={() => removeToast(t.id)} className="text-white/70 hover:text-white text-xs shrink-0">✕</button>
        </div>
      ))}
    </div><SharedPayrollRunTracker workflow={state?.workflow} run={run}/><section className="app-panel rounded-2xl p-5"><div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><label className="flex-1 text-sm font-semibold">Selected payroll run<select className="mt-2 w-full rounded-xl border border-[#f0d2ca] bg-white px-3 py-2.5" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>{runs.map((item) => <option key={item.id} value={item.id}>{new Date(item.year, item.month - 1).toLocaleString("en-SG", { month: "long", year: "numeric" })} · {item.id} · {item.status}</option>)}</select></label><button type="button" onClick={() => loadWorkflow(selectedId)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#f0d2ca] px-4 py-2.5 text-sm font-semibold"><RefreshCw size={16}/>Refresh</button></div></section>{error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}{successMessage ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{successMessage}</div> : null}{deliveryMode ? <><section className="app-panel rounded-2xl p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">HR payslip delivery</h2><p className="mt-1 text-sm text-[#7b6660]">Finance must confirm settlement first. HR previews and delivers each employee payslip from this shared run.</p></div><button type="button" disabled={sending || !run?.paidAt || Boolean(run?.payslipsSentAt)} onClick={sendPending} className="inline-flex items-center gap-2 rounded-xl bg-[#F38978] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{sending ? <Loader2 className="animate-spin" size={16}/> : <Send size={16}/>} {sending ? "Delivering payslips…" : progress.failed ? "Retry failed payslips" : "Send pending payslips"}</button></div><div className="mt-5 grid gap-3 sm:grid-cols-4">{[["Total", progress.total || run?.employees?.length || 0], ["Sent", progress.sent || 0], ["Failed", progress.failed || 0], ["Pending", progress.pending ?? run?.employees?.length ?? 0]].map(([label,value]) => <div key={label} className="rounded-xl border border-[#f0d2ca] bg-[#fff8f5] p-4"><p className="text-xs uppercase text-[#7b6660]">{label}</p><strong className="mt-1 block text-xl">{value}</strong></div>)}</div><div className="mt-4 flex flex-wrap items-end gap-3"><div><label className="block text-xs font-semibold uppercase tracking-wider text-[#7b6660]">Payroll Month</label><select value={payrollMonth} onChange={(e) => setPayrollMonth(e.target.value)} className="mt-1 rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm text-[#251E1F]">{["January","February","March","April","May","June","July","August","September","October","November","December"].map((m) => <option key={m} value={m}>{m}</option>)}</select></div><div><label className="block text-xs font-semibold uppercase tracking-wider text-[#7b6660]">Payroll Year</label><input type="number" value={payrollYear} onChange={(e) => setPayrollYear(Number(e.target.value))} className="mt-1 w-28 rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm text-[#251E1F]" /></div><div className="flex flex-wrap gap-2"><button type="button" onClick={quickGenerate} disabled={generating} className="rounded-lg bg-[#F38978] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e87562] disabled:opacity-50">{generating ? "Generating..." : "⚡ Quick Generate"}</button><button type="button" onClick={sendRunToFinance} disabled={sending} className="rounded-lg bg-[#F38978]/20 px-4 py-2 text-sm font-medium text-[#F38978] hover:bg-[#F38978]/30 disabled:opacity-50">{sending ? "Sending..." : "Bulk Send to Finance"}</button><button type="button" onClick={sendRunToStaff} disabled={sending} className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-500/30 disabled:opacity-50">{sending ? "Sending..." : "Bulk Send to Staff"}</button></div></div>{!run?.paidAt ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Waiting for Finance to confirm payment settlement.</p> : null}</section><section className="app-panel overflow-hidden rounded-2xl"><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-[#fff8f5] text-xs uppercase text-[#7b6660]"><tr><th className="px-4 py-3">Employee</th><th>Department</th><th>Net pay</th><th>Status</th><th>Preview</th></tr></thead><tbody>{(run?.employees || []).map((employee) => <tr key={employee.payrollId} className="border-t border-[#f0d2ca]"><td className="px-4 py-3 font-semibold">{employee.name}</td><td>{employee.department || "Not recorded"}</td><td>${Number(employee.netPay || 0).toLocaleString("en-SG", { minimumFractionDigits: 2 })}</td><td><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${["Sent","sent_to_staff"].includes(employee.financeStatus) ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{["Sent","sent_to_staff"].includes(employee.financeStatus) ? "Delivered" : "Pending"}</span></td><td><button type="button" onClick={() => previewPayslip(employee)} className="rounded-lg border border-[#f0d2ca] px-3 py-1.5 text-xs font-semibold">Preview PDF</button></td></tr>)}</tbody></table></div></section></> : <section className="app-panel overflow-hidden rounded-2xl"><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-[#fff8f5] text-xs uppercase text-[#7b6660]"><tr><th className="px-4 py-3">Run</th><th>Period</th><th>Status</th><th>Employees</th><th>Gross</th><th>Net</th><th>Payment</th></tr></thead><tbody>{runs.map((item) => <tr key={item.id} onClick={() => setSelectedId(item.id)} className={`cursor-pointer border-t border-[#f0d2ca] hover:bg-[#fff8f5] ${selectedId === item.id ? "bg-[#F38978]/10" : ""}`}><td className="px-4 py-3 font-semibold">{item.id}</td><td>{new Date(item.year, item.month - 1).toLocaleString("en-SG", { month: "long", year: "numeric" })}</td><td>{item.status}</td><td>{item.employees?.length || 0}</td><td>${Number(item.totalGrossPay || 0).toLocaleString("en-SG", { minimumFractionDigits: 2 })}</td><td>${Number(item.totalNetPay || 0).toLocaleString("en-SG", { minimumFractionDigits: 2 })}</td><td>{item.paymentStatus || "Not started"}</td></tr>)}</tbody></table></div></section>}{preview ? <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-[#251E1F]/55 p-4"><section className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white"><header className="flex items-center justify-between border-b border-[#f0d2ca] p-4"><h3 className="font-semibold">{preview.name} · Payslip preview</h3><button onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }}><X size={20}/></button></header><iframe title="Payslip preview" src={preview.url} className="min-h-0 flex-1"/></section></div> : null}</div>;
}

function HRPayrollPoliciesView() {
  const [catalogue, setCatalogue] = useState(null); const [error, setError] = useState("");
  useEffect(() => { getEffectivePayrollRules().then(setCatalogue).catch((e) => setError(e.message)); }, []);
  return <div className="space-y-5"><section className="app-panel rounded-2xl p-6"><div className="flex gap-3"><ShieldCheck className="text-[#2D7C83]"/><div><h2 className="text-lg font-semibold">Payroll policies and supporting sources</h2><p className="mt-1 text-sm text-[#7b6660]">Read-only rules published by Payroll Admin. HR uses these references to maintain accurate staff source data and deliver compliant payslips.</p></div></div></section>{error ? <div className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div> : null}<section className="app-panel overflow-hidden rounded-2xl"><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-[#fff8f5] text-xs uppercase text-[#7b6660]"><tr><th className="px-4 py-3">Rule</th><th>Value</th><th>Effective</th><th>Source</th><th>Status</th></tr></thead><tbody>{(catalogue?.rules || []).map((rule) => <tr key={rule.key} className="border-t border-[#f0d2ca]"><td className="px-4 py-3"><strong>{rule.name}</strong><small className="block text-[#7b6660]">{rule.category}</small></td><td>{rule.value}</td><td>{rule.effectiveFrom}</td><td>{rule.referenceUrl ? <a href={rule.referenceUrl} target="_blank" rel="noreferrer" className="font-semibold text-[#2D7C83] underline">{rule.referenceTitle || "Official source"}</a> : "No source linked"}</td><td>{rule.status}</td></tr>)}</tbody></table></div></section></div>;
}

function PayrollRunsView() {
  const session = getStoredSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [payrollRuns, setPayrollRuns] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const rowRefs = useRef(new Map());
  const [expandedRunId, setExpandedRunId] = useState(null);
  const [runDetails, setRunDetails] = useState({});
  const [detailLoading, setDetailLoading] = useState(null);

  const handleUnauthorized = () => {
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("authUser");
    navigate("/login", { state: { from: location, message: "Session expired." } });
  };

  const getRowKey = (run) => run.payroll_run_id || run.run_id || run.id || "";

  const fetchRunDetail = async (runId) => {
    if (runDetails[runId]) {
      setExpandedRunId(expandedRunId === runId ? null : runId);
      return;
    }
    try {
      setDetailLoading(runId);
      setExpandedRunId(runId);
      const response = await fetch(`${API_BASE_URL}/api/hr/payroll-run/${runId}/payslips`, {
        headers: getAuthHeaders(session?.token)
      });
      if (response.status === 401 || response.status === 403) return handleUnauthorized();
      const data = await response.json();
      setRunDetails((prev) => ({ ...prev, [runId]: Array.isArray(data) ? data : [] }));
    } catch (err) {
      setRunDetails((prev) => ({ ...prev, [runId]: [] }));
    } finally {
      setDetailLoading(null);
    }
  };

  const fetchPayrollRuns = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(`${API_BASE_URL}/api/hr/payroll-run`, {
        headers: {
          ...getAuthHeaders(session?.token)
        }
      });

      if (response.status === 401 || response.status === 403) return handleUnauthorized();

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to load payroll runs");
      }

      const data = await response.json();
      setPayrollRuns(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.name === 'TypeError' ? "Network error: Server unreachable" : err.message || "Failed to load payroll runs");
      setPayrollRuns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayrollRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  const filteredPayrollRuns = useMemo(() => {
    const query = searchTerm.trim();
    let runs = payrollRuns;

    if (query) {
      runs = runs.filter((run) =>
        recordMatchesSearch(run, query, ["payroll_run_id", "run_id", "period", "period_month", "period_year", "status", "staff_name", "employee_name"])
      );
    }

    if (monthFilter) {
      const monthQuery = monthFilter.trim().toLowerCase();
      runs = runs.filter((run) => String(run.period_month || run.period || "").toLowerCase().includes(monthQuery));
    }

    if (yearFilter) {
      const yearQuery = yearFilter.trim().toLowerCase();
      runs = runs.filter((run) => String(run.period_year || run.period || "").toLowerCase().includes(yearQuery));
    }

    if (statusFilter) {
      const statusQuery = statusFilter.trim().toLowerCase();
      runs = runs.filter((run) => String(run.status || "").toLowerCase() === statusQuery);
    }

    return runs;
  }, [payrollRuns, searchTerm, monthFilter, yearFilter, statusFilter]);

  useEffect(() => {
    const query = searchTerm.trim();
    if (!query || filteredPayrollRuns.length === 0) return undefined;

    const firstMatchKey = getRowKey(filteredPayrollRuns[0]);
    const timer = setTimeout(() => {
      const row = rowRefs.current.get(firstMatchKey);
      if (row && typeof row.scrollIntoView === "function") {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [filteredPayrollRuns, searchTerm]);

  return (
    <div className="space-y-5">
      {error ? (
        <div className="app-panel rounded-2xl border-red-500/40 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="app-panel rounded-2xl p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-sm text-[#7b6660]">
            Search
            <input
              id="payroll-run-search"
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search staff or period"
              className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-[#251E1F]"
            />
          </label>
          <label className="text-sm text-[#7b6660]">
            Month
            <input
              id="payroll-run-month"
              type="text"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              placeholder="June"
              className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-[#251E1F]"
            />
          </label>
          <label className="text-sm text-[#7b6660]">
            Year
            <input
              id="payroll-run-year"
              type="number"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              placeholder="2026"
              className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-[#251E1F]"
            />
          </label>
          <label className="text-sm text-[#7b6660]">
            Status
            <select
              id="payroll-run-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-[#251E1F]"
            >
              <option value="">All</option>
              <option value="created">Created</option>
              <option value="payslips_generated">Payslips Generated</option>
              <option value="completed">Completed</option>
            </select>
          </label>
        </div>
        <div className="mt-3 text-sm text-[#7b6660]">
          {getSearchCountLabel(filteredPayrollRuns.length, payrollRuns.length, searchTerm.trim())}
        </div>
      </div>

      <div className="app-panel rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center gap-3 p-6 text-[#7b6660]">
            <Loader2 className="animate-spin" size={18} />
            Loading payroll runs...
          </div>
        ) : payrollRuns.length === 0 ? (
          <div className="p-6 text-sm text-[#7b6660]">
            No payroll runs yet. Create a run when generating payslips.
          </div>
        ) : filteredPayrollRuns.length === 0 ? (
          <div className="p-6 text-sm text-[#7b6660]">
            No records match your search. No payroll records match your search or filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#f0d2ca] bg-white/80 text-[#7b6660]">
                <tr>
                  <th className="px-4 py-3 font-medium">Run ID</th>
                  <th className="px-4 py-3 font-medium">Period</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Staff Count</th>
                  <th className="px-4 py-3 font-medium">Total Amount</th>
                  <th className="px-4 py-3 font-medium">Run Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayrollRuns.map((run) => {
                  const rowKey = getRowKey(run);
                  const isSearchMatched = searchTerm.trim().length > 0;
                  const isExpanded = expandedRunId === (run.payroll_run_id || run.run_id);
                  const detail = runDetails[run.payroll_run_id || run.run_id];

                  return (
                    <Fragment key={rowKey}>
                      <tr
                        ref={(node) => {
                          if (node) { rowRefs.current.set(rowKey, node); } else { rowRefs.current.delete(rowKey); }
                        }}
                        onClick={() => fetchRunDetail(run.payroll_run_id || run.run_id)}
                        className={`border-b border-[#f0d2ca] text-[#251E1F] transition-colors duration-300 cursor-pointer hover:bg-white/80 ${isSearchMatched ? "bg-amber-400/10" : ""} ${isExpanded ? "bg-[#F38978]/10" : ""}`}
                      >
                        <td className="px-4 py-3 text-[#7b6660]">{run.payroll_run_id || run.run_id || "-"}</td>
                        <td className="px-4 py-3">
                          {run.period || `${run.period_month || "-"} ${run.period_year || ""}`.trim()}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                            run.status === "Closed" ? "bg-emerald-500/20 text-emerald-700" :
                            run.status === "finance_approved" ? "bg-emerald-500/20 text-emerald-700" :
                            run.status === "Draft" ? "bg-[#7B6660]/20 text-[#7B6660]" :
                            "bg-yellow-500/20 text-yellow-700"
                          }`}>
                            {run.status || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#7b6660]">{run.staff_count ?? run.total_payslips ?? 0}</td>
                        <td className="px-4 py-3 text-[#7b6660]">{run.total_amount || "-"}</td>
                        <td className="px-4 py-3 text-[#7b6660]">
                          {run.run_date || (run.created_at ? new Date(run.created_at).toLocaleDateString() : "-")}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="p-0">
                            <div className="bg-[#fff3ee] border-t border-b border-[#F38978]/30 px-6 py-4">
                              {detailLoading === (run.payroll_run_id || run.run_id) ? (
                                <div className="flex items-center gap-2 text-sm text-[#7b6660]">
                                  <Loader2 className="animate-spin" size={14} /> Loading staff details...
                                </div>
                              ) : !detail || detail.length === 0 ? (
                                <p className="text-sm text-[#7b6660]/60">No payroll records in this run.</p>
                              ) : (
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wider text-[#F38978]/70 mb-3">
                                    Staff in this run ({detail.length}) — sorted by Employee ID
                                  </p>
                                  <div className="overflow-x-auto rounded-lg border border-[#f0d2ca]">
                                    <table className="min-w-full text-left text-xs">
                                      <thead className="bg-white/80 text-[#7b6660]/80">
                                        <tr>
                                          <th className="px-3 py-2 font-medium">#</th>
                                          <th className="px-3 py-2 font-medium">Employee ID</th>
                                          <th className="px-3 py-2 font-medium">Name</th>
                                          <th className="px-3 py-2 font-medium">Email</th>
                                          <th className="px-3 py-2 font-medium">Base Salary</th>
                                          <th className="px-3 py-2 font-medium">Allowances</th>
                                          <th className="px-3 py-2 font-medium">Deductions</th>
                                          <th className="px-3 py-2 font-medium">Net Pay</th>
                                          <th className="px-3 py-2 font-medium">Status</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {detail.map((row, idx) => (
                                          <tr key={row.payroll_id} className="border-t border-[#f0d2ca] text-[#251E1F] hover:bg-white/80">
                                            <td className="px-3 py-2 text-[#7b6660]/60">{idx + 1}</td>
                                            <td className="px-3 py-2 text-[#7b6660]">{row.employee_id}</td>
                                            <td className="px-3 py-2 font-medium">{row.staff_name}</td>
                                            <td className="px-3 py-2 text-[#7b6660]">{row.email || "—"}</td>
                                            <td className="px-3 py-2">${Number(row.base_salary || 0).toLocaleString()}</td>
                                            <td className="px-3 py-2 text-emerald-700">${Number(row.total_allowances || 0).toLocaleString()}</td>
                                            <td className="px-3 py-2 text-red-700">-${Number(row.total_deductions || 0).toLocaleString()}</td>
                                            <td className="px-3 py-2 font-semibold">${Number(row.net_salary || 0).toLocaleString()}</td>
                                            <td className="px-3 py-2">
                                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                                row.payslip_status === "sent_to_staff" ? "bg-emerald-500/20 text-emerald-700" :
                                                row.payslip_status === "finance_approved" ? "bg-emerald-500/20 text-emerald-700" :
                                                row.payslip_status === "finance_pending" ? "bg-yellow-500/20 text-yellow-700" :
                                                "bg-white/80 text-[#7b6660]"
                                              }`}>
                                                {row.payslip_status || "draft"}
                                              </span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function PayslipsView({ holdTooltip, setHoldTooltip, openHoldTooltip, getHoldTooltipData }) {
  const session = getStoredSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [payslips, setPayslips] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [payrollMonth, setPayrollMonth] = useState(new Date().toLocaleString('en-US', { month: 'long' }));
  const [payrollYear, setPayrollYear] = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [actionInProgress, setActionInProgress] = useState(null);
  const rowRefs = useRef(new Map());
  const generateSectionRef = useRef(null);
  const [previewPayslip, setPreviewPayslip] = useState(null);
  const [expandedCpf, setExpandedCpf] = useState(null);

  const handleUnauthorized = () => {
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("authUser");
    navigate("/login", { state: { from: location, message: "Session expired." } });
  };

  const getRowKey = (payslip) => payslip.payslip_id || payslip.employee_id || payslip.staff_name || "";

  const handleQuickGenerate = async () => {
    try {
      setGenerating(true);
      setError("");
      setSuccessMessage("");
      const response = await fetch(`${API_BASE_URL}/api/hr/payslips/quick-generate`, {
        method: "POST",
        headers: { ...getAuthHeaders(session?.token), "Content-Type": "application/json" },
        body: JSON.stringify({ period_month: payrollMonth, period_year: payrollYear })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Failed to generate payslips");
      setSuccessMessage(`Generated ${result.generated_count} payslips from database. ${result.skipped_count} skipped. Net total: $${result.summary.total_net}`);
      await fetchPayslips();
      setTimeout(() => setSuccessMessage(""), 6000);
    } catch (err) {
      setError(err.message || "Quick generate failed");
    } finally {
      setGenerating(false);
    }
  };

  const fetchPayslips = async () => {
    try {
      setLoading(true);
      setError("");
      const url = new URL(`${API_BASE_URL}/api/hr/payslips`);
      if (filterMonth) url.searchParams.set('month', filterMonth);
      if (filterYear) url.searchParams.set('year', filterYear);
      const response = await fetch(url.toString(), {
        headers: {
          ...getAuthHeaders(session?.token)
        }
      });

      if (response.status === 401 || response.status === 403) return handleUnauthorized();

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to load payslips");
      }

      const data = await response.json();
      setPayslips(Array.isArray(data) ? data : []);
      setSelectedIds(new Set());
    } catch (err) {
      setError(err.name === 'TypeError' ? "Network error: Server unreachable" : err.message || "Failed to load payslips");
      setPayslips([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id) => {
    const payslip = payslips.find((item) => item.payslip_id === id);
    if (!payslip || (payslip.status || '').toLowerCase() !== "draft") return;

    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAllDrafts = () => {
    const draftIds = payslips.filter(p => (p.status || '').toLowerCase() === 'draft').map(p => p.payslip_id);
    if (draftIds.length === 0) return;
    // if all already selected, clear
    const allSelected = draftIds.every(id => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(draftIds));
  };

  const removeToast = (id) => setToasts((t) => t.filter(x => x.id !== id));

  const addToast = (type, message) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter(x => x.id !== id)), type === 'success' ? 5000 : 6000);
  };

  const openConfirmBulkSend = (opts) => {
    // opts: { payslip_ids: [...]} or { allDrafts: true }
    const draftIds = new Set(payslips.filter((p) => (p.status || '').toLowerCase() === "draft").map((p) => p.payslip_id));
    const payload = opts.allDrafts
      ? { allDrafts: true }
      : { payslip_ids: (opts.payslip_ids || []).filter((id) => draftIds.has(id)) };
    const count = opts.allDrafts ? draftIds.size : payload.payslip_ids.length;

    if (count === 0 && opts.allDrafts) {
      // No drafts — check if any are already finance_pending (already sent)
      const pendingCount = payslips.filter(p => (p.status || '').toLowerCase() === 'finance_pending').length;
      if (pendingCount > 0) {
        addToast('success', `✅ All ${pendingCount} payslip(s) are already with Finance for approval.`);
        setSuccessMessage(`✅ All ${pendingCount} payslip(s) are already with Finance for approval.`);
        setTimeout(() => setSuccessMessage(''), 5000);
        return;
      }
      setError('No draft payslips to send. Generate payroll first.');
      return;
    }
    if (count === 0) {
      setError('No draft payslips selected');
      return;
    }
    setConfirmPayload(payload);
    setConfirmModalOpen(false);
    performBulkSend(payload);
  };

  const performBulkSend = async (payload = confirmPayload) => {
    if (!payload) return;
    try {
      setActionInProgress('bulk');
      setError("");
      const response = await fetch(`${API_BASE_URL}/api/payroll/payslips/bulk-send-to-finance`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(session?.token),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.status === 401 || response.status === 403) {
        return handleUnauthorized();
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Bulk send failed');
      }

      const body = await response.json();
      const sent = body.updated_count ?? 0;
      const skipped = (body.skipped && body.skipped.length) ? body.skipped.length : 0;

      if (sent === 0) {
        // All payslips already sent — this is not a failure
        addToast('success', '✅ All payslips are already with Finance. No action needed.');
        setSuccessMessage("✅ All payslips are already with Finance. No action needed.");
      } else {
        addToast('success', `✅ ${sent} payslip(s) sent to Finance successfully.${skipped ? ` ${skipped} skipped.` : ''}`);
        setSuccessMessage(`✅ ${sent} payslip(s) sent to Finance.${skipped ? ` ${skipped} skipped.` : ''}`);
      }
      setConfirmModalOpen(false);
      setConfirmPayload(null);
      await fetchPayslips();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setError(err.name === 'TypeError' ? "Network error: Server unreachable" : err.message || 'Bulk send failed');
      addToast('error', err.message || 'Bulk send failed');
    } finally {
      setActionInProgress(null);
    }
  };

  const performBulkSendToStaff = async () => {
    if (actionInProgress === 'bulk-staff') return;
    const approvedIds = payslips
      .filter(p => (p.status || '').toLowerCase() === 'finance_approved')
      .map(p => p.payslip_id);
    if (approvedIds.length === 0) {
      setError('No approved payslips to send to staff');
      return;
    }
    if (!window.confirm(`Send ${approvedIds.length} payslip(s) to staff?`)) return;
    try {
      setActionInProgress('bulk-staff');
      setError("");
      for (const id of approvedIds) {
        const res = await fetch(`${API_BASE_URL}/api/hr/payslips/${id}/send-to-staff`, {
          method: 'PUT',
          headers: { ...getAuthHeaders(session?.token) }
        });
        if (res.status === 401 || res.status === 403) {
          return handleUnauthorized();
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || 'Failed to send to staff');
        }
      }
      setSuccessMessage(`${approvedIds.length} payslip(s) sent to staff.`);
      addToast('success', `${approvedIds.length} payslip(s) sent to staff.`);
      await fetchPayslips();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to send to staff');
      addToast('error', err.message || 'Failed to send to staff');
    } finally {
      setActionInProgress(null);
    }
  };

  const generatePayslips = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError("Choose a payroll file first");
      return;
    }

    try {
      setGenerating(true);
      setError("");
      setSuccessMessage("");

      // First create payroll run
      const runResponse = await fetch(`${API_BASE_URL}/api/hr/payroll-run`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(session?.token),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          period_month: payrollMonth,
          period_year: payrollYear
        })
      });

      if (!runResponse.ok) {
        const body = await runResponse.json().catch(() => ({}));
        throw new Error(body.message || "Failed to create payroll run");
      }

      const runData = await runResponse.json();
      const payrollRunId = runData.payroll_run_id;

      // Then generate payslips
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("payroll_run_id", payrollRunId);
      formData.append("period_month", payrollMonth);
      formData.append("period_year", payrollYear);

      const response = await fetch(`${API_BASE_URL}/api/hr/payslips/generate`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(session?.token)
        },
        body: formData
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to generate payslips");
      }

      const result = await response.json();
      setSuccessMessage(`Successfully generated ${result.generated_count} payslips. ${result.skipped_count} records were skipped.`);
      setSelectedFile(null);
      await fetchPayslips();
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (err) {
      setError(err.message || "Failed to generate payslips");
    } finally {
      setGenerating(false);
    }
  };

  const getStatusColor = (status) => {
    switch ((status || '').toLowerCase()) {
      case "draft":
        return "bg-[#7B6660]/20 text-[#7B6660]";
      case "finance_pending":
        return "bg-yellow-500/20 text-yellow-700";
      case "finance_approved":
        return "bg-emerald-500/20 text-emerald-700";
      case "admin_pending":
        return "bg-[#F38978]/20 text-[#6f5b55]";
      case "admin_approved":
        return "bg-emerald-500/20 text-emerald-700";
      case "sent_to_staff":
        return "bg-emerald-500/20 text-emerald-700";
      case "rejected":
        return "bg-red-500/20 text-red-700";
      default:
        return "bg-white/80 text-[#251E1F]";
    }
  };

  const getStatusLabel = (status) => {
    return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const getHoldReasons = (payslip) => {
    const reasons = Array.isArray(payslip.compliance_exceptions)
      ? payslip.compliance_exceptions
      : Array.isArray(payslip.complianceExceptions)
        ? payslip.complianceExceptions
        : [];

    if (!reasons.length && payslip.deduction_breakdown) {
      try {
        const breakdown = typeof payslip.deduction_breakdown === "string"
          ? JSON.parse(payslip.deduction_breakdown)
          : payslip.deduction_breakdown;
        if (Array.isArray(breakdown?.complianceExceptions)) {
          reasons.push(...breakdown.complianceExceptions);
        }
      } catch {
        // Ignore malformed JSON and fall back to no tooltip.
      }
    }

    return [...new Set(reasons.map((reason) => String(reason).trim()).filter(Boolean))];
  };

  const buildHoldTooltipText = (reason) => {
    const lower = String(reason || "").toLowerCase();
    let recommendation = "Review the payroll details to verify the information. If the payroll details are correct, refer this payslip to Finance for further review before continuing the payroll process.";

    if (lower.includes("bank account")) {
      recommendation = "Review the payroll details to verify the information. If the payroll details are correct, refer this payslip to Finance for further review before continuing the payroll process.";
    } else if (lower.includes("cpf")) {
      recommendation = "Review the payroll details to verify the information. If the payroll details are correct, refer this payslip to Finance for further review before continuing the payroll process.";
    } else if (lower.includes("department")) {
      recommendation = "Review the payroll details to verify the information. If the payroll details are correct, refer this payslip to Finance for further review before continuing the payroll process.";
    } else if (lower.includes("net salary")) {
      recommendation = "Review the payroll details to verify the information. If the payroll details are correct, refer this payslip to Finance for further review before continuing the payroll process.";
    } else if (lower.includes("deduction")) {
      recommendation = "Review the payroll details to verify the information. If the payroll details are correct, refer this payslip to Finance for further review before continuing the payroll process.";
    } else if (lower.includes("earnings")) {
      recommendation = "Review the payroll details to verify the information. If the payroll details are correct, refer this payslip to Finance for further review before continuing the payroll process.";
    } else if (lower.includes("salary")) {
      recommendation = "Review the payroll details to verify the information. If the payroll details are correct, refer this payslip to Finance for further review before continuing the payroll process.";
    }

    return `Payroll placed on hold.\n\nReason:\n${reason}\n\nRecommended action:\n${recommendation}\n\nNote:\nOnly this payslip is on hold.\nThe Payroll Run completed successfully.`;
  };

  const getRejectionReason = (payslip) => {
    return payslip.finance_rejection_reason || payslip.admin_rejection_reason || "";
  };

  const handleSendToFinance = async (payslipId) => {
    try {
      setActionInProgress(payslipId);
      setError("");
      const response = await fetch(`${API_BASE_URL}/api/hr/payslips/${payslipId}/send-to-finance`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(session?.token),
          "Content-Type": "application/json"
        }
      });

      if (response.status === 401 || response.status === 403) {
        return handleUnauthorized();
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to send to Finance");
      }

      setSuccessMessage("Payslip sent to Finance");
      addToast('success', 'Payslip sent to Finance');
      await fetchPayslips();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(err.name === 'TypeError' ? "Network error: Server unreachable" : err.message || "Failed to send to Finance");
      addToast('error', err.message || 'Failed to send to Finance');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleSendToStaff = async (payslipId) => {
    try {
      setActionInProgress(payslipId);
      setError("");
      const response = await fetch(`${API_BASE_URL}/api/hr/payslips/${payslipId}/send-to-staff`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(session?.token),
          "Content-Type": "application/json"
        }
      });

      if (response.status === 401 || response.status === 403) {
        return handleUnauthorized();
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to send to staff");
      }

      setSuccessMessage("Payslip sent to staff");
      addToast("success", "Payslip sent to staff");
      await fetchPayslips();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(err.name === 'TypeError' ? "Network error: Server unreachable" : err.message || "Failed to send to staff");
      addToast("error", err.message || "Failed to send to staff");
    } finally {
      setActionInProgress(null);
    }
  };

  useEffect(() => {
    fetchPayslips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token, filterMonth, filterYear]);

  const filteredPayslips = useMemo(() => {
    let list = payslips;
    const query = searchTerm.trim().toLowerCase();

    if (query) {
      list = list.filter((p) => recordMatchesSearch(p, query, ["payslip_id", "staff_name", "employee_id", "period_month", "period_year"]));
    }
    if (monthFilter) {
      list = list.filter((p) => String(p.period_month || "").toLowerCase() === monthFilter.toLowerCase());
    }
    if (yearFilter) {
      list = list.filter((p) => String(p.period_year || "") === yearFilter);
    }
    if (statusFilter) {
      list = list.filter((p) => p.status === statusFilter);
    }

    return list;
  }, [payslips, searchTerm, monthFilter, yearFilter, statusFilter]);

  useEffect(() => {
    const query = searchTerm.trim();
    if (!query || filteredPayslips.length === 0) return undefined;

    const firstMatchKey = getRowKey(filteredPayslips[0]);
    const timer = setTimeout(() => {
      const row = rowRefs.current.get(firstMatchKey);
      if (row && typeof row.scrollIntoView === "function") {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [filteredPayslips, searchTerm]);

  return (
    <div className="space-y-5">
      {/* Toasts container */}
      <div className="fixed top-4 right-4 z-50 space-y-2 min-w-[280px]">
        {toasts.map(t => (
          <div key={t.id} className={`rounded-xl px-4 py-3 shadow-xl border flex items-start gap-3 ${
            t.type === 'success'
              ? 'bg-emerald-500 text-white border-emerald-600'
              : 'bg-red-600 text-white border-red-700'
          }`}>
            <span className="text-lg leading-none mt-0.5">{t.type === 'success' ? '✅' : '❌'}</span>
            <div className="flex-1 text-sm font-medium">{t.message}</div>
            <button onClick={() => removeToast(t.id)} className="text-white/70 hover:text-white text-xs shrink-0">✕</button>
          </div>
        ))}
      </div>
      <div ref={generateSectionRef} className="app-panel rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-[#251E1F]">Generate Payslips</h3>
          <button
            type="button"
            onClick={handleQuickGenerate}
            disabled={generating}
            className="rounded-lg border border-[#f0d2ca] bg-white/80 px-4 py-2 text-sm font-medium text-[#251E1F] hover:bg-[#FDD9CD]/45 transition"
          >
            {generating ? "Generating..." : "Go to Generate Payslips →"}
          </button>
        </div>
      </div>

      {error && (
        <div className="app-panel rounded-2xl border-red-500/40 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="app-panel rounded-2xl border-emerald-500/40 p-4 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}

      <form onSubmit={generatePayslips} className="app-panel rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-[#7b6660]">Payroll Month</label>
            <select
              value={payrollMonth}
              onChange={(e) => setPayrollMonth(e.target.value)}
              className="mt-2 w-full rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-[#251E1F]"
            >
              {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => (
                <option key={m} value={m} style={{ backgroundColor: '#251E1F', color: '#ffffff' }}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#7b6660]">Payroll Year</label>
            <input
              type="number"
              value={payrollYear}
              onChange={(e) => setPayrollYear(parseInt(e.target.value))}
              className="mt-2 w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-[#251E1F]"
            />
          </div>
        </div>

        {/* Primary action: Quick Generate from DB */}
        <button
          type="button"
          disabled={generating}
          onClick={handleQuickGenerate}
          className="w-full rounded-lg bg-[#F38978] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#e87562] disabled:opacity-50"
        >
          {generating ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="animate-spin" size={16} /> Generating...
            </span>
          ) : (
            "⚡ Generate Payslips from Database"
          )}
        </button>

        <p className="text-xs text-[#251E1F]/30 text-center">Uses base salary from staff records + auto CPF/SDL calculation</p>

        {/* Secondary action: Upload file & generate */}
        <div className="border-t border-[#f0d2ca] pt-4 mt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#251E1F]/30 mb-3">Or upload with variable pay data</p>
          <div>
            <input
              id="payslip-payroll-file"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="block w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-sm text-[#251E1F] file:mr-4 file:rounded-md file:border-0 file:bg-[#F38978] file:px-4 file:py-2 file:text-white hover:file:bg-[#F38978]"
            />
          </div>

          <button
            type="submit"
            disabled={generating || !selectedFile}
            className="mt-3 w-full rounded-lg border border-[#F38978]/50 bg-[#F38978]/10 px-4 py-2 text-sm font-semibold text-[#F38978] transition hover:bg-[#F38978]/20 disabled:opacity-50"
          >
            Upload & Generate Payslips
          </button>
        </div>
      </form>

      <div className="app-panel rounded-2xl p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className="block text-sm text-[#7b6660]">
            Search payslips...
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search payslips..."
              className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-[#251E1F] outline-none placeholder:text-[#7b6660]/50"
            />
          </label>
          <div className="text-sm text-[#7b6660]">
            {getSearchCountLabel(filteredPayslips.length, payslips.length, searchTerm.trim())}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleQuickGenerate}
            disabled={generating}
            className="rounded-lg bg-[#F38978] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e87562] disabled:opacity-50"
          >
            {generating ? "Generating..." : "⚡ Quick Generate"}
          </button>
          <button
            type="button"
            onClick={() => openConfirmBulkSend({ allDrafts: true })}
            disabled={actionInProgress === 'bulk'}
            className="rounded-lg bg-[#F38978]/20 px-4 py-2 text-sm font-medium text-[#F38978] hover:bg-[#F38978]/30 disabled:opacity-30 transition"
          >
            {actionInProgress === 'bulk' ? 'Sending...' : 'Bulk Send to Finance'}
          </button>
          <button
            type="button"
            onClick={performBulkSendToStaff}
            disabled={actionInProgress === 'bulk-staff' || payslips.filter(p => (p.status || '').toLowerCase() === 'finance_approved').length === 0}
            className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-500/30 disabled:opacity-30 transition"
          >
            {actionInProgress === 'bulk-staff' ? 'Sending...' : 'Bulk Send to Staff'}
          </button>
        </div>
      </div>

      <div className="app-panel rounded-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-[#f0d2ca] bg-white/80 p-6">
          <div>
            <h3 className="text-lg font-semibold text-[#251E1F]">Payslips</h3>
            <p className="mt-1 text-sm text-[#7b6660]">{payslips.length} payslips for {new Date(filterYear, filterMonth - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Month/Year Filter */}
            <select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))} className="rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm text-[#251E1F]">
              {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <input type="number" value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} className="w-20 rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm text-[#251E1F]" />
            <button
              type="button"
              onClick={() => openConfirmBulkSend({ allDrafts: true })}
              disabled={actionInProgress === 'bulk'}
              className="rounded-lg bg-[#F38978]/20 px-4 py-2 text-sm font-medium text-[#F38978] hover:bg-[#F38978]/30 disabled:opacity-30 transition"
            >
              {(() => {
                if (actionInProgress === 'bulk') return 'Sending...';
                const draftCount = payslips.filter(p => (p.status || '').toLowerCase() === 'draft').length;
                const pendingCount = payslips.filter(p => (p.status || '').toLowerCase() === 'finance_pending').length;
                if (draftCount > 0) return `📤 Send to Finance (${draftCount})`;
                if (pendingCount > 0) return `✅ With Finance (${pendingCount})`;
                return '📤 Send to Finance';
              })()}
            </button>
            <button
              type="button"
              onClick={performBulkSendToStaff}
              disabled={actionInProgress === 'bulk-staff' || payslips.filter(p => (p.status || '').toLowerCase() === 'finance_approved').length === 0}
              className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-500/30 disabled:opacity-30 transition"
            >
              {actionInProgress === 'bulk-staff' ? 'Sending...' : `📨 Send to Staff (${payslips.filter(p => (p.status || '').toLowerCase() === 'finance_approved').length})`}
            </button>
            <button
              type="button"
              onClick={fetchPayslips}
              className="rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-sm font-medium text-[#251E1F] hover:bg-[#FDD9CD]/45"
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 p-6 text-[#7b6660]">
            <Loader2 className="animate-spin" size={18} />
            Loading payslips...
          </div>
        ) : payslips.length === 0 ? (
          <div className="p-6 text-sm text-[#7b6660]">
            No payslips yet. Upload a payroll file to generate them.
          </div>
        ) : filteredPayslips.length === 0 ? (
          <div className="p-6 text-sm text-[#7b6660]">
            No records match your search.
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
                  <th className="px-4 py-3 font-medium">Deductions</th>
                  <th className="px-4 py-3 font-medium">Net Pay</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayslips.map((payslip) => {
                  const rowKey = getRowKey(payslip);
                  const isSearchMatched = searchTerm.trim().length > 0;

                  return (
                    <tr
                      key={rowKey}
                      ref={(node) => {
                        if (node) {
                          rowRefs.current.set(rowKey, node);
                        } else {
                          rowRefs.current.delete(rowKey);
                        }
                      }}
                      className={`border-b border-[#f0d2ca] text-[#251E1F] transition-colors duration-300 ${isSearchMatched ? "bg-amber-400/10" : ""}`}
                    >
                      <td className="px-4 py-3 text-[#7b6660]">{payslip.payslip_id}</td>
                      <td className="px-4 py-3">{payslip.staff_name}</td>
                      <td className="px-4 py-3 text-[#7b6660]">
                        {payslip.period_month} {payslip.period_year}
                      </td>
                      <td className="px-4 py-3 text-[#7b6660]">
                        ${Number(payslip.gross_salary || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-red-700">
                        ${Number(payslip.total_deductions || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-emerald-700">
                        ${Number(payslip.net_pay || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1">
                          <span className={`rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap ${getStatusColor(payslip.status)}`}>
                            {getStatusLabel(payslip.status)}
                          </span>
                          {String(payslip.status || "").toLowerCase() === "hold" ? (
                            <button
                              type="button"
                              onMouseEnter={(event) => openHoldTooltip(event, payslip)}
                              onMouseLeave={() => setHoldTooltip(null)}
                              onFocus={(event) => openHoldTooltip(event, payslip)}
                              onBlur={() => setHoldTooltip(null)}
                              onClick={(event) => {
                                event.preventDefault();
                                setHoldTooltip((current) => (current ? null : (getHoldTooltipData(event, payslip) || null)));
                              }}
                              className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#D97706]/25 bg-[#D97706]/10 text-[10px] font-bold leading-none text-[#9A6412] outline-none transition hover:bg-[#D97706]/20 focus:bg-[#D97706]/20"
                              aria-label="View hold reason"
                              title={buildHoldTooltipText(getHoldReasons(payslip)[0] || "This payslip has been placed on hold pending review.")}
                            >
                              ?
                            </button>
                          ) : null}
                        </span>
                        {getRejectionReason(payslip) ? (
                          <div className="mt-2 max-w-xs rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-700">
                            <span className="font-semibold">Rejection reason:</span> {getRejectionReason(payslip)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => setPreviewPayslip(payslip)}
                            className="rounded-lg bg-[#F38978]/20 px-3 py-1 text-xs text-[#6f5b55] hover:bg-[#F38978]/30"
                          >
                            👁 Preview
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {holdTooltip ? (
        <div
          className="pointer-events-none fixed z-[90] max-w-[280px] rounded-lg border border-[#f0d2ca] bg-[#fff3ee] px-3 py-2 text-left text-xs text-[#251E1F] shadow-xl"
          style={{
            left: holdTooltip.x,
            top: holdTooltip.y,
            transform: holdTooltip.placeAbove ? "translate(-50%, -100%) translateY(-10px)" : "translate(-50%, 0)",
            width: `min(${holdTooltip.width}px, calc(100vw - 24px))`
          }}
          role="tooltip"
        >
          <span className="block font-semibold text-[#7b6660]">On Hold reason</span>
          <span className="mt-1 block whitespace-pre-line leading-5">{holdTooltip.text}</span>
        </div>
      ) : null}

      {/* Payslip Preview Modal */}
      {previewPayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#251E1F]/60 backdrop-blur-sm">
          <div className="app-panel rounded-2xl w-full max-w-2xl p-6 m-4 max-h-[90vh] overflow-y-auto"
            role="dialog" aria-modal="true">

            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-[#251E1F]">Payslip Preview</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => printPayslip(previewPayslip)}
                  className="rounded-lg bg-[#F38978]/20 px-3 py-2 text-sm text-[#F38978] hover:bg-[#F38978]/40"
                >
                  🖨 Print
                </button>
                <button
                  onClick={() => setPreviewPayslip(null)}
                  className="rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-sm text-[#251E1F] hover:bg-[#FDD9CD]/45"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-6">
              <div className="text-center mb-6 pb-4 border-b border-[#f0d2ca]">
                <img src={payNivoLogoDataUrl} alt="PayNivo logo" className="mx-auto h-20 w-44 rounded object-contain" />
                <p className="text-sm text-[#7b6660]">Payslip for {previewPayslip.period_month} {previewPayslip.period_year}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-xs text-[#251E1F]/30 uppercase tracking-wider mb-2">Employee</p>
                  <p className="text-sm text-[#251E1F] font-semibold">{previewPayslip.staff_name}</p>
                  <p className="text-xs text-[#7b6660]">{previewPayslip.employee_id}</p>
                  <p className="text-xs text-[#7b6660]">{getDeptName(previewPayslip.department_id)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#251E1F]/30 uppercase tracking-wider mb-2">Payment Info</p>
                  <p className="text-xs text-[#7b6660]">Period: {previewPayslip.period_month} {previewPayslip.period_year}</p>
                  <p className="text-xs text-[#7b6660]">Status: {(previewPayslip.status || "").replace(/_/g, ' ')}</p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-xs text-[#251E1F]/30 uppercase tracking-wider mb-2">Earnings</p>
                <div className="rounded-lg border border-[#f0d2ca] bg-[#251E1F]/20 overflow-hidden">
                  <div className="flex justify-between px-4 py-2 border-b border-[#f0d2ca]">
                    <span className="text-sm text-[#251E1F]">Basic Salary</span>
                    <span className="text-sm text-[#251E1F]">${Number(previewPayslip.gross_salary || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2 bg-emerald-500/5">
                    <span className="text-sm font-semibold text-emerald-700">Total Earnings</span>
                    <span className="text-sm font-semibold text-emerald-700">${Number(previewPayslip.gross_salary || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-xs text-[#251E1F]/30 uppercase tracking-wider mb-2">Deductions</p>
                <div className="rounded-lg border border-[#f0d2ca] bg-[#251E1F]/20 overflow-hidden">
                  <div className="flex justify-between px-4 py-2 border-b border-[#f0d2ca]">
                    <span className="text-sm text-[#251E1F]">Employee CPF (20%)</span>
                    <span className="text-sm text-red-700">-${(Number(previewPayslip.gross_salary || 0) * 0.20).toFixed(2)}</span>
                  </div>
                  {previewPayslip.donation_amount > 0 && (
                    <div className="flex justify-between px-4 py-2 border-b border-[#f0d2ca]">
                      <span className="text-sm text-[#251E1F]">{previewPayslip.donation_scheme} Donation</span>
                      <span className="text-sm text-red-700">-${Number(previewPayslip.donation_amount || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between px-4 py-2 bg-red-500/5">
                    <span className="text-sm font-semibold text-red-700">Total Deductions</span>
                    <span className="text-sm font-semibold text-red-700">-${Number(previewPayslip.total_deductions || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-xs text-[#251E1F]/30 uppercase tracking-wider mb-2">CPF Contributions</p>
                <div className="rounded-lg border border-[#f0d2ca] bg-[#251E1F]/20 overflow-hidden">
                  <div className="flex justify-between px-4 py-2 border-b border-[#f0d2ca]">
                    <span className="text-sm text-[#251E1F]">Employee CPF (20%)</span>
                    <span className="text-sm text-[#251E1F]">${(Number(previewPayslip.gross_salary || 0) * 0.20).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2 border-b border-[#f0d2ca]">
                    <span className="text-sm text-[#251E1F]">Employer CPF (17%)</span>
                    <span className="text-sm text-[#251E1F]">${(Number(previewPayslip.gross_salary || 0) * 0.17).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2 bg-[#2D7C83]/5">
                    <span className="text-sm font-semibold text-[#2D7C83]">Total CPF</span>
                    <span className="text-sm font-semibold text-[#2D7C83]">${(Number(previewPayslip.gross_salary || 0) * 0.37).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#F38978]/40 bg-[#F38978]/10 p-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-[#251E1F]">Net Pay</span>
                  <span className="text-2xl font-bold text-[#F38978]">
                    ${Number(previewPayslip.net_pay || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[#f0d2ca] text-center">
                <p className="text-xs text-[#251E1F]/20">This is a computer-generated payslip. No signature required.</p>
                <p className="text-xs text-[#251E1F]/20 mt-1">Generated by PayNivo Payroll System</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationsView() {
  const session = getStoredSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const handleUnauthorized = () => {
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("authUser");
    navigate("/login", { state: { from: location, message: "Session expired." } });
  };

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await fetch(`${API_BASE_URL}/api/hr/notifications`, {
          headers: {
            ...getAuthHeaders(session?.token)
          }
        });

        if (response.status === 401 || response.status === 403) return handleUnauthorized();
        if (!response.ok) {
          setNotifications([]);
          return;
        }

        const data = await response.json();
        setNotifications(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.name === 'TypeError' ? "Network error: Server unreachable" : "Failed to load notifications");
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [session?.token]);

  return (
    <div className="space-y-5">
      {error ? (
        <div className="app-panel rounded-2xl border-red-500/40 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="app-panel rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center gap-3 p-6 text-[#7b6660]">
            <Loader2 className="animate-spin" size={18} />
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-6 text-sm text-[#7b6660]">
            No notifications at this time. You'll be notified of payroll approvals, staff updates, and system alerts.
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#f0d2ca] bg-white/80 text-[#7b6660]">
              <tr>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Message</th>
                <th className="px-4 py-3 font-medium">Timestamp</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((notif) => (
                <tr key={notif.notif_id} className="border-b border-[#f0d2ca] text-[#251E1F]">
                  <td className="px-4 py-3 text-[#7b6660]">{notif.type}</td>
                  <td className="px-4 py-3 text-[#251E1F]">{notif.message}</td>
                  <td className="px-4 py-3 text-[#7b6660]">{notif.timestamp}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                      notif.priority === "High" ? "bg-red-500/20 text-red-700" :
                      notif.priority === "Medium" ? "bg-yellow-500/20 text-yellow-700" :
                      "bg-[#2D7C83]/20 text-[#2D7C83]"
                    }`}>
                      {notif.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                      notif.read ? "bg-white/80 text-[#251E1F]/70" : "bg-[#2D7C83]/20 text-[#2D7C83]"
                    }`}>
                      {notif.read ? "Read" : "Unread"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  );
}

export default function HRPayrollPage() {
  const session = getStoredSession();
  const location = useLocation();
  const heading = routeHeadings[location.pathname] || "Dashboard";
  const activePath = location.pathname.replace(/\/+$/, "") || "/";
  const headerSearchEndpoint = "/api/hr/search";
  const [holdTooltip, setHoldTooltip] = useState(null);

  useEffect(() => {
    function closeHoldTooltip() {
      setHoldTooltip(null);
    }

    window.addEventListener("scroll", closeHoldTooltip, true);
    window.addEventListener("resize", closeHoldTooltip);
    return () => {
      window.removeEventListener("scroll", closeHoldTooltip, true);
      window.removeEventListener("resize", closeHoldTooltip);
    };
  }, []);

  const getHoldTooltipData = (event, payslip) => {
    const reasons = Array.isArray(payslip?.compliance_exceptions)
      ? payslip.compliance_exceptions
      : Array.isArray(payslip?.complianceExceptions)
        ? payslip.complianceExceptions
        : [];
    if (!reasons.length) return null;

    const rect = event.currentTarget.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const maxWidth = Math.min(280, Math.max(220, viewportWidth - 24));
    const spaceAbove = rect.top;
    const spaceBelow = viewportHeight - rect.bottom;
    const placeAbove = spaceAbove >= 120 || spaceAbove > spaceBelow;
    const x = Math.min(Math.max(rect.left + rect.width / 2, 16 + maxWidth / 2), viewportWidth - 16 - maxWidth / 2);
    const y = placeAbove ? rect.top - 10 : rect.bottom + 10;

    return {
      x,
      y,
      placeAbove,
      width: maxWidth,
      text: buildHoldTooltipText(reasons[0])
    };
  };

  const openHoldTooltip = (event, payslip) => {
    const data = getHoldTooltipData(event, payslip);
    if (data) setHoldTooltip(data);
  };

  const renderContent = () => {
    if (activePath === "/dashboard/payroll/hr/staff") {
      return <PayrollUserManagement role="HR" />;
    }

    if (activePath === "/dashboard/payroll/hr/upload") {
      return <PayrollUploadView />;
    }

    if (activePath === "/dashboard/payroll/hr/payroll-runs") {
      return <HRPayrollRunWorkflowView />;
    }

    if (activePath === "/dashboard/payroll/hr/payslips") {
      return <HRPayrollRunWorkflowView deliveryMode />;
    }

    if (activePath === "/dashboard/payroll/hr/payroll-policies") {
      return <HRPayrollPoliciesView />;
    }

    if (activePath === "/dashboard/payroll/hr/notifications") {
      return <PayrollNotificationsView />;
    }

    if (activePath === "/dashboard/payroll/hr/user-management") {
      return <PayrollUserManagement role="HR" />;
    }

    if (activePath === "/dashboard/payroll/hr/leave-management") {
      return <HRLeaveManagement />;
    }

    if (activePath === "/dashboard/payroll/hr/public-holidays") {
      return <HRPublicHolidays />;
    }

    if (activePath === "/dashboard/payroll/hr/loans") {
      return <HRLoanManagement />;
    }

    if (activePath === "/dashboard/payroll/hr/claims") {
      return <ClaimManagementPage role="HR" />;
    }

    if (activePath === "/dashboard/payroll/hr/reports") {
      return <HRReportsPage embedded />;
    }

    return (
      <div className="space-y-4">
        <HRDashboardView />
      </div>
    );
  };

  return (
    <DashboardLayout
      pageTitle={pageTitle}
      user={session?.user}
      sidebarSections={payrollSidebarSections}
      sidebarTitle="Automated Invoicing & Payroll System"
      searchPlaceholder="Search staff, payroll runs, payslips..."
      searchEndpoint={headerSearchEndpoint}
      moduleClassName="payroll-module"
    >
      <section>
        <h2 className="text-2xl font-semibold text-[#251E1F]">{heading}</h2>
        <div className="mt-6 min-h-[calc(100vh-12rem)]">{renderContent()}</div>
      </section>
    </DashboardLayout>
  );
}

