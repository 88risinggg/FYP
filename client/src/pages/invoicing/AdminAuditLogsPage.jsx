import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Download,
  FileText,
  FilterX,
  LogIn,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCog
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

import {
  exportAuditLogs,
  fetchAuditLogs,
  fetchAuditSummary
} from "../../services/adminAuditLogService.js";

const refreshIntervalMs = 5 * 60 * 1000;

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function statusClass(status) {
  const classes = {
    Success: "border-emerald-300/30 bg-emerald-400/10 text-emerald-200",
    Failed: "border-rose-300/30 bg-rose-400/10 text-rose-200",
    Warning: "border-amber-300/30 bg-amber-400/10 text-amber-100",
    Info: "border-sky-300/30 bg-sky-400/10 text-sky-100"
  };
  return classes[status] || classes.Info;
}

function chartColor(index) {
  return ["#C77DFF", "#38BDF8", "#34D399", "#F59E0B", "#FB7185"][index % 5];
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [activityTypes, setActivityTypes] = useState([]);
  const [summary, setSummary] = useState({
    totalLogs: 0,
    totalEventsToday: 0,
    loginActivities: 0,
    invoiceUpdates: 0,
    userManagementActions: 0,
    activityBreakdown: [],
    retentionMonths: 12
  });
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    userId: "",
    activityType: "",
    keyword: ""
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadAuditData(nextFilters = filters, isBackgroundRefresh = false) {
    if (isBackgroundRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");

    try {
      const [logsData, summaryData] = await Promise.all([
        fetchAuditLogs(nextFilters),
        fetchAuditSummary()
      ]);
      setLogs(logsData.logs || []);
      setUsers(logsData.users || []);
      setActivityTypes(logsData.activityTypes || []);
      setSummary(summaryData.summary || summary);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadAuditData();
    const intervalId = window.setInterval(() => loadAuditData(filters, true), refreshIntervalMs);
    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeFilter(key, value) {
    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);
    loadAuditData(nextFilters, true);
  }

  function clearFilters() {
    const nextFilters = {
      startDate: "",
      endDate: "",
      userId: "",
      activityType: "",
      keyword: ""
    };
    setFilters(nextFilters);
    loadAuditData(nextFilters, true);
  }

  async function handleExport() {
    try {
      const blob = await exportAuditLogs(filters);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "audit-logs.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  const maxBreakdown = useMemo(() => {
    const counts = summary.activityBreakdown.map((item) => item.count);
    return Math.max(...counts, 1);
  }, [summary.activityBreakdown]);

  const cards = [
    { label: "Total Events Today", value: summary.totalEventsToday, icon: CalendarDays },
    { label: "Login Activities", value: summary.loginActivities, icon: LogIn },
    { label: "Invoice Updates", value: summary.invoiceUpdates, icon: FileText },
    { label: "User Management Actions", value: summary.userManagementActions, icon: UserCog }
  ];

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-medium text-[#C77DFF]">Admin View Audit Logs</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">
            Automated Invoicing System - Audit Logs
          </h2>
          <p className="mt-2 text-sm text-[#d8c6e8]">
            Monitor user activities, system changes, and accountability events.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadAuditData(filters, true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="neon-glass neon-border rounded-lg p-5">
        <div className="grid gap-3 lg:grid-cols-[160px_160px_180px_200px_minmax(0,1fr)_auto_auto]">
          <input
            type="date"
            value={filters.startDate}
            onChange={(event) => changeFilter("startDate", event.target.value)}
            className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none"
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(event) => changeFilter("endDate", event.target.value)}
            className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none"
          />
          <select
            value={filters.userId}
            onChange={(event) => changeFilter("userId", event.target.value)}
            className="rounded-lg border border-white/10 bg-[#140026] px-3 py-2 text-sm text-white outline-none"
          >
            <option value="">All users</option>
            {users.map((user) => (
              <option key={user.userId} value={user.userId}>{user.name}</option>
            ))}
          </select>
          <select
            value={filters.activityType}
            onChange={(event) => changeFilter("activityType", event.target.value)}
            className="rounded-lg border border-white/10 bg-[#140026] px-3 py-2 text-sm text-white outline-none"
          >
            <option value="">All activity types</option>
            {activityTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2">
            <Search size={16} className="text-[#C77DFF]" />
            <input
              value={filters.keyword}
              onChange={(event) => changeFilter("keyword", event.target.value)}
              placeholder="Search description, record, or user"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#d8c6e8]/60"
            />
          </label>
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-[#d8c6e8] hover:bg-white/10 hover:text-white"
          >
            <FilterX size={16} />
            Clear
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="neon-button inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold"
          >
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <motion.article
              key={card.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="neon-glass neon-border rounded-lg p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-[#d8c6e8]">{card.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{card.value}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#C77DFF]/15 text-[#C77DFF] ring-1 ring-[#C77DFF]/25">
                  <Icon size={21} />
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="neon-glass neon-border overflow-hidden rounded-lg">
          <div className="border-b border-white/10 px-5 py-4">
            <h3 className="text-lg font-semibold text-white">Audit Logs Table</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-[#d8c6e8]">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Activity Type</th>
                  <th className="px-4 py-3">Affected Record</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {loading ? (
                  <tr><td colSpan="6" className="px-4 py-10 text-center text-[#d8c6e8]">Loading audit records...</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan="6" className="px-4 py-12 text-center text-[#d8c6e8]">No audit records found.</td></tr>
                ) : logs.map((log) => (
                  <tr key={log.id} className="text-[#f7efff]">
                    <td className="whitespace-nowrap px-4 py-4 text-[#d8c6e8]">{formatDate(log.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-4 font-medium">{log.userName}</td>
                    <td className="whitespace-nowrap px-4 py-4">{log.activityType}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-[#d8c6e8]">{log.affectedRecord || "-"}</td>
                    <td className="min-w-72 px-4 py-4">{log.actionDescription}</td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(log.status)}`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-6">
          <section className="neon-glass neon-border rounded-lg p-5">
            <div className="mb-4 flex items-center gap-3">
              <ShieldCheck size={21} className="text-[#C77DFF]" />
              <h3 className="text-lg font-semibold text-white">Audit Retention Policy</h3>
            </div>
            <p className="text-sm text-[#d8c6e8]">
              Audit records should be retained for at least {summary.retentionMonths} months for accountability and investigation.
            </p>
            <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.05] p-4">
              <p className="text-sm text-[#d8c6e8]">Total logs count</p>
              <p className="mt-1 text-3xl font-semibold text-white">{summary.totalLogs}</p>
            </div>
          </section>

          <section className="neon-glass neon-border rounded-lg p-5">
            <div className="mb-4 flex items-center gap-3">
              <Activity size={21} className="text-[#C77DFF]" />
              <h3 className="text-lg font-semibold text-white">Activity Breakdown</h3>
            </div>
            {summary.activityBreakdown.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.035] px-4 py-8 text-center text-sm text-[#d8c6e8]">
                No activity data yet.
              </div>
            ) : (
              <div className="space-y-4">
                {summary.activityBreakdown.map((item, index) => {
                  const percentage = Math.round((item.count / maxBreakdown) * 100);
                  return (
                    <div key={item.activityType}>
                      <div className="mb-2 flex justify-between gap-3 text-sm">
                        <span className="text-white">{item.activityType}</span>
                        <span className="text-[#d8c6e8]">{item.count}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.max(percentage, 6)}%`, backgroundColor: chartColor(index) }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-amber-300/20 bg-amber-400/10 p-5">
            <div className="mb-2 flex items-center gap-2 text-amber-100">
              <AlertTriangle size={18} />
              <p className="font-semibold">Security Monitoring</p>
            </div>
            <p className="text-sm text-amber-100/85">
              Failed login attempts and warning events help identify unauthorized access or sensitive system changes.
            </p>
          </section>
        </aside>
      </div>
    </section>
  );
}
