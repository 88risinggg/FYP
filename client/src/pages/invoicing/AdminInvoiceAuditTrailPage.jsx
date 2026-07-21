import { ChevronLeft, ChevronRight, FilterX, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import AdminInvoicingFullView, { ActiveFilters, displayValue, FullViewEmpty, FullViewError, FullViewLoading, FullViewStatus } from "../../components/invoicing/AdminInvoicingFullView.jsx";
import { fetchAuditLogs } from "../../services/adminAuditLogService.js";

const basePath = "/dashboard/invoicing/admin";

function dateTime(value) {
  if (!value) return "\u2014";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "\u2014";
  return new Intl.DateTimeFormat("en-SG", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Singapore" }).format(date);
}

function readFilters(params) {
  return { keyword: params.get("keyword") || "", activityType: params.get("activityType") || "", startDate: params.get("startDate") || "", endDate: params.get("endDate") || "" };
}

export default function AdminInvoiceAuditTrailPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const from = searchParams.get("from") || "";
  const backTo = from === "status-changes" ? `${basePath}/dashboard/invoice-performance/status-changes` : `${basePath}/payment-updates`;
  const [filters, setFilters] = useState(() => readFilters(searchParams));
  const [data, setData] = useState({ logs: [], total: 0, page: 1, limit: 20, activityTypes: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const dateError = filters.startDate && filters.endDate && filters.startDate > filters.endDate ? "End date must be on or after the start date." : "";

  async function load() {
    setLoading(true);
    setError("");
    try { setData(await fetchAuditLogs({ module: "Invoice", page, limit: 20, ...Object.fromEntries(searchParams.entries()) })); }
    catch (requestError) { setError(requestError?.message || "Unable to load invoice audit records."); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [searchParams.toString()]);

  function applyFilters(event) {
    event.preventDefault();
    if (dateError) return;
    const next = new URLSearchParams();
    if (from) next.set("from", from);
    Object.entries(filters).forEach(([key, value]) => { if (value) next.set(key, value); });
    setSearchParams(next);
  }

  function clearFilters() {
    setFilters(readFilters(new URLSearchParams()));
    setSearchParams(from ? { from } : {});
  }

  function goToPage(nextPage) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(nextPage));
    setSearchParams(next);
  }

  const appliedFilters = readFilters(searchParams);
  const hasFilters = Object.values(appliedFilters).some(Boolean);
  const totalPages = Math.max(1, Math.ceil(Number(data.total || 0) / Number(data.limit || 20)));

  return (
    <AdminInvoicingFullView title="Invoice Audit Log" description="Review read-only audit events related to invoice and payment activity." backTo={backTo} backLabel="Back to Previous Invoicing Page" icon={ShieldCheck} count={data.total} countLabel={Number(data.total) === 1 ? "audit event" : "audit events"} actions={<button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-[#ead3cc] bg-white px-4 py-2 text-sm font-bold hover:border-[#F38978] disabled:opacity-60"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh</button>}>
      <form onSubmit={applyFilters} className="rounded-lg border border-[#f0d2ca] bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"><input value={filters.keyword} onChange={(event) => setFilters({ ...filters, keyword: event.target.value })} placeholder="Reference, invoice or user" aria-label="Search audit events" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" /><select value={filters.activityType} onChange={(event) => setFilters({ ...filters, activityType: event.target.value })} aria-label="Activity type" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm"><option value="">All activity types</option>{(data.activityTypes || []).map((type) => <option key={type} value={type}>{type}</option>)}</select><input type="date" value={filters.startDate} max={filters.endDate || undefined} onChange={(event) => setFilters({ ...filters, startDate: event.target.value })} aria-label="Start date" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" /><input type="date" value={filters.endDate} min={filters.startDate || undefined} onChange={(event) => setFilters({ ...filters, endDate: event.target.value })} aria-label="End date" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" /><div className="flex gap-2"><button type="submit" disabled={Boolean(dateError)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#F38978] px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><Search size={15} /> Apply Filters</button><button type="button" onClick={clearFilters} className="inline-flex items-center gap-2 rounded-lg border border-[#ead3cc] px-3 py-2 text-sm font-bold"><FilterX size={15} /> Clear</button></div></div>
        <div className="mt-3">{dateError ? <p role="alert" className="text-sm font-semibold text-rose-700">{dateError}</p> : <ActiveFilters filters={Object.fromEntries(Object.entries(appliedFilters).filter(([, value]) => value))} labels={{ keyword: "Search", activityType: "Activity", startDate: "From", endDate: "To" }} />}</div>
      </form>
      {error ? <FullViewError message="The invoice audit log could not be loaded." onRetry={load} backTo={backTo} backLabel="Back to Previous Invoicing Page" /> : <section className="overflow-hidden rounded-lg border border-[#f0d2ca] bg-white">{loading ? <FullViewLoading label="Loading invoice audit events..." /> : !data.logs?.length ? <FullViewEmpty message="No invoice audit events match the selected filters." hasFilters={hasFilters} onClear={clearFilters} /> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="bg-[#fff8f5] text-xs uppercase text-[#7b6660]"><th className="px-3 py-3">Timestamp</th><th className="px-3 py-3">User</th><th className="px-3 py-3">Activity</th><th className="px-3 py-3">Affected Record</th><th className="px-3 py-3">Description</th><th className="px-3 py-3">Status</th></tr></thead><tbody className="divide-y divide-[#f4ded7]">{data.logs.map((log) => <tr key={log.id} className="align-top hover:bg-[#fff8f5]"><td className="whitespace-nowrap px-3 py-3">{dateTime(log.createdAt)}</td><td className="px-3 py-3">{displayValue(log.userName || "System")}</td><td className="px-3 py-3">{displayValue(log.activityType)}</td><td className="px-3 py-3">{displayValue(log.affectedRecord)}</td><td className="min-w-80 px-3 py-3">{displayValue(log.actionDescription)}</td><td className="px-3 py-3"><FullViewStatus value={log.status} /></td></tr>)}</tbody></table></div>}{!loading && data.logs?.length ? <div className="flex items-center justify-between border-t border-[#f0d2ca] px-5 py-4"><p className="text-sm text-[#7b6660]">Showing {data.logs.length} of {data.total} audit events</p><div className="flex items-center gap-2"><button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => goToPage(page - 1)} className="rounded-lg border border-[#ead3cc] p-2 disabled:opacity-40"><ChevronLeft size={16} /></button><span className="text-sm">Page {page} of {totalPages}</span><button type="button" aria-label="Next page" disabled={page >= totalPages} onClick={() => goToPage(page + 1)} className="rounded-lg border border-[#ead3cc] p-2 disabled:opacity-40"><ChevronRight size={16} /></button></div></div> : null}</section>}
    </AdminInvoicingFullView>
  );
}
