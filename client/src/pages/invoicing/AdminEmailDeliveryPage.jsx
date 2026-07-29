/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - ADMIN
 * PURPOSE: Implements the Admin Email Delivery Page screen and its page-level interactions.
 * LAYER: Frontend page - renders a complete screen and coordinates its user interactions.
 * FIND RELATED CODE: Trace its imports for UI components and frontend services used by this screen.
 */
import { ChevronLeft, ChevronRight, FilterX, Mail, RefreshCw, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";

import AdminInvoicingFullView, {
  ActiveFilters,
  displayValue,
  FullViewEmpty,
  FullViewError,
  FullViewLoading,
  FullViewStatus
} from "../../components/invoicing/AdminInvoicingFullView.jsx";
import { fetchAdminEmailDelivery } from "../../services/adminDashboardService.js";

const summaryPath = "/dashboard/invoicing/admin/dashboard/payment-reminder-summary";
const configs = {
  "successful-today": { title: "Successfully Delivered Today", empty: "No successful invoice emails were delivered today." },
  "failed-today": { title: "Failed Email Deliveries Today", empty: "No failed invoice email deliveries were recorded today." },
  "pending-delivery": { title: "Pending Email Delivery", empty: "No pending invoice emails are waiting for delivery." },
  "delivery-rate": { title: "Email Delivery Rate", empty: "No completed invoice email deliveries were recorded today." },
  logs: { title: "Invoice Email Delivery Logs", empty: "No invoicing email delivery records match the selected filters." }
};

function formatDateTime(value) {
  if (!value) return "\u2014";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "\u2014";
  return new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Singapore" }).format(date);
}

function readFilters(params) {
  return {
    status: params.get("status") || "",
    emailType: params.get("emailType") || "",
    recipient: params.get("recipient") || "",
    invoiceNumber: params.get("invoiceNumber") || "",
    provider: params.get("provider") || "",
    dateFrom: params.get("dateFrom") || "",
    dateTo: params.get("dateTo") || ""
  };
}

export default function AdminEmailDeliveryPage() {
  const { category = "logs" } = useParams();
  const config = configs[category];
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
    try { setData(await fetchAdminEmailDelivery({ category, page, pageSize: 20, ...Object.fromEntries(searchParams.entries()) })); }
    catch (requestError) { setError(requestError?.message || "Unable to load email delivery records."); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (config) load(); }, [category, searchParams.toString()]);

  if (!config) return <Navigate to={`${summaryPath}?range=${range}#email-delivery-summary`} replace />;

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

  const appliedFilters = readFilters(searchParams);
  const hasFilters = Object.values(appliedFilters).some(Boolean);
  const records = data?.records || [];
  const pagination = data?.pagination || { page: 1, total: 0, totalPages: 1 };

  return (
    <AdminInvoicingFullView title={config.title} description="Review the delivery status of invoice-related emails." backTo={`${summaryPath}?range=${range}#email-delivery-summary`} backLabel="Back to Email Delivery Summary" icon={Mail} count={pagination.total} countLabel={pagination.total === 1 ? "delivery record" : "delivery records"} actions={<button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-[#ead3cc] bg-white px-4 py-2 text-sm font-bold hover:border-[#F38978] disabled:opacity-60"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh</button>}>
      <form onSubmit={applyFilters} className="rounded-lg border border-[#f0d2ca] bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
          <input type="date" value={filters.dateFrom} max={filters.dateTo || undefined} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} aria-label="Start date" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
          <input type="date" value={filters.dateTo} min={filters.dateFrom || undefined} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} aria-label="End date" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
          <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} aria-label="Delivery status" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm"><option value="">All delivery statuses</option><option>Sent</option><option>Failed</option><option>Pending</option><option>Queued</option><option>Processing</option><option>Scheduled</option></select>
          <input value={filters.emailType} onChange={(event) => setFilters({ ...filters, emailType: event.target.value })} placeholder="Email type" aria-label="Email type" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
          <input value={filters.recipient} onChange={(event) => setFilters({ ...filters, recipient: event.target.value })} placeholder="Recipient" aria-label="Recipient" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
          <input value={filters.invoiceNumber} onChange={(event) => setFilters({ ...filters, invoiceNumber: event.target.value })} placeholder="Invoice number" aria-label="Invoice number" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
          <input value={filters.provider} onChange={(event) => setFilters({ ...filters, provider: event.target.value })} placeholder="Email provider" aria-label="Email provider" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
          <div className="flex gap-2"><button type="submit" disabled={Boolean(dateError)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#F38978] px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><Search size={15} /> Apply Filters</button><button type="button" onClick={clearFilters} className="inline-flex items-center gap-2 rounded-lg border border-[#ead3cc] px-3 py-2 text-sm font-bold"><FilterX size={15} /> Clear</button></div>
        </div>
        <div className="mt-3">{dateError ? <p role="alert" className="text-sm font-semibold text-rose-700">{dateError}</p> : <ActiveFilters filters={Object.fromEntries(Object.entries(appliedFilters).filter(([, value]) => value))} labels={{ dateFrom: "From", dateTo: "To", status: "Status", emailType: "Type", recipient: "Recipient", invoiceNumber: "Invoice", provider: "Provider" }} />}</div>
      </form>

      {error ? <FullViewError message="The invoice email delivery records could not be loaded." onRetry={load} backTo={`${summaryPath}?range=${range}#email-delivery-summary`} backLabel="Back to Email Delivery Summary" /> : (
        <section className="overflow-hidden rounded-lg border border-[#f0d2ca] bg-white">
          {loading ? <FullViewLoading label="Loading invoice email delivery records..." /> : !records.length ? <FullViewEmpty message={config.empty} hasFilters={hasFilters} onClear={clearFilters} /> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="bg-[#fff8f5] text-xs uppercase text-[#7b6660]"><th className="px-3 py-3">Email Type</th><th className="px-3 py-3">Invoice Number</th><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Recipient Email</th><th className="px-3 py-3">Subject</th><th className="px-3 py-3">Created At</th><th className="px-3 py-3">Sent At</th><th className="px-3 py-3">Delivery Status</th><th className="px-3 py-3">Failure Reason</th><th className="px-3 py-3">Retry Count</th><th className="px-3 py-3">Provider</th><th className="px-3 py-3">Actions</th></tr></thead><tbody className="divide-y divide-[#f4ded7]">{records.map((row) => <tr key={row.id} className="align-top hover:bg-[#fff8f5]"><td className="px-3 py-3">{displayValue(row.emailType)}</td><td className="whitespace-nowrap px-3 py-3 font-bold">{displayValue(row.invoiceNumber)}</td><td className="px-3 py-3">{displayValue(row.customerName)}</td><td className="px-3 py-3">{displayValue(row.recipientEmail)}</td><td className="max-w-64 truncate px-3 py-3" title={row.subject}>{displayValue(row.subject)}</td><td className="whitespace-nowrap px-3 py-3">{formatDateTime(row.createdAt)}</td><td className="whitespace-nowrap px-3 py-3">{formatDateTime(row.sentAt)}</td><td className="px-3 py-3"><FullViewStatus value={row.deliveryStatus} /></td><td className="max-w-72 px-3 py-3">{displayValue(row.failureReason)}</td><td className="px-3 py-3">{Number(row.retryCount || 0)}</td><td className="px-3 py-3">{displayValue(row.provider)}</td><td className="whitespace-nowrap px-3 py-3">{row.invoiceId ? <Link to={`/dashboard/invoicing/admin/invoice-records/${row.invoiceId}?from=email-delivery`} className="font-bold text-[#F38978] hover:underline">View Invoice</Link> : <span className="text-[#9c7b72]" title="No related invoice is available">Unavailable</span>}</td></tr>)}</tbody></table></div>}
          {!loading && records.length ? <div className="flex items-center justify-between gap-4 border-t border-[#f0d2ca] px-5 py-4"><p className="text-sm text-[#7b6660]">Showing {records.length} of {pagination.total} delivery records</p><div className="flex items-center gap-2"><button type="button" aria-label="Previous page" disabled={pagination.page <= 1} onClick={() => goToPage(pagination.page - 1)} className="rounded-lg border border-[#ead3cc] p-2 disabled:opacity-40"><ChevronLeft size={16} /></button><span className="text-sm">Page {pagination.page} of {pagination.totalPages}</span><button type="button" aria-label="Next page" disabled={pagination.page >= pagination.totalPages} onClick={() => goToPage(pagination.page + 1)} className="rounded-lg border border-[#ead3cc] p-2 disabled:opacity-40"><ChevronRight size={16} /></button></div></div> : null}
        </section>
      )}
    </AdminInvoicingFullView>
  );
}
