import {
  BellRing,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Eye,
  FileText,
  Mail,
  MoreHorizontal,
  RefreshCw,
  Send,
  ShieldCheck,
  XCircle
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { fetchPaymentReminderSummary } from "../../services/adminDashboardService.js";
import { getStoredSession } from "../../services/sessionService.js";

const basePath = "/dashboard/invoicing/admin";
const rangeOptions = [
  { value: "today", label: "Today" },
  { value: "last-7-days", label: "Last 7 Days" },
  { value: "last-30-days", label: "Last 30 Days" },
  { value: "this-month", label: "This Month" },
  { value: "this-quarter", label: "This Quarter" },
  { value: "this-year", label: "This Year" }
];

function formatCount(value) {
  return new Intl.NumberFormat("en-SG").format(Number(value || 0));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD"
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-SG", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Singapore"
  }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-SG", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Singapore"
  }).format(new Date(value));
}

function normalizedStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function paymentStatusClass(status) {
  const value = normalizedStatus(status);

  if (["paid", "completed", "success", "successful", "verified"].includes(value)) {
    return "bg-[#e9f7ef] text-[#2f8758]";
  }

  if (value === "failed") {
    return "bg-[#fff0eb] text-[#c94c3a]";
  }

  if (value.includes("pending")) {
    return "bg-[#fff4d8] text-[#9a6412]";
  }

  return "bg-[#f2eee9] text-[#6f5b55]";
}

function paymentMethodClass(method) {
  const value = normalizedStatus(method);

  if (value.includes("stripe")) return "bg-[#eaf2ff] text-[#3269a8]";
  if (value.includes("bank")) return "bg-[#e7f7f5] text-[#218178]";
  return "bg-[#f2eee9] text-[#6f5b55]";
}

function Panel({ title, action, children, className = "", id }) {
  return (
    <section id={id} className={`rounded-xl border border-[#f0d2ca] bg-white/95 p-5 shadow-[0_10px_28px_rgba(37,30,31,0.06)] ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 className="text-[15px] font-bold text-[#251E1F]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ children }) {
  return (
    <div className="rounded-xl border border-dashed border-[#f0c9bf] bg-[#fff8f5] px-5 py-8 text-center text-sm text-[#7b6660]">
      {children}
    </div>
  );
}

function MetricRow({ label, value, icon: Icon, to, accent, formatValue = formatCount }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg bg-[#fff8f5] px-3 py-3 transition hover:bg-[#fff0eb]"
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${accent}1f`, color: accent }}
      >
        <Icon size={15} />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#251E1F]">{label}</span>
      <span className="text-sm font-bold text-[#251E1F]">{formatValue(value)}</span>
      <ChevronRight size={14} className="text-[#b89a92]" />
    </Link>
  );
}

function ReminderSummaryCard({ summary, range }) {
  const detailPath = (category) => `${basePath}/reminder-summary/${category}?range=${range}`;
  const hasAnyData = Number(summary.sentToday || 0) > 0 ||
    Number(summary.scheduledToday || 0) > 0 ||
    Number(summary.failedToday || 0) > 0 ||
    Number(summary.overdueRequiringReminders || 0) > 0;

  return (
    <Panel
      id="reminder-summary"
      title="Reminder Summary"
    >
      {!hasAnyData ? <EmptyState>No reminder activity requires attention today.</EmptyState> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <MetricRow label="Reminders Sent Today" value={summary.sentToday} icon={Send} to={detailPath("sent-today")} accent="#4F8FD8" />
        <MetricRow label="Reminders Scheduled Today" value={summary.scheduledToday} icon={CalendarDays} to={detailPath("scheduled-today")} accent="#4F8FD8" />
        <MetricRow label="Failed Reminders" value={summary.failedToday} icon={XCircle} to={detailPath("failed-today")} accent="#C94C3A" />
        <MetricRow label="Overdue Invoices Requiring Reminders" value={summary.overdueRequiringReminders} icon={BellRing} to={detailPath("overdue-requiring-reminders")} accent="#D97706" />
      </div>
      <p className="mt-4 text-xs text-[#7b6660]">Monitoring only. Finance remains responsible for reminder follow-up and operational actions.</p>
    </Panel>
  );
}

function EmailDeliverySummaryCard({ summary, range }) {
  const detailPath = (category) => `${basePath}/email-delivery/${category}?range=${range}`;

  return (
    <Panel
      id="email-delivery-summary"
      title="Email Delivery Summary"
      action={<Link to={detailPath("logs")} className="rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-xs font-bold text-[#F38978] transition hover:border-[#F38978]">View Delivery Logs</Link>}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <MetricRow label="Successfully Delivered Today" value={summary.successfulToday} icon={CheckCircle2} to={detailPath("successful-today")} accent="#2F8758" />
        <MetricRow label="Failed Today" value={summary.failedToday} icon={XCircle} to={detailPath("failed-today")} accent="#C94C3A" />
        <MetricRow label="Pending Delivery" value={summary.pendingDelivery} icon={Mail} to={detailPath("pending-delivery")} accent="#D97706" />
        <MetricRow label="Delivery Rate" value={summary.deliveryRate} icon={ShieldCheck} to={detailPath("delivery-rate")} accent="#4F8FD8" formatValue={(value) => `${Number(value || 0).toFixed(Number(value || 0) % 1 ? 1 : 0)}%`} />
      </div>
      <p className="mt-4 text-xs text-[#7b6660]">Monitoring only. Successful means accepted by the configured email provider; pending deliveries are excluded from the delivery rate.</p>
    </Panel>
  );
}

function PaymentActionMenu({ payment }) {
  return (
    <details className="relative">
      <summary aria-label={`Actions for payment ${payment.reference || payment.id}`} title="Payment actions" className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg border border-[#ead3cc] bg-white text-[#514440] transition hover:border-[#F38978] hover:text-[#F38978]">
        <MoreHorizontal size={16} />
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-52 rounded-lg border border-[#ead3cc] bg-white p-2 text-sm shadow-xl shadow-[#251E1F]/10">
        <Link className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-[#fff8f5]" to={`${basePath}/payment-updates/${encodeURIComponent(payment.id || payment.reference)}?from=payment-updates`}>
          <CreditCard size={15} /> View Payment
        </Link>
        {payment.invoiceId ? (
          <Link className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-[#fff8f5]" to={`${basePath}/invoice-records/${payment.invoiceId}?from=payment-updates`}>
            <FileText size={15} /> View Invoice
          </Link>
        ) : <span className="flex cursor-not-allowed items-center gap-2 rounded-md px-3 py-2 text-[#9c7b72]" title="No related invoice is available"><FileText size={15} /> Invoice unavailable</span>}
        <Link className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-[#fff8f5]" to={`${basePath}/audit-trail?keyword=${encodeURIComponent(payment.reference || payment.id || "")}&from=payment-updates`}>
          <Eye size={15} /> View Audit Log
        </Link>
      </div>
    </details>
  );
}

function RecentPaymentUpdatesTable({ payments }) {
  if (!payments.length) {
    return <EmptyState>No payment updates found for this period.</EmptyState>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-y border-[#f0d2ca] bg-[#fff8f5] text-xs uppercase text-[#7b6660]">
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Reference</th>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Payment Method</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Amount</th>
            <th className="px-4 py-3">Updated By</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id || payment.reference} className="border-b border-[#f4ded7] transition hover:bg-[#fff8f5]">
              <td className="whitespace-nowrap px-4 py-3 text-[#514440]">{formatDateTime(payment.date)}</td>
              <td className="whitespace-nowrap px-4 py-3 font-bold text-[#251E1F]">
                <Link to={`${basePath}/payment-updates/${encodeURIComponent(payment.id || payment.reference)}?from=payment-updates`}>{payment.reference || "-"}</Link>
              </td>
              <td className="px-4 py-3 text-[#514440]">
                {payment.customerId ? (
                  <Link to={`${basePath}/customers/${payment.customerId}`}>{payment.customerName || "-"}</Link>
                ) : payment.customerName || "-"}
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${paymentMethodClass(payment.paymentMethod)}`}>
                  {payment.paymentMethod || "-"}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${paymentStatusClass(payment.status)}`}>
                  {payment.status || "-"}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#251E1F]">{formatCurrency(payment.amount)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-[#514440]">{payment.updatedBy || "System"}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end">
                  <PaymentActionMenu payment={payment} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <section className="-m-4 min-h-[calc(100vh-5rem)] p-4 text-[#251E1F] sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-[1600px] space-y-4">
        {[90, 160, 260, 360].map((height) => (
          <div key={height} className="animate-pulse rounded-xl border border-[#f0d2ca] bg-white/70" style={{ height }} />
        ))}
      </div>
    </section>
  );
}

export default function AdminPaymentReminderSummaryPage() {
  const session = getStoredSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRange = rangeOptions.some((option) => option.value === searchParams.get("range"))
    ? searchParams.get("range")
    : "today";
  const [range, setRange] = useState(initialRange);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const now = useMemo(() => new Date(), []);

  async function loadSummary(nextRange = range, isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const data = await fetchPaymentReminderSummary(nextRange);
      setSummary(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadSummary(initialRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleRangeChange(nextRange) {
    setRange(nextRange);
    setSearchParams({ range: nextRange });
    loadSummary(nextRange, true);
  }

  const reminderSummary = summary?.reminderSummary || {};
  const emailDeliverySummary = summary?.emailDeliverySummary || {};
  const recentPaymentUpdates = (summary?.recentPaymentUpdates || []).slice(0, 5);
  const hasAnyData = Number(reminderSummary.scheduledToday || 0) > 0 ||
    Number(reminderSummary.sentToday || 0) > 0 ||
    Number(reminderSummary.failedToday || 0) > 0 ||
    Number(reminderSummary.overdueRequiringReminders || 0) > 0 ||
    Number(emailDeliverySummary.successfulToday || 0) > 0 ||
    Number(emailDeliverySummary.failedToday || 0) > 0 ||
    Number(emailDeliverySummary.pendingDelivery || 0) > 0 ||
    recentPaymentUpdates.length > 0;

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <section
      className="-m-4 min-h-[calc(100vh-5rem)] p-4 text-[#251E1F] sm:-m-6 sm:p-6"
      style={{
        backgroundImage:
          "linear-gradient(90deg, #FDD9CD 0%, #fff8f5 15%, #fffaf8 58%, #FDD9CD 100%)"
      }}
    >
      <div className="mx-auto max-w-[1600px] space-y-4">
        <div className="flex flex-col gap-4 border-b border-[#f0d2ca] bg-white/40 pb-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-normal text-[#251E1F]">Payment & Reminder Summary</h2>
            <p className="mt-1 text-sm text-[#6f5b55]">
              Overview of payments received and reminder communication performance.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3 rounded-lg border border-[#f0d2ca] bg-white px-3 py-2">
              <CalendarDays size={17} className="text-[#F38978]" />
              <div>
                <p className="text-xs font-bold text-[#251E1F]">{formatDate(now)}</p>
                <p className="text-[11px] text-[#7b6660]">Current date</p>
              </div>
            </div>
            <div className="rounded-lg border border-[#f0d2ca] bg-white px-3 py-2">
              <p className="text-xs font-bold text-[#251E1F]">{formatDateTime(session?.user?.lastLoginAt)}</p>
              <p className="text-[11px] text-[#7b6660]">Last login</p>
            </div>
            <select
              value={range}
              onChange={(event) => handleRangeChange(event.target.value)}
              className="rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm font-semibold text-[#251E1F] outline-none transition focus:border-[#F38978]"
            >
              {rangeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => loadSummary(range, true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm font-bold text-[#251E1F] transition hover:border-[#F38978] hover:text-[#F38978]"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <div className="flex flex-col gap-3 rounded-xl border border-[#F38978]/30 bg-white px-4 py-3 text-sm font-semibold text-[#b64d3b] sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => loadSummary(range, true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#f0d2ca] bg-[#fff8f5] px-3 py-2 text-[#251E1F] hover:bg-white"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Retry
            </button>
          </div>
        ) : null}

        {!hasAnyData && !error ? <EmptyState>No payment or reminder summary data found for this period.</EmptyState> : null}

        <div className="grid gap-4 xl:grid-cols-2">
          <ReminderSummaryCard summary={reminderSummary} range={range} />
          <EmailDeliverySummaryCard summary={emailDeliverySummary} range={range} />
        </div>

        <Panel
          id="recent-payment-updates"
          title="Recent Payment Updates"
          action={<Link to={`${basePath}/payment-updates?range=${range}`} className="text-xs font-bold text-[#F38978]">View All</Link>}
        >
          <p className="mb-3 text-xs text-[#7b6660]">Latest 5 payment updates, newest first.</p>
          <RecentPaymentUpdatesTable payments={recentPaymentUpdates} />
        </Panel>
      </div>
    </section>
  );
}
