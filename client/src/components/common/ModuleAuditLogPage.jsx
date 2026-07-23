/**
 * ModuleAuditLogPage — reusable module-scoped audit log view.
 *
 * Usage:
 *   <ModuleAuditLogPage module="Invoice" title="Invoice Audit Logs" />
 *   <ModuleAuditLogPage module="Payroll" title="Payroll Audit Logs" />
 */
import { useEffect, useState, useCallback } from "react";
import {
  Activity, AlertCircle, Calendar, ChevronLeft, ChevronRight,
  Download, FilterX, Loader2, Search, Users, X
} from "lucide-react";
import {
  fetchModuleAuditLogs,
  fetchModuleAuditSummary,
  exportModuleAuditLogs,
} from "../../services/auditLogService.js";

const STATUS_STYLES = {
  Success: "bg-[#FFF6F2] text-emerald-700 border-emerald-200",
  Failed:  "bg-[#FDD9CD] text-red-700 border-[#FDD9CD]",
  Warning: "bg-[#FDD9CD] text-amber-700 border-[#FDD9CD]",
  Info:    "bg-[#FFF6F2] text-[#2D7C83] border-[#F0D2CA]",
};

function formatDate(v) {
  if (!v) return "-";
  return new Intl.DateTimeFormat("en-SG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v));
}

function formatTechnicalValue(value) {
  if (!value) return "Not recorded";
  try { return JSON.stringify(typeof value === "string" ? JSON.parse(value) : value, null, 2); }
  catch { return String(value); }
}

function Badge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status] || STATUS_STYLES.Info}`}>
      {status || "Info"}
    </span>
  );
}

export default function ModuleAuditLogPage({ module, title, description }) {
  const LIMIT = 25;

  const [logs,           setLogs]           = useState([]);
  const [total,          setTotal]          = useState(0);
  const [page,           setPage]           = useState(1);
  const [users,          setUsers]          = useState([]);
  const [activityTypes,  setActivityTypes]  = useState([]);
  const [modules,        setModules]        = useState([]);
  const [expanded,       setExpanded]       = useState(null);
  const [summary,        setSummary]        = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [exporting,      setExporting]      = useState(false);
  const [error,          setError]          = useState("");

  const [filters, setFilters] = useState({
    startDate:    "",
    endDate:      "",
    userId:       "",
    module:       module || "",
    activityType: "",
    status:       "",
    keyword:      "",
  });

  const load = useCallback(async (currentPage, currentFilters) => {
    setLoading(true);
    setError("");
    try {
      const [logsData, summaryData] = await Promise.all([
        fetchModuleAuditLogs(module, { ...currentFilters, page: currentPage, limit: LIMIT }),
        fetchModuleAuditSummary(currentFilters.module || module),
      ]);
      setLogs(logsData.logs || []);
      setTotal(logsData.total || 0);
      setUsers(logsData.users || []);
      setActivityTypes(logsData.activityTypes || []);
      setModules(logsData.modules || []);
      setSummary(summaryData.summary || null);
    } catch (e) {
      setError(e.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [module]);

  useEffect(() => { load(1, filters); }, []);

  function applyFilter(key, value) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    setPage(1);
    load(1, next);
  }

  function clearFilters() {
    const empty = { startDate: "", endDate: "", userId: "", module: module || "", activityType: "", status: "", keyword: "" };
    setFilters(empty);
    setPage(1);
    load(1, empty);
  }

  function changePage(newPage) {
    setPage(newPage);
    load(newPage, filters);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await exportModuleAuditLogs(module, filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `system-audit-trail-${(filters.module || module || "all").toLowerCase()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className={`${module === "Payroll" || !module ? "admin-payroll-page payroll-audit-log" : ""} space-y-6`}>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[#F38978]">{module ? `${module} Module` : "System Administration"}</p>
          <h2 className="mt-1 text-2xl font-semibold text-[#251E1F]">{title || `${module} Audit Logs`}</h2>
          {description && <p className="mt-1 text-sm text-[#7b6660]">{description}</p>}
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-2 rounded-xl border border-[#f0d2ca] bg-white px-4 py-2.5 text-sm font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/20 disabled:opacity-50"
        >
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="app-panel payroll-audit-log__metric payroll-audit-log__metric--purple rounded-2xl p-5">
            <p className="text-sm text-[#7b6660]">Total Events</p>
            <p className="mt-2 text-3xl font-semibold text-[#251E1F]">{summary.totalLogs}</p>
          </div>
          <div className="app-panel payroll-audit-log__metric payroll-audit-log__metric--blue rounded-2xl p-5">
            <p className="text-sm text-[#7b6660]">Events Today</p>
            <p className="mt-2 text-3xl font-semibold text-[#F38978]">{summary.totalEventsToday}</p>
          </div>
          <div className="app-panel payroll-audit-log__metric payroll-audit-log__metric--red rounded-2xl p-5">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-red-600" />
              <p className="text-sm text-[#7b6660]">Warnings & Failures</p>
            </div>
            <p className="mt-2 text-3xl font-semibold text-[#251E1F]">{summary.warningFailureEvents || 0}</p>
          </div>
          <div className="app-panel payroll-audit-log__metric payroll-audit-log__metric--amber rounded-2xl p-5">
            <div className="flex items-center gap-2"><Users size={16} className="text-[#F38978]"/><p className="text-sm text-[#7b6660]">Unique Actors</p></div>
            <p className="mt-2 text-3xl font-semibold text-[#251E1F]">{summary.uniqueActors || 0}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="app-panel rounded-2xl p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <input type="date" value={filters.startDate}
            onChange={e => applyFilter("startDate", e.target.value)}
            className="rounded-xl border border-[#f0d2ca] bg-[#fff8f5] px-3 py-2 text-sm text-[#251E1F] outline-none"
            placeholder="From" />
          <input type="date" value={filters.endDate}
            onChange={e => applyFilter("endDate", e.target.value)}
            className="rounded-xl border border-[#f0d2ca] bg-[#fff8f5] px-3 py-2 text-sm text-[#251E1F] outline-none"
            placeholder="To" />
          <select value={filters.module} onChange={e => applyFilter("module", e.target.value)}
            className="rounded-xl border border-[#f0d2ca] bg-[#fff8f5] px-3 py-2 text-sm text-[#251E1F] outline-none">
            <option value="">All modules</option>
            {modules.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={filters.userId} onChange={e => applyFilter("userId", e.target.value)}
            className="rounded-xl border border-[#f0d2ca] bg-[#fff8f5] px-3 py-2 text-sm text-[#251E1F] outline-none">
            <option value="">All users</option>
            {users.map(u => <option key={u.userId} value={u.userId}>{u.name}</option>)}
          </select>
          <select value={filters.activityType} onChange={e => applyFilter("activityType", e.target.value)}
            className="rounded-xl border border-[#f0d2ca] bg-[#fff8f5] px-3 py-2 text-sm text-[#251E1F] outline-none">
            <option value="">All actions</option>
            {activityTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filters.status} onChange={e => applyFilter("status", e.target.value)}
            className="rounded-xl border border-[#f0d2ca] bg-[#fff8f5] px-3 py-2 text-sm text-[#251E1F] outline-none">
            <option value="">All outcomes</option><option value="Success">Success</option><option value="Info">Info</option><option value="Warning">Warning</option><option value="Failed">Failed</option>
          </select>
          <label className="flex items-center gap-2 rounded-xl border border-[#f0d2ca] bg-[#fff8f5] px-3 py-2">
            <Search size={15} className="shrink-0 text-[#F38978]" />
            <input value={filters.keyword} onChange={e => applyFilter("keyword", e.target.value)}
              placeholder="Search description, record, user..."
              className="w-full bg-transparent text-sm text-[#251E1F] outline-none placeholder:text-[#7b6660]/60" />
          </label>
          <button type="button" onClick={clearFilters}
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#f0d2ca] px-3 py-2 text-sm text-[#7b6660] hover:bg-[#FDD9CD]/20">
            <FilterX size={14} /> Clear
          </button>
          <button type="button" onClick={() => load(page, filters)}
            className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#F38978] px-3 py-2 text-sm font-semibold text-white hover:bg-[#e87562]">
            <Activity size={14} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-[#FDD9CD] bg-[#FDD9CD] px-4 py-3 text-sm text-red-700">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Table */}
      <div className="app-panel overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#f0d2ca] text-left text-sm">
            <thead className="bg-[#fff8f5] text-xs font-semibold uppercase tracking-wide text-[#7b6660]">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">
                  <span className="flex items-center gap-1"><Calendar size={12} /> Timestamp</span>
                </th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Module / Area</th>
                <th className="px-4 py-3">Event Type</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target Record</th>
                <th className="px-4 py-3">Outcome</th>
                <th className="px-4 py-3">Source IP</th>
                <th className="px-4 py-3">Technical Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0d2ca]">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-[#7b6660]">
                  <Loader2 size={20} className="inline animate-spin mr-2" />Loading...
                </td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-14 text-center text-[#7b6660]">
                  No {module || "system"} audit records found.
                </td></tr>
              ) : logs.map(log => (
                <tr key={log.id} className="hover:bg-[#FDD9CD]/10 transition">
                  <td className="whitespace-nowrap px-4 py-3 text-[#7b6660] text-xs">{formatDate(log.createdAt)}</td>
                  <td className="px-4 py-3 font-medium text-[#251E1F]">{log.userName || "System"}<span className="block text-xs font-normal text-[#7b6660]">{log.userId ? `User #${log.userId}` : "Automated event"}</span></td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-[#F38978]/10 px-2 py-0.5 text-xs font-medium text-[#F38978]">
                      {log.module || "System"}
                    </span>
                    <span className="mt-1 block text-xs text-[#7b6660]">{log.entityType || "General"}</span>
                  </td>
                  <td className="px-4 py-3 text-[#7b6660]">{log.activityType || "System event"}</td>
                  <td className="px-4 py-3 text-[#251E1F] max-w-[280px]">
                    <span className="line-clamp-2">{log.actionDescription || "-"}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[#7b6660]">{log.affectedRecord || "-"}</td>
                  <td className="px-4 py-3"><Badge status={log.status} /></td>
                  <td className="px-4 py-3 font-mono text-xs text-[#7b6660]">{log.ipAddress || "-"}</td>
                  <td className="px-4 py-3"><button type="button" onClick={() => setExpanded(log)} className="rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-xs font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/20">View details</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-[#f0d2ca] px-5 py-3">
          <p className="text-xs text-[#7b6660]">
            {total === 0 ? "No records" : `Showing ${(page - 1) * LIMIT + 1}–${Math.min(page * LIMIT, total)} of ${total}`}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => changePage(page - 1)} disabled={page <= 1}
              className="rounded-lg border border-[#f0d2ca] p-2 text-[#7b6660] hover:bg-[#FDD9CD]/20 disabled:opacity-30">
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm text-[#251E1F]">{page} / {totalPages}</span>
            <button type="button" onClick={() => changePage(page + 1)} disabled={page >= totalPages}
              className="rounded-lg border border-[#f0d2ca] p-2 text-[#7b6660] hover:bg-[#FDD9CD]/20 disabled:opacity-30">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {expanded ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#251E1F]/35 p-4" onMouseDown={() => setExpanded(null)}>
        <section role="dialog" aria-modal="true" aria-labelledby="audit-detail-title" className="app-panel max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl p-6" onMouseDown={(event) => event.stopPropagation()}>
          <header className="flex items-start justify-between gap-4 border-b border-[#f0d2ca] pb-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#F38978]">Technical audit record #{expanded.id}</p><h3 id="audit-detail-title" className="mt-2 text-xl font-semibold text-[#251E1F]">{expanded.actionDescription || "System event"}</h3><p className="mt-1 text-sm text-[#7b6660]">{formatDate(expanded.createdAt)} · {expanded.userName || "System"}</p></div><button onClick={() => setExpanded(null)} aria-label="Close audit details"><X size={20}/></button></header>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            {[['Module', expanded.module], ['Event type', expanded.activityType], ['Entity type', expanded.entityType], ['Target record', expanded.affectedRecord], ['Outcome', expanded.status], ['Source IP', expanded.ipAddress], ['Device', expanded.deviceInfo]].map(([label,value]) => <div key={label} className="rounded-xl border border-[#f0d2ca] bg-[#fff8f5] p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-[#7b6660]">{label}</dt><dd className="mt-2 break-words text-sm font-medium text-[#251E1F]">{value || "Not recorded"}</dd></div>)}
          </dl>
          <div className="mt-4 grid gap-4 md:grid-cols-2"><div><h4 className="text-sm font-semibold text-[#251E1F]">Previous value</h4><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-[#f0d2ca] bg-[#fff8f5] p-4 text-xs text-[#7b6660]">{formatTechnicalValue(expanded.previousValue)}</pre></div><div><h4 className="text-sm font-semibold text-[#251E1F]">New value</h4><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-[#f0d2ca] bg-[#fff8f5] p-4 text-xs text-[#7b6660]">{formatTechnicalValue(expanded.newValue)}</pre></div></div>
        </section>
      </div> : null}
    </div>
  );
}
