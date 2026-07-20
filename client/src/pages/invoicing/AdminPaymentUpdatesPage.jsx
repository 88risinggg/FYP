import { ArrowLeft, ChevronLeft, ChevronRight, CreditCard, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { fetchAdminPaymentUpdates } from "../../services/adminDashboardService.js";

const summaryPath = "/dashboard/invoicing/admin/dashboard/payment-reminder-summary";

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-SG", {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Singapore"
  }).format(date);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(Number(value || 0));
}

function StatusBadge({ value }) {
  const normalized = String(value || "Pending").toLowerCase();
  const style = ["paid", "completed", "success", "successful", "verified"].includes(normalized)
    ? "bg-[#e9f7ef] text-[#2f8758]"
    : ["failed", "rejected", "refunded", "chargeback"].includes(normalized)
      ? "bg-[#fff0eb] text-[#c94c3a]"
      : "bg-[#fff4d8] text-[#9a6412]";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${style}`}>{value || "Pending"}</span>;
}

export default function AdminPaymentUpdatesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const range = searchParams.get("range") || "today";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const [filters, setFilters] = useState({
    keyword: searchParams.get("keyword") || "",
    status: searchParams.get("status") || "",
    method: searchParams.get("method") || "",
    dateFrom: searchParams.get("dateFrom") || "",
    dateTo: searchParams.get("dateTo") || ""
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await fetchAdminPaymentUpdates({ page, pageSize: 20, ...Object.fromEntries(searchParams.entries()) }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [searchParams.toString()]);

  function applyFilters(event) {
    event.preventDefault();
    const next = new URLSearchParams({ range });
    Object.entries(filters).forEach(([key, value]) => { if (value) next.set(key, value); });
    setSearchParams(next);
  }

  function clearFilters() {
    setFilters({ keyword: "", status: "", method: "", dateFrom: "", dateTo: "" });
    setSearchParams({ range });
  }

  function goToPage(nextPage) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(nextPage));
    setSearchParams(next);
  }

  const rows = data?.records || [];
  const pagination = data?.pagination || { page: 1, total: 0, totalPages: 1 };

  return (
    <main className="min-h-screen bg-[linear-gradient(90deg,#FDD9CD_0%,#fff8f5_15%,#fffaf8_58%,#FDD9CD_100%)] p-4 text-[#251E1F] sm:p-6">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <header className="rounded-xl border border-[#f0d2ca] bg-white/95 p-5 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F38978]/15 text-[#c55245]"><CreditCard size={20} /></span>
              <div><p className="text-xs font-bold uppercase tracking-wide text-[#F38978]">Admin Payment Monitoring</p><h1 className="mt-1 text-2xl font-bold">Complete Payment Update History</h1><p className="mt-1 text-sm text-[#7b6660]">Read-only payment records. Times use Asia/Singapore.</p></div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => navigate(`${summaryPath}?range=${range}#recent-payment-updates`)} className="inline-flex items-center gap-2 rounded-lg border border-[#f0d2ca] bg-white px-4 py-2 text-sm font-bold hover:border-[#F38978]"><ArrowLeft size={16} /> Back</button>
              <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-[#f0d2ca] bg-white px-4 py-2 text-sm font-bold hover:border-[#F38978] disabled:opacity-60"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh</button>
            </div>
          </div>
        </header>

        <form onSubmit={applyFilters} className="grid gap-3 rounded-xl border border-[#f0d2ca] bg-white/95 p-4 md:grid-cols-2 xl:grid-cols-7">
          <input value={filters.keyword} onChange={(event) => setFilters({ ...filters, keyword: event.target.value })} placeholder="Reference, invoice or customer" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm xl:col-span-2" />
          <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm"><option value="">All statuses</option><option>Completed</option><option>Paid</option><option>Pending</option><option>Failed</option><option>Refunded</option></select>
          <input value={filters.method} onChange={(event) => setFilters({ ...filters, method: event.target.value })} placeholder="Payment method" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
          <input type="date" value={filters.dateFrom} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
          <input type="date" value={filters.dateTo} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
          <div className="flex gap-2"><button className="flex-1 rounded-lg bg-[#F38978] px-4 py-2 text-sm font-bold text-white hover:bg-[#df7667]">Apply</button><button type="button" onClick={clearFilters} className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm font-bold">Clear</button></div>
        </form>

        {error ? <div className="rounded-xl border border-[#f3c6bc] bg-[#fff0eb] px-4 py-3 text-sm font-semibold text-[#c55245]">{error}</div> : null}
        <section className="overflow-hidden rounded-xl border border-[#f0d2ca] bg-white/95 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
          <div className="border-b border-[#f0d2ca] px-5 py-4 text-sm text-[#7b6660]">{loading ? "Loading…" : `${pagination.total} payment update${pagination.total === 1 ? "" : "s"}`}</div>
          {loading ? <div className="h-64 animate-pulse bg-white/70" /> : rows.length === 0 ? <div className="px-5 py-16 text-center text-sm text-[#7b6660]">No payment updates match the selected filters.</div> : (
            <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="bg-[#fff8f5] text-xs uppercase tracking-wide text-[#7b6660]"><th className="px-4 py-3">Date</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Payment Method</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Updated By</th></tr></thead><tbody className="divide-y divide-[#f4ded7]">{rows.map((payment) => <tr key={payment.id || payment.reference} className="hover:bg-[#fff8f5]"><td className="whitespace-nowrap px-4 py-3">{formatDateTime(payment.date)}</td><td className="whitespace-nowrap px-4 py-3 font-bold">{payment.reference || "-"}</td><td className="whitespace-nowrap px-4 py-3">{payment.invoiceNo || "-"}</td><td className="px-4 py-3">{payment.customerName || "-"}</td><td className="px-4 py-3">{payment.paymentMethod || "-"}</td><td className="px-4 py-3"><StatusBadge value={payment.status} /></td><td className="whitespace-nowrap px-4 py-3 text-right font-bold">{formatCurrency(payment.amount)}</td><td className="whitespace-nowrap px-4 py-3">{payment.updatedBy || "System"}</td></tr>)}</tbody></table></div>
          )}
          <div className="flex items-center justify-between border-t border-[#f0d2ca] px-5 py-4"><p className="text-xs text-[#7b6660]">Page {pagination.page} of {pagination.totalPages}</p><div className="flex gap-2"><button type="button" disabled={pagination.page <= 1} onClick={() => goToPage(pagination.page - 1)} className="rounded-lg border border-[#ead3cc] p-2 disabled:opacity-40"><ChevronLeft size={16} /></button><button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => goToPage(pagination.page + 1)} className="rounded-lg border border-[#ead3cc] p-2 disabled:opacity-40"><ChevronRight size={16} /></button></div></div>
        </section>
      </div>
    </main>
  );
}
