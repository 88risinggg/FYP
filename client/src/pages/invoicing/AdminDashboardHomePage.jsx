/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - ADMIN
 * PURPOSE: Implements the Admin Dashboard Home Page screen and its page-level interactions.
 * LAYER: Frontend page - renders a complete screen and coordinates its user interactions.
 * FIND RELATED CODE: Trace its imports for UI components and frontend services used by this screen.
 */
import {
  AlertTriangle,
  Ban,
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  ShieldAlert
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { fetchAdminInvoicingDashboard } from "../../services/adminDashboardService.js";
import { getStoredSession } from "../../services/sessionService.js";

const basePath = "/dashboard/invoicing/admin";
const focusDestinations = {
  "validation-errors": `${basePath}/dashboard/validation-errors`
};

const statusConfig = [
  { key: "draft", label: "Draft", color: "#7B6660" },
  { key: "sent", label: "Sent", color: "#4f8fd8" },
  { key: "viewed", label: "Viewed", color: "#35a69b" },
  { key: "paid", label: "Paid", color: "#2F8758" },
  { key: "overdue", label: "Overdue", color: "#c94c3a" }
];

const severityStyles = {
  Critical: "bg-[#FDD9CD] text-[#C55245]",
  High: "bg-[#FFF0EB] text-[#C55245]",
  Medium: "bg-[#eaf2ff] text-[#3269a8]",
  Low: "bg-[#f2eee9] text-[#6f5b55]"
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

  @container (min-width: 68rem) {
    .admin-overview-kpi-grid {
      grid-template-columns: repeat(7, minmax(0, 1fr));
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

function KpiCard({ title, value, icon: Icon, accent, available = true }) {
  return (
    <article className="flex min-h-[132px] flex-col rounded-lg border border-[#f0d2ca] bg-white/95 p-4 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${accent}1f`, color: accent }}
        aria-hidden="true"
      >
        <Icon size={18} />
      </span>
      <p className="mt-3 min-h-10 overflow-hidden text-sm font-bold leading-5 text-[#514440] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">{title}</p>
      <p className="mt-auto min-w-0 break-words pt-2 text-xl font-bold leading-tight text-[#251E1F] 2xl:text-2xl">
        {available ? value : "Unavailable"}
      </p>
    </article>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading invoicing overview" aria-busy="true">
      <div className="h-28 animate-pulse rounded-lg border border-[#f0d2ca] bg-white/70" />
      <div className="admin-overview-kpi-container">
        <div className="admin-overview-kpi-grid">
        {Array.from({ length: 7 }, (_, index) => (
          <div key={index} className="h-[132px] animate-pulse rounded-lg border border-[#f0d2ca] bg-white/80" />
        ))}
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-5">
        <div className="h-80 animate-pulse rounded-lg border border-[#f0d2ca] bg-white/80 xl:col-span-2" />
        <div className="h-80 animate-pulse rounded-lg border border-[#f0d2ca] bg-white/80 xl:col-span-3" />
      </div>
    </div>
  );
}

function InvoiceStatusOverview({ invoiceStatus, hasInvoices }) {
  const statuses = statusConfig.map((status) => ({
    ...status,
    count: Number(invoiceStatus?.[status.key] || 0)
  }));
  const largestCount = Math.max(...statuses.map((status) => status.count), 0);

  if (!hasInvoices) {
    return (
      <div className="rounded-lg border border-dashed border-[#f0c9bf] bg-[#fff8f5] px-5 py-8 text-center text-sm text-[#7b6660]">
        No invoice data is available yet.
      </div>
    );
  }

  return (
    <div
      className="space-y-4"
      role="img"
      aria-label={`Invoice status counts: ${statuses.map((status) => `${status.label} ${status.count}`).join(", ")}`}
    >
      {statuses.map((status) => {
        const width = largestCount > 0 ? (status.count / largestCount) * 100 : 0;

        return (
          <div key={status.key} className="grid grid-cols-[4.5rem_minmax(0,1fr)_3rem] items-center gap-3 sm:grid-cols-[5.5rem_minmax(0,1fr)_3.5rem]">
            <span className="text-sm font-semibold text-[#514440]">{status.label}</span>
            <div className="h-7 overflow-hidden rounded-md bg-[#f2eee9]" aria-hidden="true">
              <div
                className="h-full rounded-md transition-[width] duration-300 motion-reduce:transition-none"
                style={{
                  backgroundColor: status.color,
                  width: status.count > 0 ? `max(0.5rem, ${width}%)` : "0%"
                }}
              />
            </div>
            <span className="text-right text-sm font-bold tabular-nums text-[#251E1F]">{formatCount(status.count)}</span>
          </div>
        );
      })}
    </div>
  );
}

function FocusItem({ item }) {
  const destination = focusDestinations[item.destination];

  return (
    <article className="flex flex-col gap-3 border-b border-[#f4ded7] py-4 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-center">
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
    { title: "Total Invoices", value: formatCount(summary.totalInvoices), icon: FileText, accent: "#F38978", available: availability.invoices !== false },
    { title: "Paid Revenue", value: formatCurrency(summary.paidRevenue), icon: Banknote, accent: "#2F8758", available: availability.payments !== false },
    { title: "Outstanding Amount", value: formatCurrency(summary.outstandingAmount), icon: AlertTriangle, accent: "#d97706", available: availability.payments !== false },
    { title: "Overdue Invoices", value: formatCount(summary.overdueInvoices), icon: Clock3, accent: "#c94c3a", available: availability.invoices !== false && availability.payments !== false },
    { title: "Payments to Verify", value: formatCount(summary.paymentsToVerify), icon: CreditCard, accent: "#4f8fd8", available: availability.payments !== false },
    { title: "Validation Errors", value: formatCount(summary.validationErrors), icon: ShieldAlert, accent: "#C94C3A", available: availability.validation !== false },
    { title: "Void Invoices", value: formatCount(summary.voidInvoices), icon: Ban, accent: "#6f5b55", available: availability.invoices !== false }
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
            <header className="rounded-lg border border-[#f0d2ca] bg-white/70 p-5 shadow-[0_10px_28px_rgba(37,30,31,0.04)]">
              <div>
                <div>
                  <h2 className="text-2xl font-bold text-[#251E1F]">{getGreeting(currentDate)}, {adminName}</h2>
                  <p className="mt-1 text-sm text-[#6f5b55]">A clear view of invoicing health and items requiring attention.</p>
                </div>
              </div>
            </header>

            {error ? (
              <div role="alert" className="flex flex-col gap-3 rounded-lg border border-[#F38978]/40 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-[#C55245]">{error}</p>
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

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-5 xl:items-stretch">
                  <div className="xl:col-span-2 [&>section]:h-full">
                    <Section title="Today's Focus" description="Priority invoicing issues that need attention today.">
                      {todayFocus.length ? todayFocus.map((item) => <FocusItem key={item.type} item={item} />) : (
                        <div className="rounded-lg border border-dashed border-[#FDD9CD] bg-[#FFF6F2] px-5 py-8 text-center">
                          <CheckCircle2 size={24} className="mx-auto text-[#2F8758]" aria-hidden="true" />
                          <p className="mt-2 text-sm font-semibold text-[#2F8758]">No urgent invoicing issues require attention.</p>
                        </div>
                      )}
                    </Section>
                  </div>
                  <div className="xl:col-span-3 [&>section]:h-full">
                    <Section title="Invoice Status Overview" description="Current invoice counts by processing status.">
                      <InvoiceStatusOverview invoiceStatus={dashboard.invoiceStatus} hasInvoices={hasInvoices} />
                    </Section>
                  </div>
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
