import { useEffect, useState } from "react";
import {
  CalendarDays,
  Download,
  FileText,
  HandCoins,
  Loader2,
  Wallet
} from "lucide-react";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { getStoredSession } from "../../services/sessionService.js";
import {
  getMyPayrollReport,
  getMyLeaveReport,
  getMyLoanReport,
  exportMyReport
} from "../../services/reportService.js";

const TABS = [
  { id: "payroll", label: "My Payroll", icon: Wallet },
  { id: "leave", label: "My Leave", icon: CalendarDays },
  { id: "loans", label: "My Loans", icon: HandCoins }
];

export default function StaffReportsPage() {
  const session = getStoredSession();
  const user = session?.user;

  const [activeTab, setActiveTab] = useState("payroll");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);

  // Filters
  const currentYear = new Date().getFullYear();
  const currentMonth = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const [payrollMonth, setPayrollMonth] = useState(currentMonth);
  const [payrollYear, setPayrollYear] = useState(currentYear);
  const [leaveYear, setLeaveYear] = useState(currentYear);

  // Exporting state
  const [exporting, setExporting] = useState(false);

  // Fetch report data when tab or filters change
  useEffect(() => {
    fetchReport();
  }, [activeTab, payrollMonth, payrollYear, leaveYear]);

  async function fetchReport() {
    setLoading(true);
    setError(null);
    setReportData(null);

    try {
      let data;
      switch (activeTab) {
        case "payroll":
          data = await getMyPayrollReport({ month: payrollMonth, year: payrollYear });
          break;
        case "leave":
          data = await getMyLeaveReport({ year: leaveYear });
          break;
        case "loans":
          data = await getMyLoanReport();
          break;
        default:
          break;
      }
      setReportData(data);
    } catch (err) {
      setError(err.message || "Failed to load report data");
    } finally {
      setLoading(false);
    }
  }

  async function handleExport(format) {
    setExporting(true);
    try {
      const params = {};
      if (activeTab === "payroll") {
        params.month = payrollMonth;
        params.year = payrollYear;
      } else if (activeTab === "leave") {
        params.year = leaveYear;
      }
      await exportMyReport(activeTab, params, format);
    } catch (err) {
      setError(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  }

  // Generate year options for selectors
  const yearOptions = [];
  for (let y = currentYear; y >= currentYear - 5; y--) {
    yearOptions.push(y);
  }

  return (
    <DashboardLayout
      pageTitle="My Reports"
      user={user}
      sidebarTitle="Staff Portal"
    >
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-[#7B2FF7]/20 text-[#C77DFF] shadow-md shadow-[#7B2FF7]/10"
                    : "text-[#d8c6e8]/70 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          {activeTab === "payroll" && (
            <>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-[#d8c6e8]/70">Month</label>
                <input
                  type="month"
                  value={payrollMonth}
                  onChange={(e) => setPayrollMonth(e.target.value)}
                  className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-sm text-white outline-none focus:border-[#C77DFF]/50 focus:ring-1 focus:ring-[#C77DFF]/30"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-[#d8c6e8]/70">Year</label>
                <select
                  value={payrollYear}
                  onChange={(e) => setPayrollYear(Number(e.target.value))}
                  className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-sm text-white outline-none focus:border-[#C77DFF]/50 focus:ring-1 focus:ring-[#C77DFF]/30"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y} className="bg-[#1a1a2e]">
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {activeTab === "leave" && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-[#d8c6e8]/70">Year</label>
              <select
                value={leaveYear}
                onChange={(e) => setLeaveYear(Number(e.target.value))}
                className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-sm text-white outline-none focus:border-[#C77DFF]/50 focus:ring-1 focus:ring-[#C77DFF]/30"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y} className="bg-[#1a1a2e]">
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeTab === "loans" && (
            <p className="text-xs text-[#d8c6e8]/60">Showing all your loan records</p>
          )}

          {/* Export Buttons */}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleExport("excel")}
              disabled={exporting || loading || !reportData?.rows?.length}
              className="flex items-center gap-1.5 rounded-lg border border-[#C77DFF]/30 bg-[#7B2FF7]/10 px-3 py-1.5 text-xs font-medium text-[#C77DFF] transition hover:bg-[#7B2FF7]/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download size={14} />
              Excel
            </button>
            <button
              type="button"
              onClick={() => handleExport("csv")}
              disabled={exporting || loading || !reportData?.rows?.length}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-[#d8c6e8]/80 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download size={14} />
              CSV
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] py-16">
            <Loader2 size={28} className="animate-spin text-[#C77DFF]" />
            <span className="ml-3 text-sm text-[#d8c6e8]/70">Loading report...</span>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        {/* Report Content */}
        {!loading && !error && reportData && (
          <>
            {/* Summary Cards */}
            {renderSummaryCards()}

            {/* Data Table */}
            {reportData.rows && reportData.rows.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                <div className="overflow-x-auto">
                  {renderDataTable()}
                </div>
              </div>
            ) : (
              renderEmptyState()
            )}
          </>
        )}

        {/* Initial empty (no reportData, no loading, no error) */}
        {!loading && !error && !reportData && renderEmptyState()}
      </div>
    </DashboardLayout>
  );

  function renderSummaryCards() {
    const summary = reportData?.summary;
    if (!summary) return null;

    let cards = [];

    if (activeTab === "payroll") {
      cards = [
        { label: "Gross Pay", value: `$${Number(summary.totalGrossPay || 0).toLocaleString("en-SG", { minimumFractionDigits: 2 })}`, icon: Wallet },
        { label: "Deductions", value: `$${Number(summary.totalDeductions || 0).toLocaleString("en-SG", { minimumFractionDigits: 2 })}`, icon: FileText },
        { label: "Net Pay", value: `$${Number(summary.totalNetPay || 0).toLocaleString("en-SG", { minimumFractionDigits: 2 })}`, icon: Wallet },
        { label: "Payslips", value: summary.payslipCount || 0, icon: FileText }
      ];
    } else if (activeTab === "leave") {
      cards = [
        { label: "Total Applications", value: summary.totalApplications || 0, icon: CalendarDays },
        { label: "Approved", value: summary.approved || 0, icon: CalendarDays },
        { label: "Pending", value: summary.pending || 0, icon: CalendarDays },
        { label: "Days Taken", value: summary.totalDaysTaken || 0, icon: CalendarDays }
      ];
    } else if (activeTab === "loans") {
      cards = [
        { label: "Total Loans", value: summary.totalLoans || 0, icon: HandCoins },
        { label: "Approved", value: summary.totalApproved || 0, icon: HandCoins },
        { label: "Total Disbursed", value: `$${Number(summary.totalDisbursed || 0).toLocaleString("en-SG", { minimumFractionDigits: 2 })}`, icon: HandCoins },
        { label: "Outstanding", value: `$${Number(summary.totalOutstanding || 0).toLocaleString("en-SG", { minimumFractionDigits: 2 })}`, icon: HandCoins }
      ];
    }

    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7B2FF7]/15">
                  <Icon size={16} className="text-[#C77DFF]" />
                </div>
                <span className="text-xs font-medium text-[#d8c6e8]/70">{card.label}</span>
              </div>
              <p className="mt-2 text-lg font-semibold text-white">{card.value}</p>
            </div>
          );
        })}
      </div>
    );
  }

  function renderDataTable() {
    const rows = reportData?.rows || [];

    if (activeTab === "payroll") {
      return (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03]">
              <th className="px-4 py-3 text-xs font-semibold uppercase text-[#d8c6e8]/60">Month</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-[#d8c6e8]/60">Base Salary</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-[#d8c6e8]/60">Allowances</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-[#d8c6e8]/60">Deductions</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-[#d8c6e8]/60">Net Pay</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={idx}
                className="border-b border-white/5 transition hover:bg-white/[0.03]"
              >
                <td className="px-4 py-3 text-white">{row.month || `${row.year}-${String(row.periodMonth || "").padStart(2, "0")}`}</td>
                <td className="px-4 py-3 text-[#d8c6e8]/80">${Number(row.baseSalary || 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-[#d8c6e8]/80">${Number(row.allowances || 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-[#d8c6e8]/80">${Number(row.deductions || 0).toFixed(2)}</td>
                <td className="px-4 py-3 font-medium text-[#C77DFF]">${Number(row.netPay || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (activeTab === "leave") {
      return (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03]">
              <th className="px-4 py-3 text-xs font-semibold uppercase text-[#d8c6e8]/60">Leave Type</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-[#d8c6e8]/60">Start Date</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-[#d8c6e8]/60">End Date</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-[#d8c6e8]/60">Days</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-[#d8c6e8]/60">Status</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-[#d8c6e8]/60">Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={idx}
                className="border-b border-white/5 transition hover:bg-white/[0.03]"
              >
                <td className="px-4 py-3 text-white">{row.leaveType}</td>
                <td className="px-4 py-3 text-[#d8c6e8]/80">{formatDate(row.startDate)}</td>
                <td className="px-4 py-3 text-[#d8c6e8]/80">{formatDate(row.endDate)}</td>
                <td className="px-4 py-3 text-[#d8c6e8]/80">{row.days}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-4 py-3 text-[#d8c6e8]/60 max-w-[200px] truncate">{row.reason || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (activeTab === "loans") {
      return (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03]">
              <th className="px-4 py-3 text-xs font-semibold uppercase text-[#d8c6e8]/60">Loan ID</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-[#d8c6e8]/60">Amount</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-[#d8c6e8]/60">Monthly</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-[#d8c6e8]/60">Paid</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-[#d8c6e8]/60">Outstanding</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-[#d8c6e8]/60">Status</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-[#d8c6e8]/60">Requested</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={idx}
                className="border-b border-white/5 transition hover:bg-white/[0.03]"
              >
                <td className="px-4 py-3 text-white">{row.loanId}</td>
                <td className="px-4 py-3 text-[#d8c6e8]/80">${Number(row.requestedAmount || 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-[#d8c6e8]/80">${Number(row.monthlyInstallment || 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-[#d8c6e8]/80">${Number(row.totalPaid || 0).toFixed(2)}</td>
                <td className="px-4 py-3 font-medium text-[#C77DFF]">${Number(row.outstandingBalance || 0).toFixed(2)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-4 py-3 text-[#d8c6e8]/60">{formatDate(row.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    return null;
  }

  function renderEmptyState() {
    let message = "No data found.";

    if (activeTab === "payroll") {
      message = "No payslips found for the selected period.";
    } else if (activeTab === "leave") {
      message = "No leave records found for the selected year.";
    } else if (activeTab === "loans") {
      message = "No loan records found.";
    }

    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] py-16">
        <FileText size={40} className="text-[#d8c6e8]/30" />
        <p className="mt-3 text-sm text-[#d8c6e8]/60">{message}</p>
      </div>
    );
  }
}

// ─── Helper Components ───────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const statusStyles = {
    approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    rejected: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    cancelled: "bg-gray-500/15 text-gray-400 border-gray-500/30"
  };

  const style = statusStyles[status?.toLowerCase()] || statusStyles.pending;

  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${style}`}>
      {status || "—"}
    </span>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-SG", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  } catch {
    return dateStr;
  }
}
