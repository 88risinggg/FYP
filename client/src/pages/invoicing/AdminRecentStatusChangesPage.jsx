/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - ADMIN
 * PURPOSE: Implements the Admin Recent Status Changes Page screen and its page-level interactions.
 * LAYER: Frontend page - renders a complete screen and coordinates its user interactions.
 * FIND RELATED CODE: Trace its imports for UI components and frontend services used by this screen.
 */
import { Activity, AlertCircle, ArrowRight, ChevronLeft, ChevronRight, Loader2, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { fetchInvoicePerformance } from "../../services/adminDashboardService.js";
import AdminInvoicingFullView, { ActiveFilters } from "../../components/invoicing/AdminInvoicingFullView.jsx";

const performancePath = "/dashboard/invoicing/admin/dashboard/invoice-performance";
const basePath = "/dashboard/invoicing/admin";
const ranges = [
  ["today", "Today"], ["last-7-days", "Last 7 Days"], ["last-30-days", "Last 30 Days"],
  ["last-90-days", "Last 90 Days"], ["this-month", "This Month"], ["this-quarter", "This Quarter"],
  ["this-year", "This Year"], ["all-time", "All Time"], ["custom", "Custom Range"]
];
const statuses = ["", "Draft", "Sent", "Viewed", "Paid", "Overdue"];

function formatCurrency(value) {
  return new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-SG", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Singapore" }).format(new Date(value));
}

export default function AdminRecentStatusChangesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [range, setRange] = useState(searchParams.get("range") || "last-30-days");
  const [startDate, setStartDate] = useState(searchParams.get("startDate") || "");
  const [endDate, setEndDate] = useState(searchParams.get("endDate") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const [search, setSearch] = useState(searchInput);
  const [page, setPage] = useState(Math.max(1, Number(searchParams.get("page")) || 1));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestRef = useRef(null);
  const validationError = range === "custom" && (!startDate || !endDate || startDate > endDate)
    ? "Choose a valid start and end date."
    : "";

  const load = useCallback(async () => {
    if (validationError) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");
    const filters = { section: "status-changes", page, pageSize: 10, status, search };
    if (range === "custom") Object.assign(filters, { startDate, endDate });
    try {
      const response = await fetchInvoicePerformance(range, filters, { signal: controller.signal });
      setData(response);
      const next = { range, page: String(page) };
      if (range === "custom") Object.assign(next, { startDate, endDate });
      if (status) next.status = status;
      if (search) next.search = search;
      setSearchParams(next, { replace: true });
    } catch (requestError) {
      if (requestError?.name !== "AbortError") setError(requestError?.message || "Unable to load status changes.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [endDate, page, range, search, setSearchParams, startDate, status, validationError]);

  useEffect(() => {
    load();
    return () => requestRef.current?.abort();
  }, [load]);

  function updateRange(value) {
    setRange(value);
    setPage(1);
  }

  function submitSearch(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function clearFilters() {
    setRange("last-30-days");
    setStartDate("");
    setEndDate("");
    setStatus("");
    setSearchInput("");
    setSearch("");
    setPage(1);
  }

  const changes = data?.recentStatusChanges || [];
  const pagination = data?.pagination || { page: 1, total: 0, totalPages: 1 };

  return (
    <AdminInvoicingFullView title="Recent Status Changes" description="Review invoice status changes and related audit information." backTo={performancePath} backLabel="Back to Invoice Performance" icon={Activity} count={pagination.total} countLabel={pagination.total === 1 ? "status change" : "status changes"} actions={<button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-[#ead3cc] bg-white px-4 py-2 text-sm font-bold hover:border-[#F38978] disabled:opacity-60"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh</button>}>
        <section className="rounded-2xl border border-[#f0d2ca] bg-white p-5 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
          <div className="mb-5"><ActiveFilters filters={{ range, ...(range === "custom" ? { startDate, endDate } : {}), ...(status ? { status } : {}), ...(search ? { search } : {}) }} labels={{ range: "Date range", startDate: "From", endDate: "To", status: "New status", search: "Search" }} /></div>
          <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs font-bold text-[#6f4f47]">Date Range<select value={range} onChange={(event) => updateRange(event.target.value)} className="mt-1 block rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm font-medium text-[#251E1F] outline-none focus:border-[#F38978]">{ranges.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              {range === "custom" ? <><label className="text-xs font-bold text-[#6f4f47]">Start<input type="date" value={startDate} max={endDate || undefined} onChange={(event) => { setStartDate(event.target.value); setPage(1); }} className="mt-1 block rounded-lg border border-[#f0d2ca] px-3 py-2 text-sm" /></label><label className="text-xs font-bold text-[#6f4f47]">End<input type="date" value={endDate} min={startDate || undefined} onChange={(event) => { setEndDate(event.target.value); setPage(1); }} className="mt-1 block rounded-lg border border-[#f0d2ca] px-3 py-2 text-sm" /></label></> : null}
              <label className="text-xs font-bold text-[#6f4f47]">New Status<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="mt-1 block rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm font-medium text-[#251E1F]">{statuses.map((item) => <option key={item || "all"} value={item}>{item || "All Statuses"}</option>)}</select></label>
            </div>
            <form onSubmit={submitSearch} className="flex flex-wrap gap-2"><label className="relative"><Search size={16} className="absolute left-3 top-3 text-[#9c7b72]" /><span className="sr-only">Search invoices or customers</span><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Invoice # or customer" className="w-full rounded-lg border border-[#f0d2ca] py-2 pl-9 pr-3 text-sm outline-none focus:border-[#F38978] sm:w-64" /></label><button type="submit" className="rounded-lg bg-[#F38978] px-4 py-2 text-sm font-bold text-white hover:bg-[#E87562]">Apply Filters</button><button type="button" onClick={clearFilters} className="rounded-lg border border-[#f0d2ca] px-4 py-2 text-sm font-bold">Clear Filters</button></form>
          </div>

          {validationError ? <p className="rounded-xl border border-[#FDD9CD] bg-[#FDD9CD] p-4 text-sm text-amber-800">{validationError}</p> : error ? <div className="rounded-xl border border-[#FDD9CD] bg-[#FDD9CD] p-4 text-sm text-red-700"><p className="flex items-center gap-2"><AlertCircle size={17} />{error}</p><button type="button" onClick={load} className="mt-3 inline-flex items-center gap-2 font-bold"><RefreshCw size={15} /> Retry</button></div> : loading && !data ? <div className="flex min-h-72 items-center justify-center gap-2 text-[#7b6660]"><Loader2 size={20} className="animate-spin" /> Loading status changes...</div> : changes.length ? <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-y border-[#f0d2ca] bg-[#fff8f5] text-xs uppercase text-[#7b6660]"><th className="px-4 py-3">Invoice #</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Status Change</th><th className="px-4 py-3">Changed On</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Changed By</th><th className="px-4 py-3">Read-only Actions</th></tr></thead><tbody>{changes.map((change) => <tr key={change.id} className="border-b border-[#FFF3EE]"><td className="px-4 py-3 font-bold">{change.invoiceNo || "-"}</td><td className="px-4 py-3">{change.customerName || "-"}</td><td className="px-4 py-3"><span className="inline-flex items-center gap-2">{change.fromStatus}<ArrowRight size={14} className="text-[#F38978]" /><strong>{change.toStatus}</strong></span></td><td className="whitespace-nowrap px-4 py-3 text-[#7b6660]">{formatDate(change.changedOn)}</td><td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{formatCurrency(change.amount)}</td><td className="px-4 py-3">{change.changedBy || "System"}</td><td className="px-4 py-3">{change.invoiceId ? <div className="flex gap-3"><Link to={`${basePath}/invoice-records/${change.invoiceId}?from=status-changes`} className="font-bold text-[#F38978] hover:underline">View Invoice</Link><Link to={`${basePath}/audit-trail?keyword=${encodeURIComponent(change.invoiceNo || change.invoiceId)}&from=status-changes`} className="font-bold text-[#F38978] hover:underline">View Audit Log</Link></div> : <span className="text-[#7B6660]" title="No related invoice is available">Unavailable</span>}</td></tr>)}</tbody></table></div> : <p className="rounded-xl border border-dashed border-[#F0D2CA] bg-[#fff8f5] p-12 text-center text-sm text-[#7b6660]">No status changes found for these filters.</p>}

          <div className="mt-5 flex items-center justify-between gap-4 text-sm"><span className="text-[#7b6660]">{formatCount(pagination.total)} status changes</span><div className="flex items-center gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Previous page" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#f0d2ca] disabled:opacity-40"><ChevronLeft size={17} /></button><span>Page {pagination.page} of {pagination.totalPages}</span><button type="button" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((current) => current + 1)} aria-label="Next page" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#f0d2ca] disabled:opacity-40"><ChevronRight size={17} /></button></div></div>
        </section>
    </AdminInvoicingFullView>
  );
}

function formatCount(value) {
  return new Intl.NumberFormat("en-SG").format(Number(value || 0));
}
