import {
  Banknote,
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
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { fetchPaymentReminderSummary } from "../../services/adminDashboardService.js";
import { getStoredSession } from "../../services/sessionService.js";

const basePath = "/dashboard/invoicing/admin";
const invoiceListPath = `${basePath}/invoices`;
const paymentListPath = `${basePath}/payments`;
const reminderLogsPath = `${basePath}/reminder-settings`;
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

function Panel({ title, action, children, className = "" }) {
  return (
    <section className={`rounded-xl border border-[#f0d2ca] bg-white/95 p-5 shadow-[0_10px_28px_rgba(37,30,31,0.06)] ${className}`}>
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

function KpiCard({ title, value, note, icon: Icon, to, accent }) {
  return (
    <Link
      to={to}
      className="min-h-[142px] rounded-xl border border-[#f0d2ca] bg-white/95 p-4 shadow-[0_10px_28px_rgba(37,30,31,0.06)] transition hover:-translate-y-0.5 hover:border-[#F38978]"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${accent}1f`, color: accent }}
        >
          <Icon size={19} />
        </span>
        <ChevronRight size={15} className="text-[#c4aaa2]" />
      </div>
      <p className="mt-4 text-[13px] font-bold leading-tight text-[#251E1F]">{title}</p>
      <p className="mt-2 text-[1.55rem] font-bold leading-tight tracking-normal text-[#251E1F]">{value}</p>
      <p className="mt-2 text-xs font-semibold text-[#7b6660]">{note}</p>
    </Link>
  );
}

function MetricRow({ label, value, icon: Icon, to, accent }) {
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
      <span className="text-sm font-bold text-[#251E1F]">{formatCount(value)}</span>
      <ChevronRight size={14} className="text-[#b89a92]" />
    </Link>
  );
}

function ReminderSummaryCard({ summary }) {
  const scheduled = Number(summary.scheduled || 0);
  const sent = Number(summary.sent || 0);
  const successRate = scheduled > 0 ? (sent / scheduled) * 100 : 0;

  return (
    <Panel
      title="Reminder Summary"
      action={<Link to={reminderLogsPath} className="text-xs font-bold text-[#F38978]">View details</Link>}
    >
      {scheduled === 0 ? (
        <EmptyState>No reminders scheduled for this period.</EmptyState>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <MetricRow label="Scheduled" value={summary.scheduled} icon={CalendarDays} to={`${reminderLogsPath}?status=scheduled`} accent="#7FA7D8" />
        <MetricRow label="Sent" value={summary.sent} icon={Send} to={`${reminderLogsPath}?status=sent`} accent="#F38978" />
        <MetricRow label="Pending" value={summary.pending} icon={BellRing} to={`${reminderLogsPath}?status=pending`} accent="#D97706" />
        <MetricRow label="Failed" value={summary.failed} icon={XCircle} to={`${reminderLogsPath}?status=failed`} accent="#F38978" />
      </div>
      <Link to={`${reminderLogsPath}?metric=success-rate`} className="mt-4 block rounded-lg bg-[#fff8f5] p-4 transition hover:bg-[#fff0eb]">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-[#251E1F]">Success Rate</span>
          <span className="text-sm font-bold text-[#251E1F]">{successRate.toFixed(1)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-[#F38978]" style={{ width: `${Math.min(successRate, 100)}%` }} />
        </div>
      </Link>
    </Panel>
  );
}

function EmailDeliverySummaryCard({ summary }) {
  const hasAnyData = Number(summary.emailSent || 0) > 0 ||
    Number(summary.emailFailed || 0) > 0 ||
    Number(summary.whatsappSent || 0) > 0;

  return (
    <Panel
      title="Email Delivery Logs Summary"
      action={<Link to={`${reminderLogsPath}?type=delivery`} className="text-xs font-bold text-[#F38978]">View logs</Link>}
    >
      {!hasAnyData ? <EmptyState>No email delivery logs found.</EmptyState> : null}
      <div className="space-y-2">
        <MetricRow label="Email Sent" value={summary.emailSent} icon={Mail} to={`${reminderLogsPath}?channel=email&status=sent`} accent="#F38978" />
        <MetricRow label="Email Failed" value={summary.emailFailed} icon={XCircle} to={`${reminderLogsPath}?channel=email&status=failed`} accent="#F38978" />
        {summary.whatsappEnabled ? (
          <MetricRow label="WhatsApp Sent" value={summary.whatsappSent} icon={Send} to={`${reminderLogsPath}?channel=whatsapp&status=sent`} accent="#35A69B" />
        ) : null}
      </div>
    </Panel>
  );
}

function PaymentActionMenu({ payment }) {
  const pendingBankTransfer = normalizedStatus(payment.paymentMethod).includes("bank") &&
    normalizedStatus(payment.status).includes("pending");

  return (
    <details className="relative">
      <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg border border-[#ead3cc] bg-white text-[#514440] transition hover:border-[#F38978] hover:text-[#F38978]">
        <MoreHorizontal size={16} />
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-52 rounded-lg border border-[#ead3cc] bg-white p-2 text-sm shadow-xl shadow-[#251E1F]/10">
        <Link className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-[#fff8f5]" to={`${paymentListPath}/${payment.id || payment.reference}`}>
          <CreditCard size={15} /> View Payment
        </Link>
        <Link className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-[#fff8f5]" to={payment.invoiceId ? `${invoiceListPath}/${payment.invoiceId}` : `${invoiceListPath}?keyword=${encodeURIComponent(payment.invoiceNo || payment.reference || "")}`}>
          <FileText size={15} /> View Invoice
        </Link>
        {pendingBankTransfer ? (
          <Link className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-[#fff8f5]" to={`${paymentListPath}/${payment.id || payment.reference}/verify`}>
            <ShieldCheck size={15} /> Verify Payment
          </Link>
        ) : null}
        <Link className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-[#fff8f5]" to={`${basePath}/audit-logs?activityType=Payment&keyword=${encodeURIComponent(payment.reference || payment.id || "")}`}>
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
                <Link to={`${paymentListPath}/${payment.id || payment.reference}`}>{payment.reference || "-"}</Link>
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

  const paymentCards = summary?.paymentCards || {};
  const reminderSummary = summary?.reminderSummary || {};
  const emailDeliverySummary = summary?.emailDeliverySummary || {};
  const recentPaymentUpdates = summary?.recentPaymentUpdates || [];
  const hasAnyData = Number(paymentCards.paidTodayAmount || 0) > 0 ||
    Number(paymentCards.outstandingAmount || 0) > 0 ||
    Number(paymentCards.stripeUpdatesToday || 0) > 0 ||
    Number(paymentCards.bankTransferPendingCount || 0) > 0 ||
    Number(reminderSummary.scheduled || 0) > 0 ||
    Number(emailDeliverySummary.emailSent || 0) > 0 ||
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

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="Paid Today"
            value={formatCurrency(paymentCards.paidTodayAmount)}
            note="Successful payments received"
            icon={Banknote}
            to={`${paymentListPath}?status=paid&date=${range}`}
            accent="#F38978"
          />
          <KpiCard
            title="Outstanding Amount"
            value={formatCurrency(paymentCards.outstandingAmount)}
            note="Sent, viewed, and overdue invoices"
            icon={FileText}
            to={`${invoiceListPath}?filter=outstanding`}
            accent="#D97706"
          />
          <KpiCard
            title="Stripe Updates Today"
            value={formatCount(paymentCards.stripeUpdatesToday)}
            note={Number(paymentCards.stripeUpdatesToday || 0) > 0 ? "Stripe payment updates" : "No Stripe updates today"}
            icon={CreditCard}
            to={`${paymentListPath}?method=stripe&date=${range}`}
            accent="#4F8FD8"
          />
          <KpiCard
            title="Bank Transfer Pending"
            value={Number(paymentCards.bankTransferPendingAmount || 0) > 0 ? formatCurrency(paymentCards.bankTransferPendingAmount) : formatCount(paymentCards.bankTransferPendingCount)}
            note={`${formatCount(paymentCards.bankTransferPendingCount)} waiting for verification`}
            icon={ShieldCheck}
            to={`${paymentListPath}?payment_method=bank_transfer&status=pending-verification`}
            accent="#F38978"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <ReminderSummaryCard summary={reminderSummary} />
          <EmailDeliverySummaryCard summary={emailDeliverySummary} />
        </div>

        <Panel
          title="Recent Payment Updates"
          action={<Link to={paymentListPath} className="text-xs font-bold text-[#F38978]">View all</Link>}
        >
          <RecentPaymentUpdatesTable payments={recentPaymentUpdates} />
        </Panel>
      </div>
    </section>
  );
}
