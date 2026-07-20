import { ArrowLeft, ChevronLeft, ChevronRight, Mail, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { fetchAdminEmailDelivery } from "../../services/adminDashboardService.js";

const summaryPath = "/dashboard/invoicing/admin/dashboard/payment-reminder-summary";
const configs = {
  "successful-today": { title: "Successfully Delivered Today", empty: "No successful email deliveries today." },
  "failed-today": { title: "Failed Email Deliveries Today", empty: "No failed email deliveries today." },
  "pending-delivery": { title: "Pending Email Delivery", empty: "No pending email deliveries." },
  "delivery-rate": { title: "Today's Email Delivery Analytics", empty: "No completed email deliveries today." },
  logs: { title: "Email Delivery Logs", empty: "No invoicing email delivery records match the selected filters." }
};

const commonColumns = [
  ["emailType", "Email Type"], ["invoiceNumber", "Invoice Number"],
  ["customerName", "Customer"], ["recipientEmail", "Recipient Email"],
  ["subject", "Subject"], ["deliveryStatus", "Delivery Status", "status"],
  ["sentAt", "Sent Date and Time", "datetime"], ["provider", "Provider"],
  ["reminderType", "Reminder Type", "type"]
];
const failedColumns = [
  ["emailType", "Email Type"], ["invoiceNumber", "Invoice Number"], ["customerName", "Customer"],
  ["recipientEmail", "Recipient Email"], ["attemptedAt", "Attempted Send", "datetime"],
  ["failureReason", "Failure Reason"], ["errorCode", "Error Code"], ["retryCount", "Retry Count"],
  ["lastRetryAt", "Last Retry", "datetime"], ["invoiceStatus", "Invoice Status", "status"]
];
const pendingColumns = [
  ["emailType", "Email Type"], ["invoiceNumber", "Invoice Number"], ["customerName", "Customer"],
  ["recipientEmail", "Recipient Email"], ["deliveryStatus", "Queue Status", "status"],
  ["scheduledAt", "Scheduled Send", "datetime"], ["createdAt", "Created", "datetime"],
  ["processingStartedAt", "Processing Started", "datetime"], ["retryCount", "Retry Count"],
  ["invoiceStatus", "Invoice Status", "status"]
];

function columnsFor(category) {
  if (category === "failed-today") return failedColumns;
  if (category === "pending-delivery") return pendingColumns;
  return commonColumns;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-SG", {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Singapore"
  }).format(date);
}

function Cell({ value, kind }) {
  if (kind === "datetime") return formatDateTime(value);
  if (kind === "type") return value ? <span className="capitalize">{String(value).replaceAll("_", " ")}</span> : "-";
  if (kind === "status") {
    const normalized = String(value || "Pending").toLowerCase();
    const style = ["sent", "delivered", "accepted", "success"].includes(normalized)
      ? "bg-[#e9f7ef] text-[#2f8758]"
      : ["failed", "rejected", "bounced", "error"].includes(normalized)
        ? "bg-[#fff0eb] text-[#c94c3a]"
        : "bg-[#fff4d8] text-[#9a6412]";
    return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${style}`}>{value || "Pending"}</span>;
  }
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

export default function AdminEmailDeliveryPage() {
  const { category = "logs" } = useParams();
  const config = configs[category] || configs.logs;
  const columns = useMemo(() => columnsFor(category), [category]);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const range = searchParams.get("range") || "today";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const [filters, setFilters] = useState({
    keyword: searchParams.get("keyword") || "", status: searchParams.get("status") || "",
    emailType: searchParams.get("emailType") || "", dateFrom: searchParams.get("dateFrom") || "", dateTo: searchParams.get("dateTo") || ""
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      setData(await fetchAdminEmailDelivery({ category, page, pageSize: 20, ...Object.fromEntries(searchParams.entries()) }));
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [category, searchParams.toString()]);

  function applyFilters(event) {
    event.preventDefault();
    const next = new URLSearchParams({ range });
    Object.entries(filters).forEach(([key, value]) => { if (value) next.set(key, value); });
    setSearchParams(next);
  }

  function goToPage(nextPage) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(nextPage));
    setSearchParams(next);
  }

  const pagination = data?.pagination || { page: 1, total: 0, totalPages: 1 };
  return (
    <main className="min-h-screen bg-[linear-gradient(90deg,#FDD9CD_0%,#fff8f5_15%,#fffaf8_58%,#FDD9CD_100%)] p-4 text-[#251E1F] sm:p-6">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <header className="rounded-xl border border-[#f0d2ca] bg-white/95 p-5 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F38978]/15 text-[#c55245]"><Mail size={20} /></span><div><p className="text-xs font-bold uppercase tracking-wide text-[#F38978]">Admin Email Monitoring</p><h1 className="mt-1 text-2xl font-bold">{config.title}</h1><p className="mt-1 text-sm text-[#7b6660]">Read-only invoicing email records. Times use Asia/Singapore.</p></div></div>
            <div className="flex gap-2"><button type="button" onClick={() => navigate(`${summaryPath}?range=${range}#email-delivery-summary`)} className="inline-flex items-center gap-2 rounded-lg border border-[#f0d2ca] bg-white px-4 py-2 text-sm font-bold hover:border-[#F38978]"><ArrowLeft size={16} /> Back</button><button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-[#f0d2ca] bg-white px-4 py-2 text-sm font-bold hover:border-[#F38978] disabled:opacity-60"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh</button></div>
          </div>
        </header>

        {category === "delivery-rate" ? <section className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-[#f0d2ca] bg-white p-4"><p className="text-xs font-bold text-[#7b6660]">Successful</p><p className="mt-1 text-2xl font-bold text-[#2f8758]">{data?.summary?.successfulToday || 0}</p></div><div className="rounded-xl border border-[#f0d2ca] bg-white p-4"><p className="text-xs font-bold text-[#7b6660]">Failed</p><p className="mt-1 text-2xl font-bold text-[#c94c3a]">{data?.summary?.failedToday || 0}</p></div><div className="rounded-xl border border-[#f0d2ca] bg-white p-4"><p className="text-xs font-bold text-[#7b6660]">Delivery Rate</p><p className="mt-1 text-2xl font-bold text-[#3269a8]">{data?.summary?.deliveryRate || 0}%</p></div></section> : null}

        {category === "logs" ? <form onSubmit={applyFilters} className="grid gap-3 rounded-xl border border-[#f0d2ca] bg-white/95 p-4 sm:grid-cols-2 xl:grid-cols-6"><input value={filters.keyword} onChange={(e) => setFilters({ ...filters, keyword: e.target.value })} placeholder="Invoice, customer or email" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm xl:col-span-2" /><select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm"><option value="">All statuses</option><option>Sent</option><option>Failed</option><option>Pending</option><option>Queued</option><option>Processing</option><option>Scheduled</option></select><input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" /><input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" /><button className="rounded-lg bg-[#F38978] px-4 py-2 text-sm font-bold text-white hover:bg-[#df7667]">Apply Filters</button></form> : null}
        {error ? <div className="rounded-xl border border-[#f3c6bc] bg-[#fff0eb] px-4 py-3 text-sm font-semibold text-[#c55245]">{error}</div> : null}
        <section className="overflow-hidden rounded-xl border border-[#f0d2ca] bg-white/95 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
          <div className="border-b border-[#f0d2ca] px-5 py-4 text-sm text-[#7b6660]">{loading ? "Loading…" : `${pagination.total} record${pagination.total === 1 ? "" : "s"}`}</div>
          {loading ? <div className="h-64 animate-pulse bg-white/70" /> : !data?.records?.length ? <div className="px-5 py-16 text-center text-sm text-[#7b6660]">{config.empty}</div> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="bg-[#fff8f5] text-xs uppercase tracking-wide text-[#7b6660]">{columns.map(([key, label]) => <th key={key} className="whitespace-nowrap px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-[#f4ded7]">{data.records.map((row) => <tr key={row.id} className="hover:bg-[#fff8f5]">{columns.map(([key, , kind]) => <td key={key} className="max-w-xs px-4 py-3 text-[#514440]"><Cell value={row[key]} kind={kind} /></td>)}</tr>)}</tbody></table></div>}
          <div className="flex items-center justify-between border-t border-[#f0d2ca] px-5 py-4"><p className="text-xs text-[#7b6660]">Page {pagination.page} of {pagination.totalPages}</p><div className="flex gap-2"><button disabled={pagination.page <= 1} onClick={() => goToPage(pagination.page - 1)} className="rounded-lg border border-[#ead3cc] p-2 disabled:opacity-40"><ChevronLeft size={16} /></button><button disabled={pagination.page >= pagination.totalPages} onClick={() => goToPage(pagination.page + 1)} className="rounded-lg border border-[#ead3cc] p-2 disabled:opacity-40"><ChevronRight size={16} /></button></div></div>
        </section>
      </div>
    </main>
  );
}
