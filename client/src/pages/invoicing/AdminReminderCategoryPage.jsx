import { BellRing, ChevronLeft, ChevronRight, FilterX, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";

import AdminInvoicingFullView, {
  ActiveFilters,
  displayValue,
  FullViewEmpty,
  FullViewError,
  FullViewLoading,
  FullViewStatus
} from "../../components/invoicing/AdminInvoicingFullView.jsx";
import { fetchPaymentReminderSummary } from "../../services/adminDashboardService.js";

const summaryPath = "/dashboard/invoicing/admin/dashboard/payment-reminder-summary";
const categoryConfig = {
  "sent-today": { key: "sentToday", title: "Reminders Sent Today", empty: "No reminders were successfully sent today." },
  "scheduled-today": { key: "scheduledToday", title: "Reminders Scheduled Today", empty: "No reminders are scheduled for today." },
  "failed-today": { key: "failedToday", title: "Failed Reminders", empty: "No failed reminders were recorded today." },
  "overdue-requiring-reminders": { key: "overdueRequiringReminders", title: "Overdue Invoices Requiring Reminders", empty: "No overdue invoices currently require another reminder." }
};

function formatDate(value, includeTime = false) {
  if (!value) return "\u2014";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "\u2014";
  return new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short", year: "numeric", ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}), timeZone: "Asia/Singapore" }).format(date);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(Number(value || 0));
}

function readFilters(params) {
  return {
    status: params.get("status") || "",
    reminderType: params.get("reminderType") || "",
    invoiceStatus: params.get("invoiceStatus") || "",
    customer: params.get("customer") || "",
    invoiceNumber: params.get("invoiceNumber") || "",
    dateFrom: params.get("dateFrom") || "",
    dateTo: params.get("dateTo") || ""
  };
}

export default function AdminReminderCategoryPage() {
  const { category } = useParams();
  const config = categoryConfig[category];
  const [searchParams, setSearchParams] = useSearchParams();
  const range = searchParams.get("range") || "today";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const [filters, setFilters] = useState(() => readFilters(searchParams));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try { setData(await fetchPaymentReminderSummary(range)); }
    catch (requestError) { setError(requestError?.message || "Unable to load reminder records."); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (config) load(); }, [category, range]);

  const appliedFilters = readFilters(searchParams);
  const dateError = filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo ? "End date must be on or after the start date." : "";
  const filteredRows = useMemo(() => {
    const source = data?.reminderSummary?.details?.[config?.key] || [];
    const from = appliedFilters.dateFrom ? new Date(`${appliedFilters.dateFrom}T00:00:00+08:00`).getTime() : null;
    const to = appliedFilters.dateTo ? new Date(`${appliedFilters.dateTo}T23:59:59.999+08:00`).getTime() : null;
    return source.filter((row) => {
      if (appliedFilters.status && String(row.deliveryStatus || row.currentReminderStatus).toLowerCase() !== appliedFilters.status.toLowerCase()) return false;
      if (appliedFilters.reminderType && !String(row.reminderType || "").toLowerCase().includes(appliedFilters.reminderType.toLowerCase())) return false;
      if (appliedFilters.invoiceStatus && String(row.invoiceStatus || "").toLowerCase() !== appliedFilters.invoiceStatus.toLowerCase()) return false;
      if (appliedFilters.customer && !String(row.customerName || "").toLowerCase().includes(appliedFilters.customer.toLowerCase())) return false;
      if (appliedFilters.invoiceNumber && !String(row.invoiceNumber || "").toLowerCase().includes(appliedFilters.invoiceNumber.toLowerCase())) return false;
      const timestamp = new Date(row.sentAt || row.attemptedAt || row.scheduledAt || row.dueDate || 0).getTime();
      if (from && timestamp < from) return false;
      if (to && timestamp > to) return false;
      return true;
    });
  }, [appliedFilters, config?.key, data]);
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const rows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  if (!config) return <Navigate to={`${summaryPath}?range=${range}#reminder-summary`} replace />;

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

  const hasFilters = Object.values(appliedFilters).some(Boolean);
  return (
    <AdminInvoicingFullView title={config.title} description="Review scheduled, successful and failed invoice payment reminders." backTo={`${summaryPath}?range=${range}#reminder-summary`} backLabel="Back to Reminder Summary" icon={BellRing} count={filteredRows.length} countLabel={filteredRows.length === 1 ? "reminder record" : "reminder records"} actions={<button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-[#ead3cc] bg-white px-4 py-2 text-sm font-bold hover:border-[#F38978] disabled:opacity-60"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh</button>}>
      <form onSubmit={applyFilters} className="rounded-lg border border-[#f0d2ca] bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
          <input type="date" value={filters.dateFrom} max={filters.dateTo || undefined} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} aria-label="Start date" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
          <input type="date" value={filters.dateTo} min={filters.dateFrom || undefined} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} aria-label="End date" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
          <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} aria-label="Reminder status" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm"><option value="">All reminder statuses</option><option>Sent</option><option>Pending</option><option>Failed</option></select>
          <input value={filters.reminderType} onChange={(event) => setFilters({ ...filters, reminderType: event.target.value })} placeholder="Reminder type" aria-label="Reminder type" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
          <input value={filters.invoiceStatus} onChange={(event) => setFilters({ ...filters, invoiceStatus: event.target.value })} placeholder="Invoice status" aria-label="Invoice status" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
          <input value={filters.customer} onChange={(event) => setFilters({ ...filters, customer: event.target.value })} placeholder="Customer" aria-label="Customer" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
          <input value={filters.invoiceNumber} onChange={(event) => setFilters({ ...filters, invoiceNumber: event.target.value })} placeholder="Invoice number" aria-label="Invoice number" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
          <div className="flex gap-2"><button type="submit" disabled={Boolean(dateError)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#F38978] px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><Search size={15} /> Apply Filters</button><button type="button" onClick={clearFilters} className="inline-flex items-center gap-2 rounded-lg border border-[#ead3cc] px-3 py-2 text-sm font-bold"><FilterX size={15} /> Clear</button></div>
        </div>
        <div className="mt-3">{dateError ? <p role="alert" className="text-sm font-semibold text-rose-700">{dateError}</p> : <ActiveFilters filters={Object.fromEntries(Object.entries(appliedFilters).filter(([, value]) => value))} labels={{ dateFrom: "From", dateTo: "To", status: "Status", reminderType: "Type", invoiceStatus: "Invoice status", customer: "Customer", invoiceNumber: "Invoice" }} />}</div>
      </form>

      {error ? <FullViewError message="The reminder records could not be loaded." onRetry={load} backTo={`${summaryPath}?range=${range}#reminder-summary`} backLabel="Back to Reminder Summary" /> : <section className="overflow-hidden rounded-lg border border-[#f0d2ca] bg-white">{loading ? <FullViewLoading label="Loading reminder records..." /> : !rows.length ? <FullViewEmpty message={config.empty} hasFilters={hasFilters} onClear={clearFilters} /> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="bg-[#fff8f5] text-xs uppercase text-[#7b6660]"><th className="px-3 py-3">Invoice Number</th><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Customer Email</th><th className="px-3 py-3">Reminder Type</th><th className="px-3 py-3">Sequence</th><th className="px-3 py-3">Scheduled At</th><th className="px-3 py-3">Sent At</th><th className="px-3 py-3">Delivery Status</th><th className="px-3 py-3">Failure Reason</th><th className="px-3 py-3">Due Date</th><th className="px-3 py-3 text-right">Outstanding Balance</th></tr></thead><tbody className="divide-y divide-[#f4ded7]">{rows.map((row) => <tr key={row.id} className="align-top hover:bg-[#fff8f5]"><td className="whitespace-nowrap px-3 py-3 font-bold">{displayValue(row.invoiceNumber)}</td><td className="px-3 py-3">{displayValue(row.customerName)}</td><td className="px-3 py-3">{displayValue(row.customerEmail)}</td><td className="px-3 py-3 capitalize">{displayValue(String(row.reminderType || "").replaceAll("_", " "))}</td><td className="px-3 py-3">{displayValue(row.reminderSequence)}</td><td className="whitespace-nowrap px-3 py-3">{formatDate(row.scheduledAt, true)}</td><td className="whitespace-nowrap px-3 py-3">{formatDate(row.sentAt, true)}</td><td className="px-3 py-3"><FullViewStatus value={row.deliveryStatus || row.currentReminderStatus} /></td><td className="max-w-64 px-3 py-3">{displayValue(row.failureReason)}</td><td className="whitespace-nowrap px-3 py-3">{formatDate(row.dueDate)}</td><td className="whitespace-nowrap px-3 py-3 text-right font-bold">{formatCurrency(row.outstandingBalance)}</td></tr>)}</tbody></table></div>}{!loading && rows.length ? <div className="flex items-center justify-between border-t border-[#f0d2ca] px-5 py-4"><p className="text-sm text-[#7b6660]">Showing {rows.length} of {filteredRows.length} reminder records</p><div className="flex items-center gap-2"><button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => goToPage(page - 1)} className="rounded-lg border border-[#ead3cc] p-2 disabled:opacity-40"><ChevronLeft size={16} /></button><span className="text-sm">Page {Math.min(page, totalPages)} of {totalPages}</span><button type="button" aria-label="Next page" disabled={page >= totalPages} onClick={() => goToPage(page + 1)} className="rounded-lg border border-[#ead3cc] p-2 disabled:opacity-40"><ChevronRight size={16} /></button></div></div> : null}</section>}
    </AdminInvoicingFullView>
  );
}
