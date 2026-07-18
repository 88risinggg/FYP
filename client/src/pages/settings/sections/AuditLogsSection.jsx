import { useEffect, useState } from "react";
import { Activity, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { fetchAuditLogs } from "../../../services/settingsService.js";

export default function AuditLogsSection() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const limit = 10;

  useEffect(() => { loadLogs(); }, [page, moduleFilter]);

  async function loadLogs() {
    setLoading(true);
    try {
      const data = await fetchAuditLogs({ page, limit, search, module: moduleFilter });
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (err) { /* ignore */ }
    finally { setLoading(false); }
  }

  function handleSearch(e) {
    e.preventDefault();
    setPage(1);
    loadLogs();
  }

  function formatDate(d) {
    if (!d) return "-";
    return new Intl.DateTimeFormat("en-SG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(d));
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="neon-glass neon-border rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <Activity size={20} className="text-[#C77DFF]" />
          <h2 className="text-xl font-semibold text-white">Audit Logs</h2>
        </div>
        <p className="mt-1 text-sm text-[#d8c6e8]">Track all settings changes and security events.</p>

        {/* Filters */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <form onSubmit={handleSearch} className="flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2">
            <Search size={15} className="text-[#C77DFF]" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search actions..."
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#d8c6e8]/50" />
            {search && (
              <button type="button" onClick={() => { setSearch(""); setPage(1); setTimeout(loadLogs, 0); }} className="text-[#d8c6e8] hover:text-white">
                <X size={14} />
              </button>
            )}
          </form>
          <select value={moduleFilter} onChange={(e) => { setModuleFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none">
            <option value="" className="bg-[#120022]">All Modules</option>
            <option value="profile" className="bg-[#120022]">Profile</option>
            <option value="security" className="bg-[#120022]">Security</option>
            <option value="connected_accounts" className="bg-[#120022]">Connected Accounts</option>
            <option value="invoice_settings" className="bg-[#120022]">Invoice Settings</option>
            <option value="payroll_settings" className="bg-[#120022]">Payroll Settings</option>
            <option value="company_settings" className="bg-[#120022]">Company Settings</option>
            <option value="sessions" className="bg-[#120022]">Sessions</option>
            <option value="danger_zone" className="bg-[#120022]">Danger Zone</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="mt-5 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-white/[0.04]" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-white/15 bg-white/[0.035] px-4 py-8 text-center text-sm text-[#d8c6e8]">
            No audit logs found.
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#d8c6e8]/80">Date</th>
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#d8c6e8]/80">User</th>
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#d8c6e8]/80">Action</th>
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#d8c6e8]/80">Module</th>
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#d8c6e8]/80">IP Address</th>
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#d8c6e8]/80">Device</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5 text-[#d8c6e8]">{formatDate(log.created_at)}</td>
                    <td className="px-3 py-2.5 text-white">{log.user_name || "-"}</td>
                    <td className="px-3 py-2.5 text-white">{log.action}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded bg-[#C77DFF]/10 px-2 py-0.5 text-xs font-medium text-[#C77DFF]">{log.module || "-"}</span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-[#d8c6e8]">{log.ip_address || "-"}</td>
                    <td className="px-3 py-2.5 text-[#d8c6e8]">{log.device || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-[#d8c6e8]">Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="rounded-lg border border-white/10 bg-white/[0.06] p-2 text-[#d8c6e8] transition hover:bg-white/10 disabled:opacity-30">
                <ChevronLeft size={14} />
              </button>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="rounded-lg border border-white/10 bg-white/[0.06] p-2 text-[#d8c6e8] transition hover:bg-white/10 disabled:opacity-30">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
