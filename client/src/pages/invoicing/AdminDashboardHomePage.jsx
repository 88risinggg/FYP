import {
  AlertTriangle,
  Banknote,
  BellRing,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  Info,
  ShieldAlert
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { fetchAdminInvoicingDashboard } from "../../services/adminDashboardService.js";
import { getStoredSession } from "../../services/sessionService.js";

const basePath = "/dashboard/invoicing/admin";
const focusDestinations = {
  "validation-errors": `${basePath}/dashboard/validation-errors`,
  "payment-reminder-summary": `${basePath}/dashboard/payment-reminder-summary`,
  "invoice-performance": `${basePath}/dashboard/invoice-performance`
};

const statusConfig = [
  { key: "draft", label: "Draft", color: "#8f7d77" },
  { key: "sent", label: "Sent", color: "#4f8fd8" },
  { key: "viewed", label: "Viewed", color: "#35a69b" },
  { key: "paid", label: "Paid", color: "#3f8f62" },
  { key: "overdue", label: "Overdue", color: "#c94c3a" }
];

const severityStyles = {
  Critical: "bg-[#fde8e4] text-[#a43e30]",
  High: "bg-[#fff0df] text-[#9a5b12]",
  Medium: "bg-[#eaf2ff] text-[#3269a8]",
  Low: "bg-[#f2eee9] text-[#6f5b55]"
};

const focusIcons = {
  "validation-errors": ShieldAlert,
  "reminder-failures": BellRing,
  "payments-to-verify": CreditCard,
  "overdue-invoices": AlertTriangle,
  "draft-invoices": FileText
};

const kpiGridStyles = `
  .admin-overview-kpi-container {
    container-type: inline-size;
  }

  .admin-overview-kpi-grid {
    display: grid;
    grid-template-columns: repeat(1, minmax(0, 1fr));
    gap: 0.75rem;
  }

  @container (min-width: 32rem) {
    .admin-overview-kpi-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @container (min-width: 48rem) {
    .admin-overview-kpi-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @container (min-width: 65.25rem) {
    .admin-overview-kpi-grid {
      grid-template-columns: repeat(6, minmax(0, 1fr));
    }
  }
`;

function formatCount(value) {
  return new Intl.NumberFormat("en-SG").format(Number(value || 0));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD"
  }).format(Number(value || 0));
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

function Section({ title, description, children }) {
  return (
    <section className="rounded-lg border border-[#f0d2ca] bg-white/95 p-5 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
      <div className="mb-5">
        <h3 className="text-base font-bold text-[#251E1F]">{title}</h3>
        {description ? <p className="mt-1 text-sm text-[#6f5b55]">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function KpiCard({ title, value, helper, icon: Icon, accent, available = true }) {
  return (
    <article className="flex min-h-[148px] flex-col rounded-lg border border-[#f0d2ca] bg-white/95 p-4 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${accent}1f`, color: accent }}
          aria-hidden="true"
        >
          <Icon size={18} />
        </span>
        <span title={helper} aria-label={`${title}: ${helper}`} className="text-[#9b837c]">
          <Info size={15} />
        </span>
      </div>
      <p className="mt-4 min-h-10 overflow-hidden text-sm font-bold leading-5 text-[#514440] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">{title}</p>
      <p className="mt-2 min-w-0 break-words text-xl font-bold leading-tight text-[#251E1F] 2xl:text-2xl">
        {available ? value : "Unavailable"}
      </p>
      <p className="mt-auto pt-2 text-xs font-medium leading-4 text-[#7b6660]">
        {available ? helper : "Data is temporarily unavailable"}
      </p>
    </article>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading invoicing overview" aria-busy="true">
      <div className="h-24 animate-pulse rounded-lg bg-white/70" />
      <div className="admin-overview-kpi-container">
        <div className="admin-overview-kpi-grid">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-[148px] animate-pulse rounded-lg border border-[#f0d2ca] bg-white/80" />
        ))}
        </div>
      </div>
      <div className="h-52 animate-pulse rounded-lg border border-[#f0d2ca] bg-white/80" />
      <div className="h-52 animate-pulse rounded-lg border border-[#f0d2ca] bg-white/80" />
    </div>
  );
}

function InvoiceStatusOverview({ invoiceStatus, hasInvoices }) {
  const statuses = statusConfig.map((status) => ({
    ...status,
    count: Number(invoiceStatus?.[status.key] || 0)
  }));
  const trackedTotal = statuses.reduce((sum, status) => sum + status.count, 0);

  if (!hasInvoices) {
    return (
      <div className="rounded-lg border border-dashed border-[#f0c9bf] bg-[#fff8f5] px-5 py-8 text-center text-sm text-[#7b6660]">
        No invoice data is available yet.
      </div>
    );
  }

  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#f2eee9]" aria-hidden="true">
        {statuses.map((status) => (
          <span
            key={status.key}
            style={{
              backgroundColor: status.color,
              width: trackedTotal > 0 ? `${(status.count / trackedTotal) * 100}%` : "0%"
            }}
          />
        ))}
      </div>
      <div className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-5">
        {statuses.map((status) => (
          <div key={status.key} className="flex min-h-10 items-center justify-between gap-3 border-b border-[#f4ded7] pb-2 lg:border-b-0 lg:pb-0">
            <span className="flex items-center gap-2 text-sm font-semibold text-[#514440]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} aria-hidden="true" />
              {status.label}
            </span>
            <span className="text-sm font-bold text-[#251E1F]">{formatCount(status.count)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FocusItem({ item }) {
  const Icon = focusIcons[item.type] || AlertTriangle;
  const destination = focusDestinations[item.destination];

  return (
    <article className="flex flex-col gap-4 border-b border-[#f4ded7] py-4 first:pt-0 last:border-b-0 last:pb-0 md:flex-row md:items-center">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fff0eb] text-[#c94c3a]" aria-hidden="true">
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-bold text-[#251E1F]">{item.title}</h4>
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${severityStyles[item.severity] || severityStyles.Low}`}>
            {item.severity}
          </span>
        </div>
        <p className="mt-1 text-sm font-semibold text-[#514440]">{formatCount(item.count)} affected record{Number(item.count) === 1 ? "" : "s"}</p>
        <p className="mt-1 text-xs text-[#7b6660]">{item.description}</p>
      </div>
      {destination ? (
        <Link
          to={destination}
          className="inline-flex min-h-10 items-center justify-center self-start rounded-lg border border-[#ead3cc] bg-white px-4 py-2 text-sm font-bold text-[#251E1F] transition hover:border-[#F38978] hover:text-[#b64d3b] focus:outline-none focus:ring-2 focus:ring-[#F38978]/40 md:self-auto"
          aria-label={`Review ${item.title}`}
        >
          Review
        </Link>
      ) : null}
    </article>
  );
}

export default function AdminDashboardHomePage() {
  const session = getStoredSession();
  const requestInFlightRef = useRef(false);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const currentDate = useMemo(() => new Date(), []);

  const loadDashboard = useCallback(async () => {
    if (requestInFlightRef.current) return;

    requestInFlightRef.current = true;
    setLoading(true);
    setError("");

    try {
      const data = await fetchAdminInvoicingDashboard();
      setDashboard(data);
    } catch {
      setError("Unable to load the invoicing overview.");
    } finally {
      requestInFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const admin = dashboard?.admin || session?.user || {};
  const adminName = admin.name || session?.user?.name || "Admin";
  const summary = dashboard?.summary || {};
  const availability = dashboard?.availability || {};
  const hasInvoices = availability.invoices !== false && Number(summary.totalInvoices || 0) > 0;
  const todayFocus = useMemo(
    () => [...(dashboard?.todayFocus || [])]
      .filter((item) => Number(item.count) > 0)
      .sort((left, right) => Number(left.priority || 99) - Number(right.priority || 99)),
    [dashboard?.todayFocus]
  );
  const kpiCards = [
    { title: "Total Invoices", value: formatCount(summary.totalInvoices), helper: "Active invoice records", icon: FileText, accent: "#F38978", available: availability.invoices !== false },
    { title: "Paid Revenue", value: formatCurrency(summary.paidRevenue), helper: "Confirmed payment amount", icon: Banknote, accent: "#3f8f62", available: availability.payments !== false },
    { title: "Outstanding Amount", value: formatCurrency(summary.outstandingAmount), helper: "Current unpaid balance", icon: AlertTriangle, accent: "#d97706", available: availability.payments !== false },
    { title: "Overdue Invoices", value: formatCount(summary.overdueInvoices), helper: "Past due with unpaid balance", icon: Clock3, accent: "#c94c3a", available: availability.invoices !== false && availability.payments !== false },
    { title: "Payments to Verify", value: formatCount(summary.paymentsToVerify), helper: "Pending Finance verification", icon: CreditCard, accent: "#4f8fd8", available: availability.payments !== false },
    { title: "Validation Errors", value: formatCount(summary.validationErrors), helper: "Latest invoice upload errors", icon: ShieldAlert, accent: "#a43e30", available: availability.validation !== false }
  ];

  return (
    <section
      className="-m-4 min-h-[calc(100vh-5rem)] p-4 text-[#251E1F] sm:-m-6 sm:p-6"
      style={{ backgroundImage: "linear-gradient(90deg, #FDD9CD 0%, #fff8f5 15%, #fffaf8 58%, #FDD9CD 100%)" }}
    >
      <style>{kpiGridStyles}</style>
      <div className="mx-auto max-w-[1500px] space-y-4">
        {loading && !dashboard ? <DashboardSkeleton /> : (
          <>
            <header className="border-b border-[#f0d2ca] bg-white/40 pb-5">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-[#251E1F]">{getGreeting(currentDate)}, {adminName}</h2>
                  <p className="mt-1 text-sm text-[#6f5b55]">A clear view of invoicing health and items requiring attention.</p>
                </div>
              </div>
            </header>

            {error ? (
              <div role="alert" className="flex flex-col gap-3 rounded-lg border border-[#F38978]/40 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-[#a43e30]">{error}</p>
                <button type="button" onClick={() => loadDashboard()} disabled={loading} className="self-start text-sm font-bold text-[#b64d3b] underline underline-offset-2 disabled:opacity-60">
                  Retry
                </button>
              </div>
            ) : null}

            {dashboard ? (
              <>
                <section aria-labelledby="overview-kpis-heading">
                  <h3 id="overview-kpis-heading" className="mb-3 text-base font-bold">Overall Invoicing Situation</h3>
                  <div className="admin-overview-kpi-container">
                    <div className="admin-overview-kpi-grid">
                      {kpiCards.map((card) => <KpiCard key={card.title} {...card} />)}
                    </div>
                  </div>
                </section>

                <Section title="Invoice Status Overview" description="Current invoice counts by processing status.">
                  <InvoiceStatusOverview invoiceStatus={dashboard.invoiceStatus} hasInvoices={hasInvoices} />
                </Section>

                <Section title="Today's Focus" description="Issues are ordered by severity so the most important work appears first.">
                  {todayFocus.length ? todayFocus.map((item) => <FocusItem key={item.type} item={item} />) : (
                    <div className="rounded-lg border border-dashed border-[#cde5d5] bg-[#f4fbf6] px-5 py-8 text-center">
                      <CheckCircle2 size={24} className="mx-auto text-[#3f8f62]" aria-hidden="true" />
                      <p className="mt-2 text-sm font-semibold text-[#356f4d]">No urgent invoicing issues require attention.</p>
                    </div>
                  )}
                </Section>
              </>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
