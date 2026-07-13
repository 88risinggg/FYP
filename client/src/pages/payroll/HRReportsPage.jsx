import { useEffect, useState, useCallback } from "react";
import {
  BarChart3,
  Briefcase,
  Calendar,
  DollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Users,
  AlertCircle,
  ClipboardList,
  HandCoins,
  TrendingUp,
} from "lucide-react";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { getStoredSession } from "../../services/sessionService.js";
import {
  getPayrollReport,
  getLeaveReport,
  getEmployeeReport,
  getLoanReport,
  getAdvanceReport,
  exportReport,
} from "../../services/reportService.js";

const TABS = [
  { key: "payroll", label: "Payroll", icon: DollarSign },
  { key: "leave", label: "Leave", icon: Calendar },
  { key: "employees", label: "Employees", icon: Users },
  { key: "loans", label: "Loans", icon: Briefcase },
  { key: "advances", label: "Advances", icon: HandCoins },
];

const DEPARTMENTS = [
  { id: "", label: "All Departments" },
  { id: "1", label: "Human Resources" },
  { id: "2", label: "Finance & Accounting" },
  { id: "3", label: "Sales" },
  { id: "4", label: "Customer Service" },
  { id: "5", label: "Operations" },
  { id: "6", label: "Management" },
  { id: "7", label: "IT / System Administrator" },
];

const LEAVE_TYPES = [
  "",
  "Annual Leave",
  "Sick Leave",
  "Hospitalisation Leave",
  "Unpaid Leave",
  "Maternity Leave",
  "Paternity Leave",
  "Compassionate Leave",
];

const LEAVE_STATUSES = ["", "pending", "approved", "rejected", "cancelled"];
const LOAN_STATUSES = ["", "pending", "approved", "rejected"];
const EMPLOYEE_STATUSES = ["", "active", "inactive"];

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getCurrentYear() {
  return new Date().getFullYear();
}

// ─── Summary Card Component ─────────────────────────────────────────────────

function SummaryCard({ icon: Icon, label, value, color = "purple" }) {
  const colorMap = {
    purple: "from-[#2D7C83]/20 to-[#F38978]/10 border-[#2D7C83]/30 text-[#F38978]",
    green: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400",
    blue: "from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400",
    amber: "from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400",
    rose: "from-rose-500/20 to-rose-600/10 border-rose-500/30 text-rose-400",
  };

  return (
    <div className={`rounded-xl border bg-gradient-to-br p-4 ${colorMap[color]}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/80">
          <Icon size={20} />
        </div>
        <div>
          <p className="text-xs text-[#7b6660]/60">{label}</p>
          <p className="text-lg font-bold text-[#251E1F]">{value}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Filter Controls ────────────────────────────────────────────────────────

function PayrollFilters({ filters, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div>
        <label className="mb-1 block text-xs text-[#7b6660]/60">Month</label>
        <input
          type="month"
          value={filters.month || ""}
          onChange={(e) => onChange({ ...filters, month: e.target.value })}
          className="rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#2D7C83]"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-[#7b6660]/60">Year</label>
        <select
          value={filters.year || ""}
          onChange={(e) => onChange({ ...filters, year: e.target.value })}
          className="rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#2D7C83]"
        >
          <option value="">All Years</option>
          {Array.from({ length: 5 }, (_, i) => getCurrentYear() - i).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-[#7b6660]/60">Department</label>
        <select
          value={filters.departmentId || ""}
          onChange={(e) => onChange({ ...filters, departmentId: e.target.value })}
          className="rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#2D7C83]"
        >
          {DEPARTMENTS.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function LeaveFilters({ filters, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div>
        <label className="mb-1 block text-xs text-[#7b6660]/60">Year</label>
        <select
          value={filters.year || ""}
          onChange={(e) => onChange({ ...filters, year: e.target.value })}
          className="rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#2D7C83]"
        >
          <option value="">All Years</option>
          {Array.from({ length: 5 }, (_, i) => getCurrentYear() - i).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-[#7b6660]/60">Department</label>
        <select
          value={filters.departmentId || ""}
          onChange={(e) => onChange({ ...filters, departmentId: e.target.value })}
          className="rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#2D7C83]"
        >
          {DEPARTMENTS.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-[#7b6660]/60">Leave Type</label>
        <select
          value={filters.leaveType || ""}
          onChange={(e) => onChange({ ...filters, leaveType: e.target.value })}
          className="rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#2D7C83]"
        >
          <option value="">All Types</option>
          {LEAVE_TYPES.filter(Boolean).map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-[#7b6660]/60">Status</label>
        <select
          value={filters.status || ""}
          onChange={(e) => onChange({ ...filters, status: e.target.value })}
          className="rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#2D7C83]"
        >
          <option value="">All Statuses</option>
          {LEAVE_STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function EmployeeFilters({ filters, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div>
        <label className="mb-1 block text-xs text-[#7b6660]/60">Department</label>
        <select
          value={filters.departmentId || ""}
          onChange={(e) => onChange({ ...filters, departmentId: e.target.value })}
          className="rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#2D7C83]"
        >
          {DEPARTMENTS.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-[#7b6660]/60">Status</label>
        <select
          value={filters.status || ""}
          onChange={(e) => onChange({ ...filters, status: e.target.value })}
          className="rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#2D7C83]"
        >
          <option value="">All</option>
          {EMPLOYEE_STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function LoanFilters({ filters, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div>
        <label className="mb-1 block text-xs text-[#7b6660]/60">Status</label>
        <select
          value={filters.status || ""}
          onChange={(e) => onChange({ ...filters, status: e.target.value })}
          className="rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#2D7C83]"
        >
          <option value="">All</option>
          {LOAN_STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function AdvanceFilters({ filters, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div>
        <label className="mb-1 block text-xs text-[#7b6660]/60">Status</label>
        <select
          value={filters.status || ""}
          onChange={(e) => onChange({ ...filters, status: e.target.value })}
          className="rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#2D7C83]"
        >
          <option value="">All</option>
          {LOAN_STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-[#7b6660]/60">Month</label>
        <input
          type="month"
          value={filters.month || ""}
          onChange={(e) => onChange({ ...filters, month: e.target.value })}
          className="rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#2D7C83]"
        />
      </div>
    </div>
  );
}

// ─── Summary Renderers ──────────────────────────────────────────────────────

function PayrollSummary({ summary }) {
  if (!summary) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <SummaryCard icon={DollarSign} label="Total Gross Pay" value={`$${Number(summary.totalGrossPay || 0).toLocaleString("en-SG", { minimumFractionDigits: 2 })}`} color="purple" />
      <SummaryCard icon={TrendingUp} label="Total Net Pay" value={`$${Number(summary.totalNetPay || 0).toLocaleString("en-SG", { minimumFractionDigits: 2 })}`} color="green" />
      <SummaryCard icon={BarChart3} label="Total Deductions" value={`$${Number(summary.totalDeductions || 0).toLocaleString("en-SG", { minimumFractionDigits: 2 })}`} color="rose" />
      <SummaryCard icon={Users} label="Employees" value={summary.employeeCount || 0} color="blue" />
      <SummaryCard icon={FileText} label="Payslips" value={summary.payslipCount || 0} color="amber" />
    </div>
  );
}

function LeaveSummary({ summary }) {
  if (!summary) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <SummaryCard icon={ClipboardList} label="Total Applications" value={summary.totalApplications || 0} color="purple" />
      <SummaryCard icon={Calendar} label="Approved" value={summary.approved || 0} color="green" />
      <SummaryCard icon={AlertCircle} label="Pending" value={summary.pending || 0} color="amber" />
      <SummaryCard icon={AlertCircle} label="Rejected" value={summary.rejected || 0} color="rose" />
      <SummaryCard icon={BarChart3} label="Total Days Taken" value={summary.totalDaysTaken || 0} color="blue" />
    </div>
  );
}

function EmployeeSummary({ summary }) {
  if (!summary) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <SummaryCard icon={Users} label="Total Employees" value={summary.totalEmployees || 0} color="purple" />
      <SummaryCard icon={Users} label="Active" value={summary.activeCount || 0} color="green" />
      <SummaryCard icon={Users} label="Inactive" value={summary.inactiveCount || 0} color="rose" />
      <SummaryCard icon={BarChart3} label="Departments" value={summary.departmentBreakdown?.length || 0} color="blue" />
    </div>
  );
}

function LoanSummary({ summary }) {
  if (!summary) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <SummaryCard icon={Briefcase} label="Total Loans" value={summary.totalLoans || 0} color="purple" />
      <SummaryCard icon={DollarSign} label="Disbursed" value={`$${Number(summary.totalDisbursed || 0).toLocaleString("en-SG", { minimumFractionDigits: 2 })}`} color="green" />
      <SummaryCard icon={TrendingUp} label="Outstanding" value={`$${Number(summary.totalOutstanding || 0).toLocaleString("en-SG", { minimumFractionDigits: 2 })}`} color="amber" />
      <SummaryCard icon={DollarSign} label="Repaid" value={`$${Number(summary.totalRepaid || 0).toLocaleString("en-SG", { minimumFractionDigits: 2 })}`} color="blue" />
    </div>
  );
}

function AdvanceSummary({ summary }) {
  if (!summary) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <SummaryCard icon={HandCoins} label="Total Requests" value={summary.totalRequests || 0} color="purple" />
      <SummaryCard icon={HandCoins} label="Approved" value={summary.totalApproved || 0} color="green" />
      <SummaryCard icon={AlertCircle} label="Pending" value={summary.totalPending || 0} color="amber" />
      <SummaryCard icon={AlertCircle} label="Rejected" value={summary.totalRejected || 0} color="rose" />
      <SummaryCard icon={DollarSign} label="Total Amount" value={`$${Number(summary.totalAmount || 0).toLocaleString("en-SG", { minimumFractionDigits: 2 })}`} color="blue" />
    </div>
  );
}

// ─── Table Column Definitions ───────────────────────────────────────────────

const PAYROLL_COLUMNS = [
  { key: "employeeId", label: "Employee ID" },
  { key: "employeeName", label: "Name" },
  { key: "department", label: "Department" },
  { key: "baseSalary", label: "Base Salary", format: "currency" },
  { key: "allowances", label: "Allowances", format: "currency" },
  { key: "deductions", label: "Deductions", format: "currency" },
  { key: "netPay", label: "Net Pay", format: "currency" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

const LEAVE_COLUMNS = [
  { key: "employeeId", label: "Employee ID" },
  { key: "employeeName", label: "Name" },
  { key: "department", label: "Department" },
  { key: "leaveType", label: "Leave Type" },
  { key: "startDate", label: "Start Date", format: "date" },
  { key: "endDate", label: "End Date", format: "date" },
  { key: "days", label: "Days" },
  { key: "status", label: "Status", format: "status" },
];

const EMPLOYEE_COLUMNS = [
  { key: "employeeId", label: "Employee ID" },
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "department", label: "Department" },
  { key: "hireDate", label: "Hire Date", format: "date" },
  { key: "baseSalary", label: "Base Salary", format: "currency" },
  { key: "status", label: "Status", format: "status" },
];

const LOAN_COLUMNS = [
  { key: "loanId", label: "Loan ID" },
  { key: "employeeName", label: "Name" },
  { key: "requestedAmount", label: "Amount", format: "currency" },
  { key: "monthlyInstallment", label: "Monthly", format: "currency" },
  { key: "totalPaid", label: "Paid", format: "currency" },
  { key: "outstandingBalance", label: "Outstanding", format: "currency" },
  { key: "status", label: "Status", format: "status" },
  { key: "createdAt", label: "Created", format: "date" },
];

const ADVANCE_COLUMNS = [
  { key: "advanceId", label: "ID" },
  { key: "employeeName", label: "Name" },
  { key: "amount", label: "Amount", format: "currency" },
  { key: "reason", label: "Reason" },
  { key: "status", label: "Status", format: "status" },
  { key: "requestedAt", label: "Requested", format: "date" },
  { key: "processedAt", label: "Processed", format: "date" },
];

// ─── Format Helpers ─────────────────────────────────────────────────────────

function formatCellValue(value, format) {
  if (value === null || value === undefined) return "—";
  switch (format) {
    case "currency":
      return `$${Number(value).toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case "date":
      if (!value) return "—";
      return new Date(value).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
    case "status":
      return value;
    default:
      return String(value);
  }
}

function StatusBadge({ status }) {
  const colors = {
    approved: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    rejected: "bg-rose-500/20 text-rose-400 border-rose-500/30",
    cancelled: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    inactive: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };

  const statusStr = status != null ? String(status) : "";
  const colorClass = colors[statusStr.toLowerCase()] || "bg-white/80 text-[#7b6660] border-[#ead3cc]";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      {statusStr ? statusStr.charAt(0).toUpperCase() + statusStr.slice(1) : "—"}
    </span>
  );
}

// ─── Data Table Component ───────────────────────────────────────────────────

function ReportTable({ columns, rows }) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-[#f0d2ca] bg-white/[0.02]">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[#f0d2ca] bg-white/80">
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#7b6660]/70">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className="border-b border-[#f0d2ca] transition hover:bg-[#FDD9CD]/45">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-[#7b6660]">
                  {col.format === "status" ? (
                    <StatusBadge status={row[col.key]} />
                  ) : (
                    formatCellValue(row[col.key], col.format)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page Component ────────────────────────────────────────────────────

export default function HRReportsPage({ embedded = false }) {
  const session = getStoredSession();
  const user = session?.user;

  const [activeTab, setActiveTab] = useState("payroll");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Report data
  const [reportData, setReportData] = useState(null);

  // Filters per tab
  const [payrollFilters, setPayrollFilters] = useState({ month: "", year: "", departmentId: "" });
  const [leaveFilters, setLeaveFilters] = useState({ year: String(getCurrentYear()), departmentId: "", leaveType: "", status: "" });
  const [employeeFilters, setEmployeeFilters] = useState({ departmentId: "", status: "" });
  const [loanFilters, setLoanFilters] = useState({ status: "" });
  const [advanceFilters, setAdvanceFilters] = useState({ status: "", month: "" });

  // Get current filters based on active tab
  const getActiveFilters = useCallback(() => {
    switch (activeTab) {
      case "payroll": return payrollFilters;
      case "leave": return leaveFilters;
      case "employees": return employeeFilters;
      case "loans": return loanFilters;
      case "advances": return advanceFilters;
      default: return {};
    }
  }, [activeTab, payrollFilters, leaveFilters, employeeFilters, loanFilters, advanceFilters]);

  // Fetch report data
  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters = getActiveFilters();
      // Remove empty string values
      const cleanFilters = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== "" && v !== null && v !== undefined)
      );

      let data;
      switch (activeTab) {
        case "payroll":
          data = await getPayrollReport(cleanFilters);
          break;
        case "leave":
          data = await getLeaveReport(cleanFilters);
          break;
        case "employees":
          data = await getEmployeeReport(cleanFilters);
          break;
        case "loans":
          data = await getLoanReport(cleanFilters);
          break;
        case "advances":
          data = await getAdvanceReport(cleanFilters);
          break;
        default:
          data = null;
      }
      setReportData(data);
    } catch (err) {
      setError(err.message || "Failed to load report data");
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [activeTab, getActiveFilters]);

  // Fetch on tab or filter change
  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Handle export
  const handleExport = async (format) => {
    setExporting(true);
    try {
      const filters = getActiveFilters();
      const cleanFilters = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== "" && v !== null && v !== undefined)
      );
      await exportReport(activeTab === "employees" ? "employees" : activeTab, cleanFilters, format);
    } catch (err) {
      setError(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  // Get columns for current tab
  function getColumns() {
    switch (activeTab) {
      case "payroll": return PAYROLL_COLUMNS;
      case "leave": return LEAVE_COLUMNS;
      case "employees": return EMPLOYEE_COLUMNS;
      case "loans": return LOAN_COLUMNS;
      case "advances": return ADVANCE_COLUMNS;
      default: return [];
    }
  }

  // Render filter controls for current tab
  function renderFilters() {
    switch (activeTab) {
      case "payroll":
        return <PayrollFilters filters={payrollFilters} onChange={setPayrollFilters} />;
      case "leave":
        return <LeaveFilters filters={leaveFilters} onChange={setLeaveFilters} />;
      case "employees":
        return <EmployeeFilters filters={employeeFilters} onChange={setEmployeeFilters} />;
      case "loans":
        return <LoanFilters filters={loanFilters} onChange={setLoanFilters} />;
      case "advances":
        return <AdvanceFilters filters={advanceFilters} onChange={setAdvanceFilters} />;
      default:
        return null;
    }
  }

  // Render summary for current tab
  function renderSummary() {
    if (!reportData?.summary) return null;
    switch (activeTab) {
      case "payroll": return <PayrollSummary summary={reportData.summary} />;
      case "leave": return <LeaveSummary summary={reportData.summary} />;
      case "employees": return <EmployeeSummary summary={reportData.summary} />;
      case "loans": return <LoanSummary summary={reportData.summary} />;
      case "advances": return <AdvanceSummary summary={reportData.summary} />;
      default: return null;
    }
  }

  // Sidebar sections for HR
  const sidebarSections = [
    {
      label: "PAYROLL",
      items: [
        { label: "Dashboard", icon: BarChart3, path: "/dashboard/payroll/hr" },
        { label: "Reports", icon: FileSpreadsheet, path: "/dashboard/payroll/hr/reports", end: true },
      ],
    },
  ];

  const reportContent = (
    <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-1 rounded-xl border border-[#f0d2ca] bg-white/80 p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-[#2D7C83] text-[#251E1F] shadow-lg shadow-[#2D7C83]/25"
                    : "text-[#7b6660]/70 hover:bg-white/80 hover:text-[#251E1F]"
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Filter Controls & Export Buttons */}
        <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-[#f0d2ca] bg-white/80 p-4">
          {renderFilters()}
          <div className="flex items-end gap-2">
            <button
              onClick={() => handleExport("excel")}
              disabled={exporting || loading || !reportData?.rows?.length}
              className="flex items-center gap-2 rounded-lg bg-[#2D7C83] px-4 py-2 text-sm font-medium text-[#251E1F] transition hover:bg-[#6B1FE7] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet size={16} />
              {exporting ? "Exporting..." : "Export Excel"}
            </button>
            <button
              onClick={() => handleExport("csv")}
              disabled={exporting || loading || !reportData?.rows?.length}
              className="flex items-center gap-2 rounded-lg border border-[#f0d2ca] bg-white/80 px-4 py-2 text-sm font-medium text-[#7b6660] transition hover:bg-[#FDD9CD]/45 hover:text-[#251E1F] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={16} />
              {exporting ? "Exporting..." : "Export CSV"}
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
            <AlertCircle size={20} className="text-rose-400" />
            <p className="text-sm text-rose-300">{error}</p>
            <button
              onClick={() => { setError(null); fetchReport(); }}
              className="ml-auto text-xs font-medium text-rose-300 hover:text-rose-200 underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 size={32} className="animate-spin text-[#2D7C83]" />
            <p className="text-sm text-[#7b6660]/60">Loading report data...</p>
          </div>
        )}

        {/* Report Content */}
        {!loading && !error && (
          <>
            {/* Summary Cards */}
            {renderSummary()}

            {/* Data Table */}
            {reportData?.rows?.length > 0 ? (
              <div className="mt-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm text-[#7b6660]/60">
                    Showing {reportData.rows.length} record{reportData.rows.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <ReportTable columns={getColumns()} rows={reportData.rows} />
              </div>
            ) : reportData && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[#f0d2ca] bg-white/[0.02] py-16">
                <FileText size={40} className="text-[#7b6660]/30" />
                <p className="text-sm text-[#7b6660]/60">No data found for the selected filters</p>
                <p className="text-xs text-[#7b6660]/40">Try adjusting your filter criteria</p>
              </div>
            )}
          </>
        )}
      </div>
  );

  if (embedded) {
    return reportContent;
  }

  return (
    <DashboardLayout
      pageTitle="HR Reports"
      user={user}
      sidebarSections={sidebarSections}
      sidebarTitle="HR Payroll"
    >
      {reportContent}
    </DashboardLayout>
  );
}
