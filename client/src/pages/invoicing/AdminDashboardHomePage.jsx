import {
  AlertTriangle,
  Banknote,
  BarChart3,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  Download,
  Eye,
  FileCheck2,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Settings,
  UserPlus,
  XCircle
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { fetchAdminInvoicingDashboard } from "../../services/adminDashboardService.js";
import { getStoredSession } from "../../services/sessionService.js";

const basePath = "/dashboard/invoicing/admin";
const invoiceListPath = `${basePath}/invoices`;
const emptyInvoiceMessage =
  "No invoice data yet. Invoice summaries will appear here once Finance creates invoices.";

const statusStyles = {
  Draft: "bg-[#f2eee9] text-[#6f5b55]",
  Sent: "bg-[#eaf2ff] text-[#3269a8]",
  Viewed: "bg-[#e7f7f5] text-[#218178]",
  Paid: "bg-[#e9f7ef] text-[#2f8758]",
  Overdue: "bg-[#fff0eb] text-[#c94c3a]"
};

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
  if (!value) return "First login";

  return new Intl.DateTimeFormat("en-SG", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Singapore"
  }).format(new Date(value));
}

function formatWeekday(value) {
  return new Intl.DateTimeFormat("en-SG", {
    weekday: "long",
    timeZone: "Asia/Singapore"
  }).format(value);
}

function formatClock(value) {
  return new Intl.DateTimeFormat("en-SG", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Singapore"
  }).format(value);
}

function getGreeting(date) {
  const hour = Number(
    new Intl.DateTimeFormat("en-SG", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Singapore"
    }).format(date)
  );

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function daysLeftLabel(daysLeft) {
  const days = Number(daysLeft || 0);

  if (days <= 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
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

function EmptyState({ compact = false }) {
  return (
    <div className={`rounded-xl border border-dashed border-[#f0c9bf] bg-[#fff8f5] text-center text-sm text-[#7b6660] ${compact ? "px-4 py-5" : "px-5 py-8"}`}>
      {emptyInvoiceMessage}
    </div>
  );
}

function KpiCard({ title, value, note, icon: Icon, to, accent }) {
  return (
    <Link
      to={to}
      className="min-h-[126px] rounded-xl border border-[#f0d2ca] bg-white/95 p-4 shadow-[0_10px_28px_rgba(37,30,31,0.06)] transition hover:-translate-y-0.5 hover:border-[#F38978]"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${accent}1f`, color: accent }}
        >
          <Icon size={18} />
        </span>
        <ChevronRight size={15} className="text-[#c4aaa2]" />
      </div>
      <p className="mt-4 min-h-9 text-[13px] font-bold leading-tight text-[#251E1F]">{title}</p>
      <p className="mt-2 text-[1.55rem] font-bold leading-tight tracking-normal text-[#251E1F]">{value}</p>
      <p className="mt-2 text-[11px] font-semibold text-[#7b6660]">{note}</p>
    </Link>
  );
}

function FocusRow({ icon: Icon, label, count, to, accent }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg bg-[#fff8f5] px-3 py-3 transition hover:bg-[#fff0eb]"
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${accent}1f`, color: accent }}
      >
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#251E1F]">{label}</span>
      <span className="text-sm font-bold text-[#251E1F]">{formatCount(count)}</span>
      <ChevronRight size={15} className="text-[#b89a92]" />
    </Link>
  );
}

function QuickAction({ icon: Icon, label, to }) {
  return (
    <Link
      to={to}
      className="flex min-h-[58px] items-center gap-3 rounded-lg border border-[#ead3cc] bg-[#fff8f5] px-3 py-3 text-sm font-bold text-[#251E1F] transition hover:border-[#F38978] hover:bg-white hover:text-[#F38978]"
    >
      <Icon size={17} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ChevronRight size={15} />
    </Link>
  );
}

function StatusBadge({ status }) {
  const normalized = statusStyles[status] ? status : "Draft";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusStyles[normalized]}`}>
      {normalized}
    </span>
  );
}

function InvoiceActionMenu({ invoice }) {
  const status = invoice.status;

  return (
    <details className="relative">
      <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg border border-[#ead3cc] bg-white text-[#514440] transition hover:border-[#F38978] hover:text-[#F38978]">
        <MoreHorizontal size={16} />
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-[#ead3cc] bg-white p-2 text-sm shadow-xl shadow-[#251E1F]/10">
        <Link className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-[#fff8f5]" to={`${invoiceListPath}/${invoice.id}`}>
          <Eye size={15} /> View Invoice
        </Link>
        {status === "Draft" ? (
          <Link className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-[#fff8f5]" to={`${invoiceListPath}/${invoice.id}/edit`}>
            <Pencil size={15} /> Edit Invoice
          </Link>
        ) : null}
        {status === "Draft" || status === "Sent" ? (
          <Link className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-[#fff8f5]" to={`${invoiceListPath}/${invoice.id}/send`}>
            <Send size={15} /> Send Invoice
          </Link>
        ) : null}
        {["Sent", "Viewed", "Overdue"].includes(status) ? (
          <>
            <Link className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-[#fff8f5]" to={`${basePath}/reminder-settings?invoiceId=${invoice.id}`}>
              <BellRing size={15} /> Send Reminder
            </Link>
            <Link className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-[#fff8f5]" to={`${basePath}/payments/record?invoiceId=${invoice.id}`}>
              <CreditCard size={15} /> Record Payment
            </Link>
          </>
        ) : null}
        <button
          type="button"
          disabled
          title="PDF download is coming soon."
          className="flex w-full cursor-not-allowed items-center gap-2 rounded-md px-3 py-2 text-left text-[#9b837c]"
        >
          <Download size={15} /> Download PDF
        </button>
      </div>
    </details>
  );
}

function UpcomingDueInvoicesTable({ invoices }) {
  if (!invoices.length) {
    return <EmptyState compact />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-y border-[#f0d2ca] bg-[#fff8f5] text-xs uppercase text-[#7b6660]">
            <th className="px-3 py-3">Invoice #</th>
            <th className="px-3 py-3">Customer</th>
            <th className="px-3 py-3">Due Date</th>
            <th className="px-3 py-3">Amount</th>
            <th className="px-3 py-3">Days Left</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="border-b border-[#f4ded7] transition hover:bg-[#fff8f5]">
              <td className="px-3 py-3 font-bold text-[#251E1F]">
                <Link to={`${invoiceListPath}/${invoice.id}`}>{invoice.invoiceNo || "-"}</Link>
              </td>
              <td className="px-3 py-3 text-[#514440]">{invoice.customerName || "-"}</td>
              <td className="px-3 py-3 text-[#514440]">{formatDate(invoice.dueDate)}</td>
              <td className="px-3 py-3 font-semibold text-[#251E1F]">{formatCurrency(invoice.amount)}</td>
              <td className="px-3 py-3">
                <span className="rounded-full bg-[#fff0eb] px-2.5 py-1 text-xs font-bold text-[#c94c3a]">
                  {daysLeftLabel(invoice.daysLeft)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentInvoicesTable({ invoices }) {
  if (!invoices.length) {
    return <EmptyState />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-y border-[#f0d2ca] bg-[#fff8f5] text-xs uppercase text-[#7b6660]">
            <th className="px-4 py-3">Invoice #</th>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Issue Date</th>
            <th className="px-4 py-3">Due Date</th>
            <th className="px-4 py-3">Amount</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="border-b border-[#f4ded7] transition hover:bg-[#fff8f5]">
              <td className="px-4 py-3 font-bold text-[#251E1F]">
                <Link to={`${invoiceListPath}/${invoice.id}`}>{invoice.invoiceNo || "-"}</Link>
              </td>
              <td className="px-4 py-3 text-[#514440]">{invoice.customerName || "-"}</td>
              <td className="px-4 py-3"><StatusBadge status={invoice.status} /></td>
              <td className="px-4 py-3 text-[#514440]">{formatDate(invoice.issueDate)}</td>
              <td className="px-4 py-3 text-[#514440]">{formatDate(invoice.dueDate)}</td>
              <td className="px-4 py-3 font-semibold text-[#251E1F]">{formatCurrency(invoice.amount)}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end">
                  <InvoiceActionMenu invoice={invoice} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminDashboardHomePage() {
  const session = getStoredSession();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(new Date());
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);

  async function loadDashboard(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const data = await fetchAdminInvoicingDashboard();
      setDashboard(data);
      setLastRefreshedAt(new Date());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const admin = dashboard?.admin || session?.user || {};
  const adminName = admin.name || session?.user?.name || "Admin";
  const summary = dashboard?.summary || {};
  const todayFocus = dashboard?.todayFocus || {};
  const upcomingDueInvoices = dashboard?.upcomingDueInvoices || [];
  const recentInvoices = dashboard?.recentInvoices || [];
  const hasInvoiceData = Number(summary.totalInvoices || 0) > 0;

  const kpiCards = useMemo(() => [
    {
      title: "Total Invoices",
      value: formatCount(summary.totalInvoices),
      note: "All invoice records",
      icon: FileText,
      to: invoiceListPath,
      accent: "#F38978"
    },
    {
      title: "Draft",
      value: formatCount(summary.draft),
      note: "Not sent yet",
      icon: FileCheck2,
      to: `${invoiceListPath}?status=draft`,
      accent: "#7FA7D8"
    },
    {
      title: "Sent",
      value: formatCount(summary.sent),
      note: "Sent to customers",
      icon: Send,
      to: `${invoiceListPath}?status=sent`,
      accent: "#4F8FD8"
    },
    {
      title: "Viewed",
      value: formatCount(summary.viewed),
      note: "Viewed by customers",
      icon: Eye,
      to: `${invoiceListPath}?status=viewed`,
      accent: "#35A69B"
    },
    {
      title: "Paid",
      value: formatCount(summary.paid),
      note: "Fully paid",
      icon: CheckCircle2,
      to: `${invoiceListPath}?status=paid`,
      accent: "#4FB783"
    },
    {
      title: "Overdue",
      value: formatCount(summary.overdue),
      note: "Past due date",
      icon: XCircle,
      to: `${invoiceListPath}?status=overdue`,
      accent: "#F38978"
    },
    {
      title: "Total Revenue",
      value: formatCurrency(summary.totalRevenue),
      note: "Paid invoices",
      icon: Banknote,
      to: `${basePath}/reports?metric=revenue`,
      accent: "#B5833B"
    },
    {
      title: "Outstanding Amount",
      value: formatCurrency(summary.outstandingAmount),
      note: "Sent, viewed, overdue",
      icon: AlertTriangle,
      to: `${invoiceListPath}?filter=outstanding`,
      accent: "#D97706"
    }
  ], [summary]);

  if (loading) {
    return (
      <section className="-m-4 min-h-[calc(100vh-5rem)] p-6 text-[#251E1F] sm:-m-6">
        <div className="rounded-xl border border-[#f0d2ca] bg-white/90 p-8 text-center shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
          Loading dashboard overview...
        </div>
      </section>
    );
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
        <div className="flex flex-col gap-4 border-b border-[#f0d2ca] bg-white/40 pb-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-normal text-[#251E1F]">
              {getGreeting(now)}, {adminName}
            </h2>
            <p className="mt-1 text-sm text-[#6f5b55]">
              Here's what's happening with your invoicing today.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 border-[#f0c9bf] sm:border-l sm:pl-8">
              <CalendarDays size={22} className="text-[#251E1F]" />
              <div>
                <p className="text-sm font-bold text-[#251E1F]">{formatDate(now)}</p>
                <p className="mt-1 text-sm text-[#6f5b55]">{formatWeekday(now)} | {formatClock(now)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 border-[#f0c9bf] sm:border-l sm:pl-8">
              <Clock3 size={22} className="text-[#251E1F]" />
              <div>
                <p className="text-sm font-bold text-[#251E1F]">Last login</p>
                <p className="mt-1 text-sm text-[#6f5b55]">
                  {formatDateTime(admin.lastLoginAt || session?.user?.lastLoginAt)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-[#F38978]/30 bg-white px-4 py-3 text-sm font-semibold text-[#b64d3b]">
            {error}
          </div>
        ) : null}

        {!hasInvoiceData ? <EmptyState /> : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
          {kpiCards.map((card) => (
            <KpiCard key={card.title} {...card} />
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.55fr_0.85fr]">
          <Panel title="Today's Focus">
            <div className="space-y-2">
              <FocusRow icon={AlertTriangle} label="Overdue Invoices" count={todayFocus.overdueInvoices} to={`${invoiceListPath}?status=overdue`} accent="#F38978" />
              <FocusRow icon={BellRing} label="Reminder Failed" count={todayFocus.reminderFailed} to={`${basePath}/reminder-settings?filter=failed`} accent="#D97706" />
              <FocusRow icon={FileCheck2} label="Draft Invoices Not Sent" count={todayFocus.draftInvoicesNotSent} to={`${invoiceListPath}?status=draft`} accent="#7FA7D8" />
              <FocusRow icon={CreditCard} label="Payments to Verify" count={todayFocus.paymentsToVerify} to={`${basePath}/payments?status=pending-verification`} accent="#35A69B" />
              <FocusRow icon={XCircle} label="Validation Errors" count={todayFocus.validationErrors} to={`${basePath}/dashboard/validation-summary`} accent="#F38978" />
            </div>
          </Panel>

          <Panel
            title="Upcoming Due Invoices"
            action={<Link to={`${invoiceListPath}?filter=upcoming-due`} className="text-xs font-bold text-[#F38978]">View all</Link>}
          >
            <UpcomingDueInvoicesTable invoices={upcomingDueInvoices} />
          </Panel>

          <Panel title="Quick Actions" className="xl:row-span-2">
            <div className="space-y-3">
              <QuickAction icon={Plus} label="Create Invoice" to={`${invoiceListPath}/create`} />
              <QuickAction icon={Send} label="Send Reminder" to={`${basePath}/reminder-settings`} />
              <QuickAction icon={UserPlus} label="New Customer" to={`${basePath}/customers/create`} />
              <QuickAction icon={CreditCard} label="Record Payment" to={`${basePath}/payments/record`} />
              <QuickAction icon={BarChart3} label="Generate Report" to={`${basePath}/reports`} />
              <QuickAction icon={Settings} label="Reminder Settings" to={`${basePath}/reminder-settings`} />
            </div>
          </Panel>
          <Panel
            title="Recent Invoices"
            className="xl:col-span-2"
            action={<Link to={`${invoiceListPath}?sort=latest`} className="text-xs font-bold text-[#F38978]">View all</Link>}
          >
            <RecentInvoicesTable invoices={recentInvoices} />
          </Panel>
        </div>

        <div className="flex items-center justify-end gap-3 text-xs font-medium text-[#7b6660]">
          <span>Last refreshed: {lastRefreshedAt ? formatDateTime(lastRefreshedAt) : "-"}</span>
          <button
            type="button"
            onClick={() => loadDashboard(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#ead3cc] bg-white px-3 py-2 font-bold text-[#251E1F] transition hover:border-[#F38978] hover:text-[#F38978]"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>
    </section>
  );
}
