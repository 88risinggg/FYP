import { ArrowLeft, BellRing, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { fetchPaymentReminderSummary } from "../../services/adminDashboardService.js";

const summaryPath = "/dashboard/invoicing/admin/dashboard/payment-reminder-summary";
const categoryConfig = {
  "sent-today": {
    key: "sentToday",
    title: "Reminders Sent Today",
    empty: "No reminder emails were successfully sent today.",
    columns: [
      ["invoiceNumber", "Invoice Number"], ["customerName", "Customer Name"],
      ["customerEmail", "Customer Email"], ["reminderType", "Reminder Type", "type"],
      ["reminderSequence", "Reminder Sequence"], ["dueDate", "Invoice Due Date", "date"],
      ["sentAt", "Reminder Sent", "datetime"], ["deliveryStatus", "Delivery Status", "status"]
    ]
  },
  "scheduled-today": {
    key: "scheduledToday",
    title: "Reminders Scheduled Today",
    empty: "No reminders are scheduled for today.",
    columns: [
      ["invoiceNumber", "Invoice Number"], ["customerName", "Customer Name"],
      ["scheduledAt", "Scheduled Date and Time", "scheduled"], ["reminderType", "Reminder Type", "type"],
      ["currentReminderStatus", "Current Reminder Status", "status"], ["dueDate", "Invoice Due Date", "date"],
      ["outstandingBalance", "Outstanding Balance", "currency"], ["deliveryStatus", "Delivery Status", "status"]
    ]
  },
  "failed-today": {
    key: "failedToday",
    title: "Failed Reminders",
    empty: "No reminder email attempts failed today.",
    columns: [
      ["invoiceNumber", "Invoice Number"], ["customerName", "Customer Name"],
      ["customerEmail", "Customer Email"], ["reminderType", "Reminder Type", "type"],
      ["attemptedAt", "Attempted Send Time", "datetime"], ["failureReason", "Failure Reason"],
      ["retryCount", "Retry Count", "count"], ["invoiceStatus", "Current Invoice Status", "status"]
    ]
  },
  "overdue-requiring-reminders": {
    key: "overdueRequiringReminders",
    title: "Overdue Invoices Requiring Reminders",
    empty: "No overdue invoices currently require another reminder.",
    columns: [
      ["invoiceNumber", "Invoice Number"], ["customerName", "Customer Name"],
      ["customerEmail", "Customer Email"], ["invoiceTotal", "Invoice Total", "currency"],
      ["outstandingBalance", "Outstanding Balance", "currency"], ["dueDate", "Due Date", "date"],
      ["daysOverdue", "Days Overdue", "count"], ["lastReminderSent", "Last Reminder Sent", "datetime"],
      ["nextReminderDue", "Next Reminder Due", "date"], ["reminderCount", "Reminder Count", "count"],
      ["invoiceStatus", "Current Invoice Status", "status"]
    ]
  }
};

function formatDate(value, includeTime = false) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-SG", {
    day: "numeric", month: "short", year: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
    timeZone: "Asia/Singapore"
  }).format(date);
}

function formatValue(value, kind) {
  if (kind === "currency") {
    return new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(Number(value || 0));
  }
  if (kind === "date") return formatDate(value);
  if (kind === "datetime") return formatDate(value, true);
  if (kind === "scheduled") return value ? formatDate(value, true) : "Today — automatic reminder run";
  if (kind === "count") return new Intl.NumberFormat("en-SG").format(Number(value || 0));
  return value ?? "-";
}

function CellValue({ value, kind }) {
  if (kind === "status") {
    const normalized = String(value || "Pending").toLowerCase();
    const style = normalized === "sent" || normalized === "paid"
      ? "bg-[#e9f7ef] text-[#2f8758]"
      : normalized === "failed"
        ? "bg-[#fff0eb] text-[#c94c3a]"
        : "bg-[#fff4d8] text-[#9a6412]";
    return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${style}`}>{value || "Pending"}</span>;
  }
  if (kind === "type") return <span className="font-semibold capitalize">{String(value || "Payment Reminder").replaceAll("_", " ")}</span>;
  return formatValue(value, kind);
}

export default function AdminReminderCategoryPage() {
  const { category } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const range = searchParams.get("range") || "today";
  const config = categoryConfig[category] || categoryConfig["sent-today"];
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await fetchPaymentReminderSummary(range));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [category, range]);
  const rows = useMemo(() => data?.reminderSummary?.details?.[config.key] || [], [config.key, data]);

  return (
    <main className="min-h-screen bg-[linear-gradient(90deg,#FDD9CD_0%,#fff8f5_15%,#fffaf8_58%,#FDD9CD_100%)] p-4 text-[#251E1F] sm:p-6">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <header className="rounded-xl border border-[#f0d2ca] bg-white/95 p-5 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F38978]/15 text-[#c55245]"><BellRing size={20} /></span>
              <div><p className="text-xs font-bold uppercase tracking-wide text-[#F38978]">Admin Reminder Monitoring</p><h1 className="mt-1 text-2xl font-bold">{config.title}</h1><p className="mt-1 text-sm text-[#7b6660]">Read-only reminder records using Asia/Singapore dates.</p></div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => navigate(`${summaryPath}?range=${range}#reminder-summary`)} className="inline-flex items-center gap-2 rounded-lg border border-[#f0d2ca] bg-white px-4 py-2 text-sm font-bold hover:border-[#F38978]"><ArrowLeft size={16} /> Back</button>
              <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-[#f0d2ca] bg-white px-4 py-2 text-sm font-bold hover:border-[#F38978] disabled:opacity-60"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh</button>
            </div>
          </div>
        </header>

        {error ? <div className="rounded-xl border border-[#f3c6bc] bg-[#fff0eb] px-4 py-3 text-sm font-semibold text-[#c55245]">{error}</div> : null}
        <section className="overflow-hidden rounded-xl border border-[#f0d2ca] bg-white/95 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
          <div className="border-b border-[#f0d2ca] px-5 py-4"><p className="text-sm text-[#7b6660]">{loading ? "Loading…" : `${rows.length} record${rows.length === 1 ? "" : "s"}`}</p></div>
          {loading ? <div className="h-64 animate-pulse bg-white/70" /> : rows.length === 0 ? (
            <div className="px-5 py-16 text-center text-sm text-[#7b6660]">{config.empty}</div>
          ) : (
            <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="bg-[#fff8f5] text-xs uppercase tracking-wide text-[#7b6660]">{config.columns.map(([key, label]) => <th key={key} className="whitespace-nowrap px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-[#f4ded7]">{rows.map((row) => <tr key={row.id} className="hover:bg-[#fff8f5]">{config.columns.map(([key, , kind]) => <td key={key} className="max-w-xs px-4 py-3 text-[#514440]"><CellValue value={row[key]} kind={kind} /></td>)}</tr>)}</tbody></table></div>
          )}
        </section>
      </div>
    </main>
  );
}
