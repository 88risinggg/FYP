/**
 * EVALUATION HEADER
 * FEATURE: SETTINGS - SHARED
 * PURPOSE: Implements the Audit Logs Section screen and its page-level interactions.
 * LAYER: Frontend page - renders a complete screen and coordinates its user interactions.
 * FIND RELATED CODE: Trace its imports for UI components and frontend services used by this screen.
 */
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

  async function loadLogs(overrides = {}) {
    const nextPage = overrides.page ?? page;
    const nextSearch = overrides.search ?? search;
    const nextModule = overrides.module ?? moduleFilter;
    setLoading(true);
    try {
      const data = await fetchAuditLogs({ page: nextPage, limit, search: nextSearch, module: nextModule });
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (err) { /* ignore */ }
    finally { setLoading(false); }
  }

  function handleSearch(e) {
    e.preventDefault();
    setPage(1);
    loadLogs({ page: 1, search });
  }

  function formatDate(d) {
    if (!d) return "-";
    return new Intl.DateTimeFormat("en-SG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(d));
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="app-panel rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <Activity size={20} className="text-[#F38978]" />
          <h2 className="text-xl font-semibold text-[#251E1F]">Audit Logs</h2>
        </div>
        <p className="mt-1 text-sm text-[#7b6660]">Track all settings changes and security events.</p>

        {/* Filters */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <form onSubmit={handleSearch} className="flex flex-1 items-center gap-2 rounded-lg border border-[#ead3cc] bg-white px-3 py-2">
            <Search size={15} className="text-[#F38978]" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search actions..."
              className="w-full bg-transparent text-sm text-[#251E1F] outline-none placeholder:text-[#7b6660]/50" />
            {search && (
              <button type="button" aria-label="Clear audit log search" onClick={() => { setSearch(""); setPage(1); loadLogs({ page: 1, search: "" }); }} className="text-[#7b6660] hover:text-[#251E1F]">
                <X size={14} />
              </button>
            )}
          </form>
          <select value={moduleFilter} onChange={(e) => { setModuleFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-[#ead3cc] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none">
            <option value="" className="bg-[#fff3ee]">All Modules</option>
            <option value="profile" className="bg-[#fff3ee]">Profile</option>
            <option value="security" className="bg-[#fff3ee]">Security</option>
            <option value="connected_accounts" className="bg-[#fff3ee]">Connected Accounts</option>
            <option value="invoice_settings" className="bg-[#fff3ee]">Invoice Settings</option>
            <option value="payroll_settings" className="bg-[#fff3ee]">Payroll Settings</option>
            <option value="company_settings" className="bg-[#fff3ee]">Company Settings</option>
            <option value="sessions" className="bg-[#fff3ee]">Sessions</option>
            <option value="danger_zone" className="bg-[#fff3ee]">Danger Zone</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="mt-5 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-[#FDD9CD]/30" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-[#ead3cc] bg-[#fff3ee]/70 px-4 py-8 text-center text-sm text-[#7b6660]">
            No audit logs found.
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#ead3cc]">
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#7b6660]/80">Date</th>
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#7b6660]/80">User</th>
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#7b6660]/80">Action</th>
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#7b6660]/80">Module</th>
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#7b6660]/80">IP Address</th>
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#7b6660]/80">Device</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-[#f0d2ca] hover:bg-[#FDD9CD]/30">
                    <td className="px-3 py-2.5 text-[#7b6660]">{formatDate(log.created_at)}</td>
                    <td className="px-3 py-2.5 text-[#251E1F]">{log.user_name || "-"}</td>
                    <td className="px-3 py-2.5 text-[#251E1F]">{log.action}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded bg-[#F38978]/10 px-2 py-0.5 text-xs font-medium text-[#F38978]">{log.module || "-"}</span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-[#7b6660]">{log.ip_address || "-"}</td>
                    <td className="px-3 py-2.5 text-[#7b6660]">{log.device || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-[#7b6660]">Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="rounded-lg border border-[#ead3cc] bg-white p-2 text-[#7b6660] transition hover:bg-[#FDD9CD]/50 disabled:opacity-30">
                <ChevronLeft size={14} />
              </button>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="rounded-lg border border-[#ead3cc] bg-white p-2 text-[#7b6660] transition hover:bg-[#FDD9CD]/50 disabled:opacity-30">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
