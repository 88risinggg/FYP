import { ChevronLeft, ChevronRight, CreditCard, FilterX, RefreshCw, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import AdminInvoicingFullView, {
  ActiveFilters,
  displayValue,
  FullViewEmpty,
  FullViewError,
  FullViewLoading,
  FullViewStatus
} from "../../components/invoicing/AdminInvoicingFullView.jsx";
import { fetchAdminPaymentUpdates } from "../../services/adminDashboardService.js";

const basePath = "/dashboard/invoicing/admin";
const summaryPath = `${basePath}/dashboard/payment-reminder-summary`;

function formatDateTime(value) {
  if (!value) return "\u2014";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "\u2014";
  return new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Singapore" }).format(date);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(Number(value || 0));
}

function readFilters(params) {
  return {
    keyword: params.get("keyword") || "",
    status: params.get("status") || "",
    method: params.get("method") || "",
    customer: params.get("customer") || "",
    updatedBy: params.get("updatedBy") || "",
    dateFrom: params.get("dateFrom") || "",
    dateTo: params.get("dateTo") || ""
  };
}

export default function AdminPaymentUpdatesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const range = searchParams.get("range") || "today";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const [filters, setFilters] = useState(() => readFilters(searchParams));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const dateError = filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo ? "End date must be on or after the start date." : "";

  async function load() {
    setLoading(true);
    setError("");
    try { setData(await fetchAdminPaymentUpdates({ page, pageSize: 20, ...Object.fromEntries(searchParams.entries()) })); }
    catch (requestError) { setError(requestError?.message || "Unable to load payment update history."); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [searchParams.toString()]);

  function applyFilters(event) {
    event.preventDefault();
    if (dateError) return;
    const next = new URLSearchParams({ range });
    Object.entries(filters).forEach(([key, value]) => { if (value) next.set(key, value); });
    setSearchParams(next);
  }

  function clearFilters() {
    setFilters(readFilters(new URLSearchParams()));
    setSearchParams({ range });
  }

  function goToPage(nextPage) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(nextPage));
    setSearchParams(next);
  }

  const rows = data?.records || [];
  const pagination = data?.pagination || { page: 1, total: 0, totalPages: 1 };
  const appliedFilters = readFilters(searchParams);
  const hasFilters = Object.values(appliedFilters).some(Boolean);

  return (
    <AdminInvoicingFullView title="Payment Update History" description="Review recent invoice payment status changes and audit information." backTo={`${summaryPath}?range=${range}#recent-payment-updates`} backLabel="Back to Invoicing Dashboard" icon={CreditCard} count={pagination.total} countLabel={pagination.total === 1 ? "payment update" : "payment updates"} actions={<button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-[#ead3cc] bg-white px-4 py-2 text-sm font-bold hover:border-[#F38978] disabled:opacity-60"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh</button>}>
      <form onSubmit={applyFilters} className="rounded-lg border border-[#f0d2ca] bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
          <input value={filters.keyword} onChange={(event) => setFilters({ ...filters, keyword: event.target.value })} placeholder="Reference or invoice" aria-label="Payment reference or invoice" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
          <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} aria-label="Payment status" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm"><option value="">All payment statuses</option><option>Completed</option><option>Paid</option><option>Pending</option><option>Failed</option><option>Refunded</option></select>
          <input value={filters.method} onChange={(event) => setFilters({ ...filters, method: event.target.value })} placeholder="Payment method" aria-label="Payment method" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
          <input value={filters.customer} onChange={(event) => setFilters({ ...filters, customer: event.target.value })} placeholder="Customer" aria-label="Customer" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
          <input value={filters.updatedBy} onChange={(event) => setFilters({ ...filters, updatedBy: event.target.value })} placeholder="Updated by" aria-label="Updated by" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
          <input type="date" value={filters.dateFrom} max={filters.dateTo || undefined} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} aria-label="Start date" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
          <input type="date" value={filters.dateTo} min={filters.dateFrom || undefined} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} aria-label="End date" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
          <div className="flex gap-2"><button type="submit" disabled={Boolean(dateError)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#F38978] px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><Search size={15} /> Apply Filters</button><button type="button" onClick={clearFilters} className="inline-flex items-center gap-2 rounded-lg border border-[#ead3cc] px-3 py-2 text-sm font-bold"><FilterX size={15} /> Clear</button></div>
        </div>
        <div className="mt-3">{dateError ? <p role="alert" className="text-sm font-semibold text-rose-700">{dateError}</p> : <ActiveFilters filters={Object.fromEntries(Object.entries(appliedFilters).filter(([, value]) => value))} labels={{ keyword: "Search", status: "Status", method: "Method", customer: "Customer", updatedBy: "Updated by", dateFrom: "From", dateTo: "To" }} />}</div>
      </form>

      {error ? <FullViewError message="The payment update history could not be loaded." onRetry={load} backTo={`${summaryPath}?range=${range}#recent-payment-updates`} backLabel="Back to Invoicing Dashboard" /> : (
        <section className="overflow-hidden rounded-lg border border-[#f0d2ca] bg-white">
          {loading ? <FullViewLoading label="Loading payment updates..." /> : !rows.length ? <FullViewEmpty message="No payment updates match the selected date range and filters." hasFilters={hasFilters} onClear={clearFilters} /> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="bg-[#fff8f5] text-xs uppercase text-[#7b6660]"><th className="px-3 py-3">Updated At</th><th className="px-3 py-3">Payment Reference</th><th className="px-3 py-3">Invoice Number</th><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Payment Method</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3">Updated By</th><th className="px-3 py-3">Read-only Actions</th></tr></thead><tbody className="divide-y divide-[#f4ded7]">{rows.map((payment) => <tr key={payment.id || payment.reference} className="hover:bg-[#fff8f5]"><td className="whitespace-nowrap px-3 py-3">{formatDateTime(payment.date)}</td><td className="whitespace-nowrap px-3 py-3 font-bold">{displayValue(payment.reference)}</td><td className="whitespace-nowrap px-3 py-3">{displayValue(payment.invoiceNo)}</td><td className="px-3 py-3">{displayValue(payment.customerName)}</td><td className="px-3 py-3">{displayValue(payment.paymentMethod)}</td><td className="px-3 py-3"><FullViewStatus value={payment.status} /></td><td className="whitespace-nowrap px-3 py-3 text-right font-bold">{formatCurrency(payment.amount)}</td><td className="whitespace-nowrap px-3 py-3">{displayValue(payment.updatedBy || "System")}</td><td className="whitespace-nowrap px-3 py-3"><div className="flex gap-3"><Link to={`${basePath}/payment-updates/${encodeURIComponent(payment.id || payment.reference)}?from=payment-updates`} className="font-bold text-[#F38978] hover:underline">View Payment</Link>{payment.invoiceId ? <Link to={`${basePath}/invoice-records/${payment.invoiceId}?from=payment-updates`} className="font-bold text-[#F38978] hover:underline">View Invoice</Link> : <span className="text-[#9c7b72]" title="No related invoice is available">Invoice unavailable</span>}<Link to={`${basePath}/audit-trail?keyword=${encodeURIComponent(payment.reference || payment.id || "")}&from=payment-updates`} className="font-bold text-[#F38978] hover:underline">View Audit Log</Link></div></td></tr>)}</tbody></table></div>}
          {!loading && rows.length ? <div className="flex items-center justify-between gap-4 border-t border-[#f0d2ca] px-5 py-4"><p className="text-sm text-[#7b6660]">Showing {rows.length} of {pagination.total} payment updates</p><div className="flex items-center gap-2"><button type="button" aria-label="Previous page" disabled={pagination.page <= 1} onClick={() => goToPage(pagination.page - 1)} className="rounded-lg border border-[#ead3cc] p-2 disabled:opacity-40"><ChevronLeft size={16} /></button><span className="text-sm">Page {pagination.page} of {pagination.totalPages}</span><button type="button" aria-label="Next page" disabled={pagination.page >= pagination.totalPages} onClick={() => goToPage(pagination.page + 1)} className="rounded-lg border border-[#ead3cc] p-2 disabled:opacity-40"><ChevronRight size={16} /></button></div></div> : null}
        </section>
      )}
    </AdminInvoicingFullView>
  );
}
