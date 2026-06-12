import {
  AlertCircle,
  Bell,
  CheckCircle2,
  ClipboardList,
  FileUp,
  FileText,
  Send,
  Loader2,
  LayoutDashboard,
  PlayCircle,
  Upload,
  Users
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { getStoredSession } from "../../services/sessionService.js";

const pageTitle = "Automated Payroll System – HR Payroll Upload & Payslip Generation";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

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
      <mark className="bg-[#7B2FF7]/40 text-white rounded px-0.5">
        {str.slice(idx, idx + query.length)}
      </mark>
      {str.slice(idx + query.length)}
    </span>
  );
}

function getDeptName(deptId) {
  const names = { 1: "Admin", 2: "HR", 3: "Finance", 4: "Operations", 5: "Sales", 6: "IT" };
  return names[deptId] || "—";
}

function printPayslip(payslip) {
  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payslip — ${payslip.staff_name} — ${payslip.period_month} ${payslip.period_year}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #000; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        h2 { font-size: 16px; color: #444; margin-bottom: 20px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th { background: #f5f5f5; padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; }
        td { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
        .total-row td { font-weight: bold; background: #f9f9f9; }
        .net-pay { background: #f0e8ff; padding: 16px; border-radius: 8px; display: flex; justify-content: space-between; margin-top: 20px; }
        .net-pay span:last-child { font-size: 24px; font-weight: bold; color: #7B2FF7; }
        .footer { margin-top: 40px; text-align: center; color: #999; font-size: 11px; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <h1>PayNivo Pte Ltd</h1>
      <h2>Payslip — ${payslip.period_month} ${payslip.period_year}</h2>
      <div class="grid">
        <div>
          <strong>Employee</strong><br/>
          ${payslip.staff_name}<br/>
          ${payslip.employee_id || ""}<br/>
          ${getDeptName(payslip.department_id)}
        </div>
        <div>
          <strong>Payment Period</strong><br/>
          ${payslip.period_month} ${payslip.period_year}<br/>
          Status: ${(payslip.status || "").replace(/_/g, ' ')}
        </div>
      </div>
      <table>
        <tr><th colspan="2">Earnings</th></tr>
        <tr><td>Basic Salary</td><td>$${Number(payslip.gross_salary || 0).toFixed(2)}</td></tr>
        <tr class="total-row"><td>Total Earnings</td><td>$${Number(payslip.gross_salary || 0).toFixed(2)}</td></tr>
      </table>
      <table>
        <tr><th colspan="2">Deductions</th></tr>
        <tr><td>Employee CPF (20%)</td><td>-$${(Number(payslip.gross_salary || 0) * 0.20).toFixed(2)}</td></tr>
        ${payslip.donation_amount > 0 ? `<tr><td>${payslip.donation_scheme} Donation</td><td>-$${Number(payslip.donation_amount).toFixed(2)}</td></tr>` : ''}
        <tr class="total-row"><td>Total Deductions</td><td>-$${Number(payslip.total_deductions || 0).toFixed(2)}</td></tr>
      </table>
      <table>
        <tr><th colspan="2">CPF Contributions</th></tr>
        <tr><td>Employee CPF (20%)</td><td>$${(Number(payslip.gross_salary || 0) * 0.20).toFixed(2)}</td></tr>
        <tr><td>Employer CPF (17%)</td><td>$${(Number(payslip.gross_salary || 0) * 0.17).toFixed(2)}</td></tr>
        <tr class="total-row"><td>Total CPF</td><td>$${(Number(payslip.gross_salary || 0) * 0.37).toFixed(2)}</td></tr>
      </table>
      <div class="net-pay">
        <span>Net Pay</span>
        <span>$${Number(payslip.net_pay || 0).toFixed(2)}</span>
      </div>
      <div class="footer">
        <p>This is a computer-generated payslip. No signature required.</p>
        <p>Generated by PayNivo — Singapore SME Payroll System</p>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  printWindow.document.write(printContent);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
}

const payrollSidebarSections = [
  {
    label: null,
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard/payroll/hr", end: true }
    ]
  },
  {
    label: "Staff Management",
    items: [
      { label: "Staff Records", icon: Users, path: "/dashboard/payroll/hr/staff" }
    ]
  },
  {
    label: "Payroll",
    items: [
      { label: "Payroll Upload", icon: Upload, path: "/dashboard/payroll/hr/upload" },
      { label: "Payroll Runs", icon: PlayCircle, path: "/dashboard/payroll/hr/payroll-runs" }
    ]
  },
  {
    label: null,
    items: [
      { label: "Payslips", icon: FileText, path: "/dashboard/payroll/hr/payslips" },
      { label: "Notifications", icon: Bell, path: "/dashboard/payroll/hr/notifications" }
    ]
  }
];

const routeHeadings = {
  "/dashboard/payroll/hr": "Dashboard",
  "/dashboard/payroll/hr/staff": "Staff Records",
  "/dashboard/payroll/hr/upload": "Payroll Upload",
  "/dashboard/payroll/hr/payroll-runs": "Payroll Runs",
  "/dashboard/payroll/hr/payslips": "Payslips",
  "/dashboard/payroll/hr/notifications": "Notifications"
};

function CircularProgress({ percentage, size = 80, color = "#7B2FF7", label, value }) {
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
        <p className="text-lg font-bold text-white">{value}</p>
        <p className="text-xs text-[#d8c6e8]">{label}</p>
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

const DEPARTMENT_NAMES = {
  1: "Admin", 2: "HR", 3: "Finance",
  4: "Operations", 5: "Sales", 6: "IT"
};

function HRDashboardView() {
  const session = getStoredSession();
  const navigate = useNavigate();
  const [staffList, setStaffList] = useState([]);
  const [payslipList, setPayslipList] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      try {
        const [staffData, payslipData, auditData] = await Promise.all([
          fetch(`${API_BASE_URL}/api/hr/staff`, { headers: getAuthHeaders(session?.token) }).then(r => r.json()),
          fetch(`${API_BASE_URL}/api/hr/payslips`, { headers: getAuthHeaders(session?.token) }).then(r => r.json()),
          fetch(`${API_BASE_URL}/api/hr/audit-log`, { headers: getAuthHeaders(session?.token) }).then(r => r.json())
        ]);
        setStaffList(Array.isArray(staffData) ? staffData : []);
        setPayslipList(Array.isArray(payslipData) ? payslipData : []);
        setAuditLog(Array.isArray(auditData) ? auditData : []);
      } catch {
        setStaffList([]);
        setPayslipList([]);
        setAuditLog([]);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, [session?.token]);

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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-[#7B2FF7]" size={32} />
    </div>
  );

  // Computed values
  const activeStaff = staffList.filter(s => s.status === 1 || s.status === '1').length;
  const totalStaff = staffList.length;
  const totalPayroll = staffList
    .filter(s => s.status === 1 || s.status === '1')
    .reduce((sum, s) => sum + Number(s.base_salary || 0), 0);
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
    { label: "CPF Submission", days: getDaysUntil(14), icon: "🏦" },
    { label: "IR8A Filing", days: getDaysUntil(1), icon: "📄" }
  ];

  const birthdaysThisMonth = staffList
    .filter(s => {
      if (!s.date_of_birth) return false;
      return new Date(s.date_of_birth).getMonth() === new Date().getMonth();
    })
    .map(s => {
      const dob = new Date(s.date_of_birth);
      const today = new Date();
      const birthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
      const daysUntil = Math.ceil((birthday - today) / (1000 * 60 * 60 * 24));
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
        <h2 className="text-2xl font-bold text-white">
          Good {timeOfDay()}, {session?.user?.name} 👋
        </h2>
        <p className="text-sm text-[#d8c6e8] mt-1">
          {new Date().toLocaleDateString("en-SG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Section 2 — Stats Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 flex flex-col items-center justify-center">
          <CircularProgress
            percentage={totalStaff > 0 ? (activeStaff / totalStaff) * 100 : 0}
            color="#7B2FF7"
            value={activeStaff}
            label="Active Staff"
          />
          <p className="text-xs text-white/30 mt-2">{totalStaff} total</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-5 flex flex-col justify-between min-h-[140px]">
          <p className="text-xs text-[#d8c6e8]">Total Payroll</p>
          <p className="text-2xl font-bold text-white">
            ${totalPayroll.toLocaleString()}
          </p>
          <p className="text-xs text-white/30">This month</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-5 flex flex-col items-center justify-center">
          <CircularProgress
            percentage={totalPayslips > 0 ? (pendingFinance / totalPayslips) * 100 : 0}
            color="#F59E0B"
            value={pendingFinance}
            label="Pending Finance"
          />
          <p className="text-xs text-white/30 mt-2">awaiting approval</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-5 flex flex-col justify-between min-h-[140px]">
          <p className="text-xs text-[#d8c6e8]">Sent This Month</p>
          <p className="text-2xl font-bold text-emerald-300">{sentThisMonth}</p>
          <p className="text-xs text-white/30">payslips delivered</p>
        </div>
      </div>

      {/* Section 3 — Quick Actions */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-3">
          Quick Actions
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Upload Payroll", icon: "↑", path: "/dashboard/payroll/hr/upload", color: "bg-[#7B2FF7]/20 hover:bg-[#7B2FF7]/40" },
            { label: "New Payroll Run", icon: "+", path: "/dashboard/payroll/hr/payroll-runs", color: "bg-emerald-500/20 hover:bg-emerald-500/40" },
            { label: "View Pending", icon: "👁", path: "/dashboard/payroll/hr/payslips", color: "bg-yellow-500/20 hover:bg-yellow-500/40" },
            { label: "Staff Records", icon: "👥", path: "/dashboard/payroll/hr/staff", color: "bg-blue-500/20 hover:bg-blue-500/40" }
          ].map(action => (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              className={`${action.color} rounded-xl border border-white/10 p-4 text-left transition`}
            >
              <span className="text-2xl">{action.icon}</span>
              <p className="text-sm font-semibold text-white mt-2">{action.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Section 4 — Four Column Bottom Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Column 1 — Upcoming Deadlines */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-3">
            📅 Upcoming Deadlines
          </p>
          {deadlines.map(d => (
            <div key={d.label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-b-0">
              <div className="flex items-center gap-2">
                <span>{d.icon}</span>
                <span className="text-sm text-white">{d.label}</span>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                d.days <= 7 ? "bg-red-500/20 text-red-300" :
                d.days <= 14 ? "bg-yellow-500/20 text-yellow-300" :
                "bg-emerald-500/20 text-emerald-300"
              }`}>
                {d.days}d
              </span>
            </div>
          ))}
        </div>

        {/* Column 2 — Recent Activity */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-3">
            🕓 Recent Activity
          </p>
          {auditLog.length === 0 ? (
            <p className="text-xs text-white/30">No recent activity</p>
          ) : (
            auditLog.map((log, i) => (
              <div key={i} className="flex items-start gap-2 py-2 border-b border-white/5 last:border-b-0">
                <div className="mt-1 h-2 w-2 rounded-full bg-[#7B2FF7] shrink-0" />
                <div>
                  <p className="text-xs text-white">{log.action}</p>
                  <p className="text-xs text-white/30">{timeAgo(log.created_at)}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Column 3 — Birthdays This Month */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-3">
            🎂 Birthdays This Month
          </p>
          {birthdaysThisMonth.length === 0 ? (
            <p className="text-xs text-white/30">No birthdays this month</p>
          ) : (
            birthdaysThisMonth.map(s => (
              <div key={s.employee_id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-b-0">
                <div>
                  <p className="text-sm text-white">{s.name}</p>
                  <p className="text-xs text-white/30">
                    {new Date(s.date_of_birth).toLocaleDateString("en-SG", { day: "numeric", month: "short" })}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                  s.daysUntil <= 0 ? "bg-red-500/20 text-red-300" :
                  s.daysUntil <= 7 ? "bg-yellow-500/20 text-yellow-300" :
                  "bg-emerald-500/20 text-emerald-300"
                }`}>
                  {s.daysUntil <= 0 ? "Today! 🎉" : `in ${s.daysUntil}d`}
                </span>
              </div>
            ))
          )}
          <p className="text-xs text-white/20 mt-3">For reference only</p>
        </div>

        {/* Column 4 — Payroll Cost by Department */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-3">
            📊 Payroll by Department
          </p>
          {deptTotals.map(dept => (
            <div key={dept.name} className="mb-3 last:mb-0">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-white">{dept.name}</span>
                <span className="text-[#d8c6e8]">${dept.total.toLocaleString()}</span>
              </div>
              <div className="h-2 rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-[#7B2FF7] transition-all duration-700"
                  style={{ width: `${(dept.total / maxTotal) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 5 — Payroll History */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-white">📊 Payroll Cost — Last 6 Months</p>
          <p className="text-xs text-white/30">Net pay distributed</p>
        </div>

        {payrollHistoryData.every(d => d.total === 0) ? (
          <p className="text-xs text-white/20">No payroll data yet</p>
        ) : (
          <div className="space-y-3">
            {payrollHistoryData.map((month, i) => {
              const isCurrent = i === payrollHistoryData.length - 1;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className={`text-xs w-16 shrink-0 ${isCurrent ? "text-white font-semibold" : "text-white/50"}`}>
                    {month.shortLabel} {String(month.label).split(" ")[1]?.slice(2)}
                  </span>
                  <div className="flex-1 h-5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${month.total > 0 ? (month.total / maxPayroll) * 100 : 0}%`,
                        background: "linear-gradient(to right, #7B2FF7, #a855f7)",
                        opacity: isCurrent ? 1 : 0.4
                      }}
                    />
                  </div>
                  <span className={`text-xs w-20 text-right shrink-0 ${isCurrent ? "text-white font-semibold" : "text-white/50"}`}>
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
  return staff?.hire_date || staff?.hireDate || staff?.hired_at || "-";
}

function getStaffActionId(staff) {
  return staff?.employee_id || staff?.staff_id || staff?.id || "";
}

function StaffRecordsView() {
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
    1: "Admin",
    2: "HR",
    3: "Finance",
    4: "Operations",
    5: "Sales",
    6: "IT"
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

  function exportStaffCSV() {
    const headers = [
      "Employee Code", "Name", "Email", "Phone",
      "Department", "Hire Date", "Base Salary",
      "Status", "Race", "Religion", "Bank", "Account No"
    ];

    const rows = filteredStaff.map(s => [
      s.employee_code || "",
      s.name || "",
      s.email || "",
      s.phone || "",
      getDeptName(s.department_id),
      s.hire_date ? new Date(s.hire_date).toLocaleDateString("en-SG") : "",
      s.base_salary || "",
      s.status === 1 || s.status === '1' ? "Active" : "Inactive",
      s.race || "",
      s.religion || "",
      s.bank || "",
      s.account_no || ""
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell =>
        `"${String(cell).replace(/"/g, '""')}"`
      ).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `staff_records_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
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
      <div className="neon-glass neon-border rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Staff Records</h3>
          </div>
          <button
            type="button"
            onClick={fetchStaff}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
          >
            Refresh
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
          <label className="block text-sm text-[#d8c6e8]">
            Search staff records...
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search staff records..."
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none placeholder:text-[#d8c6e8]/50"
            />
          </label>
          <button
            type="button"
            onClick={exportStaffCSV}
            className="rounded-lg bg-emerald-500/20 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-500/40 flex items-center gap-2 shrink-0"
          >
            ⬇ Export CSV
          </button>
          <div className="text-sm text-[#d8c6e8]">
            {getSearchCountLabel(filteredStaff.length, staffRecords.length, searchTerm.trim())}
          </div>
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

      <div className="neon-glass neon-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center gap-3 p-6 text-[#d8c6e8]">
            <Loader2 className="animate-spin" size={18} />
            Loading staff records...
          </div>
        ) : staffRecords.length === 0 ? (
          <div className="p-6 text-sm text-[#d8c6e8]">
            No staff records found. Add a new staff member or upload a payroll file to get started.
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-6 text-sm text-[#d8c6e8]">
            No records match your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/5 text-[#d8c6e8]">
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
                      className={`border-b border-white/5 text-white transition-colors duration-700 ${isSearchMatched ? "bg-amber-400/10" : ""} ${isHighlighted ? "bg-yellow-400/20 ring-2 ring-yellow-300/70" : ""}`}
                    >
                    <td className="px-4 py-3 text-[#d8c6e8]"><HighlightText text={staff.employee_code || getStaffDisplayId(staff)} query={searchTerm.trim()} /></td>
                    <td className="px-4 py-3"><HighlightText text={staff.name || staff.staff_name || ""} query={searchTerm.trim()} /></td>
                    <td className="px-4 py-3 text-[#d8c6e8]"><HighlightText text={departmentNames[staff.department_id] || "—"} query={searchTerm.trim()} /></td>
                    <td className="px-4 py-3 text-[#d8c6e8]">
                      ${staff.base_salary || "-"}</td>
                    <td className="px-4 py-3 text-[#d8c6e8]">{getStaffDisplayHireDate(staff)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        staff.status === 1 || staff.status === '1'
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-red-500/20 text-red-300"
                      }`}>
                        {staff.status === 1 || staff.status === '1' ? "Active" : "Inactive"}
                      </span>
                    </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                            <button type="button" onClick={() => handleEdit(staff)} className="rounded-lg bg-blue-500/20 px-3 py-1 text-xs text-blue-300 hover:bg-blue-500/30">Edit</button>
                            <button type="button" onClick={() => handleDeleteStaff(getStaffActionId(staff))} className="rounded-lg bg-red-500/20 px-3 py-1 text-xs text-red-300 hover:bg-red-500/30" >
                            Delete
                          </button>
                          <button type="button" onClick={() => handleViewHistory(staff)} className="rounded-lg bg-white/10 px-3 py-1 text-xs text-white/60 hover:bg-white/20">History</button>
                        </div>
                      </td>
                      </tr>
                  );
                })}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 px-4 pb-4">
                <p className="text-xs text-white/30">
                  Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filteredStaff.length)} of {filteredStaff.length} staff
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-sm text-white disabled:opacity-30 hover:bg-white/10"
                  >
                    ← Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`rounded-lg border px-3 py-1 text-sm transition ${
                        page === currentPage
                          ? 'border-[#7B2FF7] bg-[#7B2FF7]/30 text-white'
                          : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-sm text-white disabled:opacity-30 hover:bg-white/10"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="neon-glass neon-border rounded-2xl w-full max-w-md p-6 m-4" role="dialog" aria-modal="true" aria-labelledby="staff-edit-title">
            <h3 id="staff-edit-title" className="text-lg font-semibold text-white">Edit Staff Record</h3>
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-medium text-white">{getStaffDisplayName(editingStaff)}</p>
                <p className="mt-1 text-xs text-[#d8c6e8]">{getStaffDisplayId(editingStaff)}</p>
                <p className="mt-3 text-xs text-[#d8c6e8]">
                  Personal fields below must only be updated when requested by the staff member.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-white">Personal Fields</p>
                <div className="mt-3 space-y-3">
                  <div>
                    <label htmlFor="staff-edit-email" className="block text-sm font-medium text-[#d8c6e8]">Email</label>
                    <input
                      id="staff-edit-email"
                      type="email"
                      value={editFormData.email || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/30"
                    />
                  </div>
                  <div>
                    <label htmlFor="staff-edit-phone" className="block text-sm font-medium text-[#d8c6e8]">Phone</label>
                    <input
                      id="staff-edit-phone"
                      type="tel"
                      value={editFormData.phone || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/30"
                    />
                  </div>
                  <div>
                    <label htmlFor="staff-edit-address" className="block text-sm font-medium text-[#d8c6e8]">Address</label>
                    <input
                      id="staff-edit-address"
                      type="text"
                      value={editFormData.address || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/30"
                    />
                  </div>
                  <label className="flex items-start gap-2 text-xs text-[#d8c6e8]">
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
                    <p id="staff-request-error" className="text-xs text-red-200">
                      {fieldError}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-white">Employment Fields</p>
              <div>
                <label htmlFor="staff-edit-department" className="block text-sm font-medium text-[#d8c6e8]">Department ID</label>
                <input
                  id="staff-edit-department"
                  type="text"
                  value={editFormData.department_id || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, department_id: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/30"
                />
              </div>
              <div>
                <label htmlFor="staff-edit-base-salary" className="block text-sm font-medium text-[#d8c6e8]">Base Salary</label>
                <input
                  id="staff-edit-base-salary"
                  type="number"
                  value={editFormData.base_salary || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, base_salary: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/30"
                />
              </div>
              <div>
                <label htmlFor="staff-edit-status" className="block text-sm font-medium text-[#d8c6e8]">Status</label>
                <select
                  id="staff-edit-status"
                  value={editFormData.status || "Active"}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white"
                >
                  <option value="Active" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>Active</option>
                  <option value="Inactive" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>Inactive</option>
                  <option value="Leave" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>Leave</option>
                </select>
              </div>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleUpdateStaff}
                className="flex-1 rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/30"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingStaff(null);
                }}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {historyStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="neon-glass neon-border rounded-2xl w-full max-w-2xl p-6 m-4" role="dialog">
            <h3 className="text-lg font-semibold text-white">
              Payroll History — {historyStaff.name || historyStaff.staff_name}
            </h3>
            <div className="mt-4 overflow-x-auto">
              {historyLoading ? (
                <p className="text-[#d8c6e8] text-sm">Loading...</p>
              ) : historyPayslips.length === 0 ? (
                <p className="text-[#d8c6e8] text-sm">No payroll history found for this employee.</p>
              ) : (
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-white/10 text-[#d8c6e8]">
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
                      <tr key={p.payslip_id} className="border-b border-white/5 text-white">
                        <td className="px-3 py-2">{p.period_month} {p.period_year}</td>
                        <td className="px-3 py-2">${p.gross_salary?.toFixed(2)}</td>
                        <td className="px-3 py-2 text-red-300">${p.total_deductions?.toFixed(2)}</td>
                        <td className="px-3 py-2 text-emerald-300">${p.net_pay?.toFixed(2)}</td>
                        <td className="px-3 py-2">{p.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <button
              className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
              onClick={() => { setHistoryStaff(null); setHistoryPayslips([]); }}
            >
              Close
            </button>
          </div>
        </div>
      )}
      

      {/* Advance requests list for HR */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h4 className="text-sm font-semibold text-white">Advance Pay Requests</h4>
        <div className="mt-3">
          {loadingRequests ? (
            <div className="text-sm text-[#d8c6e8]">Loading requests...</div>
          ) : advanceRequests.length === 0 ? (
            <div className="text-sm text-[#d8c6e8]">No advance requests</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-white/10 text-[#d8c6e8]"><tr><th className="px-3 py-2">ID</th><th className="px-3 py-2">Staff</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Actions</th></tr></thead>
                <tbody>
                  {advanceRequests.map(r=> (
                    <tr key={r.request_id} className="border-b border-white/5 text-white"><td className="px-3 py-2 text-[#d8c6e8]">{r.request_id}</td><td className="px-3 py-2">{r.staff_id}</td><td className="px-3 py-2">${r.requested_amount}</td><td className="px-3 py-2 text-[#d8c6e8]">{r.status}</td><td className="px-3 py-2">{r.status==='pending' ? <button onClick={()=>approveAdvanceRequest(r.request_id)} disabled={approvingId===r.request_id} className="rounded-lg bg-indigo-500/20 px-3 py-1 text-xs text-indigo-300 hover:bg-indigo-500/30">{approvingId===r.request_id ? 'Approving...' : 'Approve'}</button> : '-'}</td></tr>
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
  const [result, setResult] = useState(null);
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");

  const handleUnauthorized = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    navigate("/login", { state: { from: location, message: "Session expired." } });
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!selectedFile) {
      setError("Choose a CSV or XLSX file first.");
      return;
    }
    if (!/\.(csv|xlsx|xls)$/i.test(selectedFile.name)) {
      setError("Invalid file format. Please upload a CSV or XLSX file.");
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) setWarning("Large file detected. Processing may take a moment.");

    let progressTimer;
    try {
      setUploading(true);
      setUploadProgress(10);
      setError("");
      setResult(null);
      progressTimer = window.setInterval(() => {
        setUploadProgress((current) => Math.min(current + 15, 90));
      }, 120);

      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(`${API_BASE_URL}/api/hr/employees/upload?create=true`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(session?.token)
        },
        body: formData
      });

      if (response.status === 401 || response.status === 403) return handleUnauthorized();

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.message || "Upload failed");
      }

      setResult(body);
      setSelectedFile(null);
      setUploadProgress(100);
    } catch (err) {
      setError(err.name === 'TypeError' ? "Network error: Server unreachable" : err.message || "Upload failed");
    } finally {
      if (progressTimer) window.clearInterval(progressTimer);
      setUploading(false);
      window.setTimeout(() => setUploadProgress(0), 500);
      window.setTimeout(() => setWarning(""), 5000);
    }
  };

  return (
    <div className="space-y-5">
      <div className="neon-glass neon-border rounded-2xl p-6">
        <div
          className="flex items-start gap-4 outline-none focus-within:ring-2 focus-within:ring-[#C77DFF] rounded-xl"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') document.getElementById('hr-sample-upload').click();
          }}
        >
          <div className="rounded-xl bg-[#C77DFF]/15 p-3 text-[#C77DFF] ring-1 ring-[#C77DFF]/25">
            <FileUp size={22} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Upload Payroll Data</h3>
          </div>
        </div>
      </div>

      <form onSubmit={handleUpload} className="neon-glass neon-border rounded-2xl p-6">
        <label htmlFor="hr-sample-upload" className="block text-sm font-medium text-white">Choose sample file</label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            id="hr-sample-upload"
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(event) => {
              setSelectedFile(event.target.files?.[0] || null);
              setUploadProgress(0);
              setError("");
            }}
            className="block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white file:mr-4 file:rounded-md file:border-0 file:bg-[#C77DFF] file:px-4 file:py-2 file:text-white hover:file:bg-[#b866ff]"
          />
          <button
            type="submit"
            disabled={uploading}
            className="inline-flex items-center justify-center rounded-lg bg-[#C77DFF] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#b866ff] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {uploading ? (
              <span className="inline-flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Uploading</span>
            ) : (
              "Upload and Create"
            )}
          </button>
        </div>
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-[#d8c6e8]">
          Selected file: <span className="font-semibold text-white">{selectedFile?.name || "none"}</span>
        </div>
        {(uploading || uploadProgress > 0) ? (
          <div className="mt-4" role="progressbar" aria-label="Upload progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={uploadProgress}>
            <div className="h-3 overflow-hidden rounded-full border border-white/10 bg-black/30">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all duration-150"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : null}
      </form>

      {error ? (
        <div className="neon-glass neon-border rounded-2xl border-red-500/40 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {warning ? (
        <div className="neon-glass neon-border rounded-2xl border-yellow-500/40 p-4 text-sm text-yellow-200">
          <span className="font-semibold">Note:</span> {warning}
        </div>
      ) : null}

      {result?.rowErrors?.length > 0 ? (
        <div className="neon-glass neon-border rounded-2xl border-red-500/40 p-6 text-white shadow-[0_0_30px_rgba(239,68,68,0.08)]">
          <div className="flex items-center gap-2 text-red-200">
            <AlertCircle size={18} />
            <span className="font-semibold text-sm">Validation Errors Found</span>
          </div>
          <div className="mt-3 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
            <ul className="space-y-1 text-xs text-red-100/80">
              {result.rowErrors.map((err, idx) => (
                <li key={idx} className="flex gap-2"><span className="font-mono text-red-300">Row {err.row}:</span> {err.error}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-6 text-white shadow-[0_0_30px_rgba(16,185,129,0.08)]">
            <div className="flex items-center gap-2 text-emerald-200">
              <CheckCircle2 size={18} />
              <span className="font-semibold">Upload processed</span>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-emerald-50 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">Rows: <span className="font-semibold text-white">{result.processedRows ?? 0}</span></div>
              <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">Created: <span className="font-semibold text-white">{result.createdCount ?? 0}</span></div>
              <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">Missing headers: <span className="font-semibold text-white">{result.missingHeaders?.length ?? 0}</span></div>
              <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">Row errors: <span className="font-semibold text-white">{result.rowErrors?.length ?? 0}</span></div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#120022]/90 p-6 shadow-[0_0_30px_rgba(199,125,255,0.08)]">
            <h4 className="text-base font-semibold text-white">Sample rows preview</h4>
            <div className="mt-4 overflow-x-auto text-sm">
              <table className="min-w-full text-left">
                <thead className="border-b border-white/10 text-[#d8c6e8]">
                  <tr>
                    <th className="px-3 py-2">employee_id</th>
                    <th className="px-3 py-2">name</th>
                    <th className="px-3 py-2">email</th>
                    <th className="px-3 py-2">phone</th>
                    <th className="px-3 py-2">status</th>
                    <th className="px-3 py-2">department_id</th>
                  </tr>
                </thead>
                <tbody>
                  {(result.sampleRows || []).map((row, index) => (
                    <tr key={index} className="border-b border-white/5 text-white">
                      <td className="px-3 py-2 text-[#d8c6e8]">{displayCellValue(row.employee_id)}</td>
                      <td className="px-3 py-2">{displayCellValue(row.name)}</td>
                      <td className="px-3 py-2 text-[#d8c6e8]">{displayCellValue(row.email)}</td>
                      <td className="px-3 py-2 text-[#d8c6e8]">{displayCellValue(row.phone)}</td>
                      <td className="px-3 py-2 text-[#d8c6e8]">{displayCellValue(row.status)}</td>
                      <td className="px-3 py-2 text-[#d8c6e8]">{displayCellValue(row.department_id)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
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

  const handleUnauthorized = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    navigate("/login", { state: { from: location, message: "Session expired." } });
  };

  const getRowKey = (run) => run.payroll_run_id || run.run_id || run.id || "";

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
        <div className="neon-glass neon-border rounded-2xl border-red-500/40 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="neon-glass neon-border rounded-2xl p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-sm text-[#d8c6e8]">
            Search
            <input
              id="payroll-run-search"
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search staff or period"
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
            />
          </label>
          <label className="text-sm text-[#d8c6e8]">
            Month
            <input
              id="payroll-run-month"
              type="text"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              placeholder="June"
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
            />
          </label>
          <label className="text-sm text-[#d8c6e8]">
            Year
            <input
              id="payroll-run-year"
              type="number"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              placeholder="2026"
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
            />
          </label>
          <label className="text-sm text-[#d8c6e8]">
            Status
            <select
              id="payroll-run-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white"
            >
              <option value="">All</option>
              <option value="created">Created</option>
              <option value="payslips_generated">Payslips Generated</option>
              <option value="completed">Completed</option>
            </select>
          </label>
        </div>
        <div className="mt-3 text-sm text-[#d8c6e8]">
          {getSearchCountLabel(filteredPayrollRuns.length, payrollRuns.length, searchTerm.trim())}
        </div>
      </div>

      <div className="neon-glass neon-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center gap-3 p-6 text-[#d8c6e8]">
            <Loader2 className="animate-spin" size={18} />
            Loading payroll runs...
          </div>
        ) : payrollRuns.length === 0 ? (
          <div className="p-6 text-sm text-[#d8c6e8]">
            No payroll runs yet. Create a run when generating payslips.
          </div>
        ) : filteredPayrollRuns.length === 0 ? (
          <div className="p-6 text-sm text-[#d8c6e8]">
            No records match your search. No payroll records match your search or filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/5 text-[#d8c6e8]">
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
                      className={`border-b border-white/5 text-white transition-colors duration-300 ${isSearchMatched ? "bg-amber-400/10" : ""}`}
                    >
                      <td className="px-4 py-3 text-[#d8c6e8]">{run.payroll_run_id || run.run_id || "-"}</td>
                      <td className="px-4 py-3">
                        {run.period || `${run.period_month || "-"} ${run.period_year || ""}`.trim()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                          run.status === "completed" || run.status === "Completed" ? "bg-emerald-500/20 text-emerald-300" :
                          run.status === "created" || run.status === "In Progress" ? "bg-blue-500/20 text-blue-300" :
                          "bg-yellow-500/20 text-yellow-300"
                        }`}>
                          {run.status || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#d8c6e8]">{run.staff_count ?? run.total_payslips ?? 0}</td>
                      <td className="px-4 py-3 text-[#d8c6e8]">{run.total_amount || "-"}</td>
                      <td className="px-4 py-3 text-[#d8c6e8]">
                        {run.run_date || (run.created_at ? new Date(run.created_at).toLocaleDateString() : "-")}
                      </td>
                    </tr>
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

function PayslipsView() {
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
  const [actionInProgress, setActionInProgress] = useState(null);
  const rowRefs = useRef(new Map());
  const [previewPayslip, setPreviewPayslip] = useState(null);
  const [expandedCpf, setExpandedCpf] = useState(null);

  const handleUnauthorized = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    navigate("/login", { state: { from: location, message: "Session expired." } });
  };

  const getRowKey = (payslip) => payslip.payslip_id || payslip.employee_id || payslip.staff_name || "";

  const fetchPayslips = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(`${API_BASE_URL}/api/hr/payslips`, {
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
    if (!payslip || payslip.status !== "draft") return;

    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAllDrafts = () => {
    const draftIds = payslips.filter(p => p.status === 'draft').map(p => p.payslip_id);
    if (draftIds.length === 0) return;
    // if all already selected, clear
    const allSelected = draftIds.every(id => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(draftIds));
  };

  const openConfirmBulkSend = (opts) => {
    // opts: { payslip_ids: [...]} or { allDrafts: true }
    const draftIds = new Set(payslips.filter((p) => p.status === "draft").map((p) => p.payslip_id));
    const payload = opts.allDrafts
      ? { allDrafts: true }
      : { payslip_ids: (opts.payslip_ids || []).filter((id) => draftIds.has(id)) };
    const count = opts.allDrafts ? draftIds.size : payload.payslip_ids.length;
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
      setSuccessMessage(`${sent} sent. ${skipped} skipped.`);
      // show toast
      addToast('success', `${sent} sent. ${skipped} skipped.`);
      setConfirmModalOpen(false);
      setConfirmPayload(null);
      await fetchPayslips();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      setError(err.name === 'TypeError' ? "Network error: Server unreachable" : err.message || 'Bulk send failed');
      addToast('error', err.message || 'Bulk send failed');
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
    switch (status) {
      case "draft":
        return "bg-gray-500/20 text-gray-300";
      case "finance_pending":
        return "bg-yellow-500/20 text-yellow-300";
      case "finance_approved":
        return "bg-blue-500/20 text-blue-300";
      case "admin_pending":
        return "bg-purple-500/20 text-purple-300";
      case "admin_approved":
        return "bg-cyan-500/20 text-cyan-300";
      case "sent_to_staff":
        return "bg-emerald-500/20 text-emerald-300";
      case "rejected":
        return "bg-red-500/20 text-red-300";
      default:
        return "bg-white/10 text-white";
    }
  };

  const getStatusLabel = (status) => {
    return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
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

  const removeToast = (id) => setToasts((t) => t.filter(x => x.id !== id));

  const addToast = (type, message) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter(x => x.id !== id)), 4000);
  };

  useEffect(() => {
    fetchPayslips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

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
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`max-w-sm rounded-lg px-4 py-2 shadow-lg ${t.type === 'success' ? 'bg-emerald-500/90 text-white' : 'bg-red-600/90 text-white'}`}>
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm">{t.message}</div>
              <button onClick={() => removeToast(t.id)} className="text-white/80 text-xs">Dismiss</button>
            </div>
          </div>
        ))}
      </div>
      <div className="neon-glass neon-border rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white">Generate Payslips</h3>
      </div>

      {error && (
        <div className="neon-glass neon-border rounded-2xl border-red-500/40 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="neon-glass neon-border rounded-2xl border-emerald-500/40 p-4 text-sm text-emerald-200">
          {successMessage}
        </div>
      )}

      <form onSubmit={generatePayslips} className="neon-glass neon-border rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-[#d8c6e8]">Payroll Month</label>
            <select
              value={payrollMonth}
              onChange={(e) => setPayrollMonth(e.target.value)}
              className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white"
            >
              {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => (
                <option key={m} value={m} style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#d8c6e8]">Payroll Year</label>
            <input
              type="number"
              value={payrollYear}
              onChange={(e) => setPayrollYear(parseInt(e.target.value))}
              className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
            />
          </div>
        </div>

        <div>
          <label htmlFor="payslip-payroll-file" className="block text-sm font-medium text-[#d8c6e8]">Payroll File (CSV/XLSX)</label>
          <input
            id="payslip-payroll-file"
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            className="mt-2 block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white file:mr-4 file:rounded-md file:border-0 file:bg-[#C77DFF] file:px-4 file:py-2 file:text-white hover:file:bg-[#b866ff]"
          />
        </div>

        <button
          type="submit"
          disabled={generating}
          className="w-full rounded-lg bg-[#C77DFF] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b866ff] disabled:opacity-50"
        >
          {generating ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="animate-spin" size={16} /> Generating...
            </span>
          ) : (
            "Generate Payslips"
          )}
        </button>
      </form>

      <div className="neon-glass neon-border rounded-2xl p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className="block text-sm text-[#d8c6e8]">
            Search payslips...
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search payslips..."
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none placeholder:text-[#d8c6e8]/50"
            />
          </label>
          <div className="text-sm text-[#d8c6e8]">
            {getSearchCountLabel(filteredPayslips.length, payslips.length, searchTerm.trim())}
          </div>
        </div>
      </div>

      <div className="neon-glass neon-border rounded-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-white/5 p-6">
          <div>
            <h3 className="text-lg font-semibold text-white">Payslips</h3>
            <p className="mt-1 text-sm text-[#d8c6e8]">{payslips.length} total payslips</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAllDrafts}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              {Array.from(selectedIds).length > 0 ? 'Clear selection' : 'Select Drafts'}
            </button>
            <button
              type="button"
              onClick={() => openConfirmBulkSend({ payslip_ids: Array.from(selectedIds) })}
              disabled={actionInProgress === 'bulk' || selectedIds.size === 0}
              title="Send selected to Finance"
              aria-label="Send selected to Finance"
              className="rounded-lg bg-indigo-500/20 p-2 text-indigo-300 hover:bg-indigo-500/30 disabled:opacity-50 relative"
            >
              {actionInProgress === 'bulk' ? (
                <span className="text-sm">Sending...</span>
              ) : (
                <div className="relative">
                  <Send size={16} />
                  {selectedIds.size > 0 && (
                    <span className="absolute -top-2 -right-2 inline-flex items-center justify-center bg-red-600 text-white text-xs rounded-full w-5 h-5">{selectedIds.size}</span>
                  )}
                </div>
              )}
            </button>
            <button
              type="button"
              onClick={fetchPayslips}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 p-6 text-[#d8c6e8]">
            <Loader2 className="animate-spin" size={18} />
            Loading payslips...
          </div>
        ) : payslips.length === 0 ? (
          <div className="p-6 text-sm text-[#d8c6e8]">
            No payslips yet. Upload a payroll file to generate them.
          </div>
        ) : filteredPayslips.length === 0 ? (
          <div className="p-6 text-sm text-[#d8c6e8]">
            No records match your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/5 text-[#d8c6e8]">
                  <tr>
                    <th className="px-4 py-3 font-medium"><input type="checkbox" checked={payslips.filter(p=>p.status==='draft').length>0 && payslips.filter(p=>p.status==='draft').every(p=>selectedIds.has(p.payslip_id))} onChange={selectAllDrafts} /></th>
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
                      className={`border-b border-white/5 text-white transition-colors duration-300 ${isSearchMatched ? "bg-amber-400/10" : ""}`}
                    >
                      <td className="px-4 py-3 text-[#d8c6e8]">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(payslip.payslip_id)}
                          onChange={() => toggleSelect(payslip.payslip_id)}
                          disabled={payslip.status !== 'draft'}
                        />
                      </td>
                      <td className="px-4 py-3 text-[#d8c6e8]">{payslip.payslip_id}</td>
                      <td className="px-4 py-3">{payslip.staff_name}</td>
                      <td className="px-4 py-3 text-[#d8c6e8]">
                        {payslip.period_month} {payslip.period_year}
                      </td>
                      <td className="px-4 py-3 text-[#d8c6e8]">
                        ${payslip.gross_salary?.toFixed(2) || "0.00"}
                      </td>
                      <td className="px-4 py-3 text-red-300">
                        ${payslip.total_deductions?.toFixed(2) || "0.00"}
                      </td>
                      <td className="px-4 py-3 text-emerald-300">
                        ${payslip.net_pay?.toFixed(2) || "0.00"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap ${getStatusColor(payslip.status)}`}>
                          {getStatusLabel(payslip.status)}
                        </span>
                        {getRejectionReason(payslip) ? (
                          <div className="mt-2 max-w-xs rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                            <span className="font-semibold">Rejection reason:</span> {getRejectionReason(payslip)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {payslip.status === 'draft' && (
                            <button
                              type="button"
                              onClick={() => handleSendToFinance(payslip.payslip_id)}
                              disabled={actionInProgress === payslip.payslip_id}
                              className="rounded-lg bg-indigo-500/20 px-3 py-1 text-xs text-indigo-300 hover:bg-indigo-500/30 disabled:opacity-50"
                            >
                              {actionInProgress === payslip.payslip_id ? 'Sending...' : 'Send to Finance'}
                            </button>
                          )}
                          {payslip.status === 'admin_approved' && (
                            <button
                              type="button"
                              onClick={() => handleSendToStaff(payslip.payslip_id)}
                              disabled={actionInProgress === payslip.payslip_id}
                              className="rounded-lg bg-emerald-500/20 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
                            >
                              {actionInProgress === payslip.payslip_id ? 'Sending...' : 'Send to Staff'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setPreviewPayslip(payslip)}
                            className="rounded-lg bg-purple-500/20 px-3 py-1 text-xs text-purple-300 hover:bg-purple-500/30"
                          >
                            👁 Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => printPayslip(payslip)}
                            className="rounded-lg bg-blue-500/20 px-3 py-1 text-xs text-blue-300 hover:bg-blue-500/30"
                          >
                            🖨 Print
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpandedCpf(expandedCpf === payslip.payslip_id ? null : payslip.payslip_id)}
                            className="rounded-lg bg-blue-500/20 px-3 py-1 text-xs text-blue-300 hover:bg-blue-500/30"
                          >
                            {expandedCpf === payslip.payslip_id ? "Hide CPF" : "CPF Details"}
                          </button>
                        </div>
                        {expandedCpf === payslip.payslip_id && (
                          <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-blue-300 mb-3">
                              CPF Contribution Breakdown
                            </p>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-white/10">
                                    <th className="px-3 py-2 text-left text-xs text-white/30">Type</th>
                                    <th className="px-3 py-2 text-right text-xs text-white/30">Rate</th>
                                    <th className="px-3 py-2 text-right text-xs text-white/30">Amount</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr className="border-b border-white/5">
                                    <td className="px-3 py-2 text-white">Employee CPF</td>
                                    <td className="px-3 py-2 text-right text-[#d8c6e8]">20%</td>
                                    <td className="px-3 py-2 text-right text-red-300">
                                      -${(Number(payslip.gross_salary || 0) * 0.20).toFixed(2)}
                                    </td>
                                  </tr>
                                  <tr className="border-b border-white/5">
                                    <td className="px-3 py-2 text-white">Employer CPF</td>
                                    <td className="px-3 py-2 text-right text-[#d8c6e8]">17%</td>
                                    <td className="px-3 py-2 text-right text-emerald-300">
                                      ${(Number(payslip.gross_salary || 0) * 0.17).toFixed(2)}
                                    </td>
                                  </tr>
                                  {payslip.donation_amount > 0 && (
                                    <tr className="border-b border-white/5">
                                      <td className="px-3 py-2 text-white">{payslip.donation_scheme || "Donation"}</td>
                                      <td className="px-3 py-2 text-right text-[#d8c6e8]">Fixed</td>
                                      <td className="px-3 py-2 text-right text-red-300">
                                        -${Number(payslip.donation_amount).toFixed(2)}
                                      </td>
                                    </tr>
                                  )}
                                  <tr className="bg-blue-500/10">
                                    <td className="px-3 py-2 font-semibold text-blue-300">Total CPF</td>
                                    <td className="px-3 py-2 text-right font-semibold text-blue-300">37%</td>
                                    <td className="px-3 py-2 text-right font-semibold text-blue-300">
                                      ${(Number(payslip.gross_salary || 0) * 0.37).toFixed(2)}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                            <p className="text-xs text-white/20 mt-2">
                              Employee CPF is deducted from gross salary. Employer CPF is paid by company on top of salary.
                            </p>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payslip Preview Modal */}
      {previewPayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="neon-glass neon-border rounded-2xl w-full max-w-2xl p-6 m-4 max-h-[90vh] overflow-y-auto"
            role="dialog" aria-modal="true">

            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Payslip Preview</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => printPayslip(previewPayslip)}
                  className="rounded-lg bg-[#7B2FF7]/20 px-3 py-2 text-sm text-purple-300 hover:bg-[#7B2FF7]/40"
                >
                  🖨 Print
                </button>
                <button
                  onClick={() => setPreviewPayslip(null)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <div className="text-center mb-6 pb-4 border-b border-white/10">
                <h2 className="text-xl font-bold text-white">PayNivo Pte Ltd</h2>
                <p className="text-sm text-[#d8c6e8]">Payslip for {previewPayslip.period_month} {previewPayslip.period_year}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Employee</p>
                  <p className="text-sm text-white font-semibold">{previewPayslip.staff_name}</p>
                  <p className="text-xs text-[#d8c6e8]">{previewPayslip.employee_id}</p>
                  <p className="text-xs text-[#d8c6e8]">{getDeptName(previewPayslip.department_id)}</p>
                </div>
                <div>
                  <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Payment Info</p>
                  <p className="text-xs text-[#d8c6e8]">Period: {previewPayslip.period_month} {previewPayslip.period_year}</p>
                  <p className="text-xs text-[#d8c6e8]">Status: {(previewPayslip.status || "").replace(/_/g, ' ')}</p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Earnings</p>
                <div className="rounded-lg border border-white/10 bg-black/20 overflow-hidden">
                  <div className="flex justify-between px-4 py-2 border-b border-white/5">
                    <span className="text-sm text-white">Basic Salary</span>
                    <span className="text-sm text-white">${Number(previewPayslip.gross_salary || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2 bg-emerald-500/5">
                    <span className="text-sm font-semibold text-emerald-300">Total Earnings</span>
                    <span className="text-sm font-semibold text-emerald-300">${Number(previewPayslip.gross_salary || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Deductions</p>
                <div className="rounded-lg border border-white/10 bg-black/20 overflow-hidden">
                  <div className="flex justify-between px-4 py-2 border-b border-white/5">
                    <span className="text-sm text-white">Employee CPF (20%)</span>
                    <span className="text-sm text-red-300">-${(Number(previewPayslip.gross_salary || 0) * 0.20).toFixed(2)}</span>
                  </div>
                  {previewPayslip.donation_amount > 0 && (
                    <div className="flex justify-between px-4 py-2 border-b border-white/5">
                      <span className="text-sm text-white">{previewPayslip.donation_scheme} Donation</span>
                      <span className="text-sm text-red-300">-${Number(previewPayslip.donation_amount || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between px-4 py-2 bg-red-500/5">
                    <span className="text-sm font-semibold text-red-300">Total Deductions</span>
                    <span className="text-sm font-semibold text-red-300">-${Number(previewPayslip.total_deductions || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-xs text-white/30 uppercase tracking-wider mb-2">CPF Contributions</p>
                <div className="rounded-lg border border-white/10 bg-black/20 overflow-hidden">
                  <div className="flex justify-between px-4 py-2 border-b border-white/5">
                    <span className="text-sm text-white">Employee CPF (20%)</span>
                    <span className="text-sm text-white">${(Number(previewPayslip.gross_salary || 0) * 0.20).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2 border-b border-white/5">
                    <span className="text-sm text-white">Employer CPF (17%)</span>
                    <span className="text-sm text-white">${(Number(previewPayslip.gross_salary || 0) * 0.17).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2 bg-blue-500/5">
                    <span className="text-sm font-semibold text-blue-300">Total CPF</span>
                    <span className="text-sm font-semibold text-blue-300">${(Number(previewPayslip.gross_salary || 0) * 0.37).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#7B2FF7]/40 bg-[#7B2FF7]/10 p-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-white">Net Pay</span>
                  <span className="text-2xl font-bold text-[#7B2FF7]">
                    ${Number(previewPayslip.net_pay || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 text-center">
                <p className="text-xs text-white/20">This is a computer-generated payslip. No signature required.</p>
                <p className="text-xs text-white/20 mt-1">Generated by PayNivo — Singapore SME Payroll System</p>
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
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
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
        <div className="neon-glass neon-border rounded-2xl border-red-500/40 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="neon-glass neon-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center gap-3 p-6 text-[#d8c6e8]">
            <Loader2 className="animate-spin" size={18} />
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-6 text-sm text-[#d8c6e8]">
            No notifications at this time. You'll be notified of payroll approvals, staff updates, and system alerts.
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/5 text-[#d8c6e8]">
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
                <tr key={notif.notif_id} className="border-b border-white/5 text-white">
                  <td className="px-4 py-3 text-[#d8c6e8]">{notif.type}</td>
                  <td className="px-4 py-3 text-white">{notif.message}</td>
                  <td className="px-4 py-3 text-[#d8c6e8]">{notif.timestamp}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                      notif.priority === "High" ? "bg-red-500/20 text-red-300" :
                      notif.priority === "Medium" ? "bg-yellow-500/20 text-yellow-300" :
                      "bg-blue-500/20 text-blue-300"
                    }`}>
                      {notif.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                      notif.read ? "bg-white/10 text-white/70" : "bg-blue-500/20 text-blue-300"
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
  const headerSearchEndpoint = `${API_BASE_URL}/api/hr/search`;

  const renderContent = () => {
    if (activePath === "/dashboard/payroll/hr/staff") {
      return <StaffRecordsView />;
    }

    if (activePath === "/dashboard/payroll/hr/upload") {
      return <PayrollUploadView />;
    }

    if (activePath === "/dashboard/payroll/hr/payroll-runs") {
      return <PayrollRunsView />;
    }

    if (activePath === "/dashboard/payroll/hr/payslips") {
      return <PayslipsView />;
    }

    if (activePath === "/dashboard/payroll/hr/notifications") {
      return <NotificationsView />;
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
    >
      <section>
        <h2 className="text-2xl font-semibold text-white">{heading}</h2>
        <div className="mt-6 min-h-[calc(100vh-12rem)]">{renderContent()}</div>
      </section>
    </DashboardLayout>
  );
}   
