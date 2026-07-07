import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  BellRing,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  CreditCard,
  DollarSign,
  FileCheck2,
  FileText,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Target,
  TrendingUp,
  UserPlus
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { fetchAdminInvoicingDashboard } from "../../services/adminDashboardService.js";
import { getStoredSession } from "../../services/sessionService.js";

const refreshIntervalMs = 5 * 60 * 1000;
const coral = "#F38978";

const revenuePeriods = ["This Month", "This Quarter", "This Year", "Last 7 Days", "Last 30 Days"];

const statusColors = {
  Paid: "#4FB783",
  Sent: "#FFB65C",
  Viewed: "#D97706",
  Overdue: "#F38978",
  Draft: "#7FA7D8"
};

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDisplayDate(value) {
  return new Intl.DateTimeFormat("en-SG", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(value);
}

function formatWeekday(value) {
  return new Intl.DateTimeFormat("en-SG", {
    weekday: "long"
  }).format(value);
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

function formatCount(value, fallback = "0") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return fallback;
  }

  return new Intl.NumberFormat("en-SG").format(Number(value));
}

function PlaceholderValue() {
  return <span className="text-[#8d7b76]">Pending data</span>;
}

function EmptyState({ children }) {
  return (
    <div className="rounded-xl border border-dashed border-[#f0c9bf] bg-[#fff6f2] px-4 py-7 text-center text-sm text-[#7b6660]">
      {children}
    </div>
  );
}

function Panel({ title, action, children, className = "", icon: Icon }) {
  return (
    <section className={`h-full rounded-xl border border-[#f0d2ca] bg-white/95 p-5 shadow-[0_10px_28px_rgba(37,30,31,0.06)] ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          {Icon ? <Icon size={18} className="shrink-0 text-[#F38978]" /> : null}
          <h3 className="truncate text-[15px] font-bold text-[#251E1F]">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function MiniSelect({ value, onChange }) {
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Revenue trend period</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="appearance-none rounded-full border border-[#f0d2ca] bg-[#fff8f5] py-1.5 pl-3 pr-8 text-xs font-semibold text-[#251E1F] outline-none transition focus:border-[#F38978] focus:ring-2 focus:ring-[#F38978]/20"
      >
        {revenuePeriods.map((period) => (
          <option key={period} value={period}>
            {period}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-3 text-[#8d7b76]" />
    </label>
  );
}

function MetricCard({ label, value, note, icon: Icon, accent = coral, available = true }) {
  return (
    <article className="min-h-[148px] rounded-xl border border-[#f0d2ca] bg-white/95 p-4 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
      <div
        className="mb-4 flex h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: `${accent}22`, color: accent }}
      >
        <Icon size={20} strokeWidth={2.2} />
      </div>
      <p className="min-h-9 text-sm font-semibold leading-tight text-[#251E1F]">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-[#251E1F]">
        {available ? value : "-"}
      </p>
      <p className={`mt-2 text-[11px] font-medium leading-tight ${available ? "text-[#4d9a73]" : "text-[#8d7b76]"}`}>
        {note}
      </p>
    </article>
  );
}

function ActionItem({ icon: Icon, label, value, color = coral, available = true }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-[#fff5f1] px-3 py-2">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: color }}
      >
        <Icon size={14} />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#251E1F]">{label}</span>
      <span className="text-sm font-bold text-[#251E1F]">{available ? value : "-"}</span>
      <ChevronRight size={15} className="text-[#b89a92]" />
    </div>
  );
}

function ReminderStat({ label, value, icon: Icon, tint = "#F38978", available = true }) {
  return (
    <div className="rounded-lg bg-[#fff3ef] p-4">
      <p className="text-xs font-semibold text-[#251E1F]">{label}</p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="text-2xl font-bold text-[#251E1F]">{available ? value : "-"}</p>
        <Icon size={18} style={{ color: tint }} />
      </div>
    </div>
  );
}

function DonutChart({ statuses, total }) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  let runningOffset = 0;

  return (
    <div className="relative mx-auto h-52 w-52">
      <svg viewBox="0 0 128 128" className="h-full w-full">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="#f7e2db" strokeWidth="18" />
        {statuses.map((item) => {
          const segment = total > 0 ? (item.count / total) * circumference : 0;
          const dashOffset = runningOffset;
          runningOffset += segment;

          return (
            <circle
              key={item.status}
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth="18"
              strokeLinecap="butt"
              strokeDasharray={`${segment} ${circumference}`}
              strokeDashoffset={-dashOffset}
              transform="rotate(-90 64 64)"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="text-2xl font-bold text-[#251E1F]">{formatCount(total)}</p>
        <p className="mt-1 text-xs font-semibold text-[#7b6660]">Total</p>
      </div>
    </div>
  );
}

function CashFlowRow({ label, icon: Icon, tone }) {
  return (
    <div className={`flex items-center justify-between rounded-lg px-4 py-3 ${tone}`}>
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-[#F38978]">
          <Icon size={15} />
        </span>
        <span className="text-sm font-semibold text-[#251E1F]">{label}</span>
      </div>
      <PlaceholderValue />
    </div>
  );
}

function QuickAction({ icon: Icon, label, to, title }) {
  const content = (
    <>
      <Icon size={18} />
      <span>{label}</span>
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#ead3cc] bg-white px-4 py-2 text-xs font-semibold text-[#251E1F] transition hover:border-[#F38978] hover:text-[#F38978]"
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled
      title={title}
      className="inline-flex min-h-11 cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-[#ead3cc] bg-[#fff8f5] px-4 py-2 text-xs font-semibold text-[#8d7b76]"
    >
      {content}
    </button>
  );
}

export default function AdminDashboardHomePage() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [revenuePeriod, setRevenuePeriod] = useState("This Month");
  const actionRequiredRef = useRef(null);
  const quickActionsRef = useRef(null);
  const session = getStoredSession();
  const today = new Date();

  async function loadDashboard(isBackgroundRefresh = false) {
    if (isBackgroundRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");

    try {
      const data = await fetchAdminInvoicingDashboard();
      setDashboard(data);
      setLastUpdated(new Date());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    const intervalId = window.setInterval(() => loadDashboard(true), refreshIntervalMs);
    return () => window.clearInterval(intervalId);
  }, []);

  const statusCountMap = useMemo(() => {
    return (dashboard?.invoiceStatusDistribution || []).reduce((items, item) => {
      items[String(item.status || "").toLowerCase()] = Number(item.count || 0);
      return items;
    }, {});
  }, [dashboard?.invoiceStatusDistribution]);

  const invoiceStatusItems = useMemo(() => {
    return [
      { status: "Draft", count: Number(statusCountMap.draft || 0), color: statusColors.Draft },
      { status: "Sent", count: Number(statusCountMap.sent || 0), color: statusColors.Sent },
      { status: "Viewed", count: Number(statusCountMap.viewed || 0), color: statusColors.Viewed },
      { status: "Paid", count: Number(statusCountMap.paid || 0), color: statusColors.Paid },
      { status: "Overdue", count: Number(statusCountMap.overdue || dashboard?.overdueInvoices || 0), color: statusColors.Overdue }
    ];
  }, [dashboard?.overdueInvoices, statusCountMap]);

  const invoiceStatusTotal = useMemo(() => {
    return invoiceStatusItems.reduce((sum, item) => sum + item.count, 0);
  }, [invoiceStatusItems]);

  const userName = session?.user?.name || "Admin";
  const overdueInvoices = Number(dashboard?.overdueInvoices || 0);
  const draftInvoices = Number(statusCountMap.draft || 0);
  const sentInvoices = Number(statusCountMap.sent || 0);
  const viewedInvoices = Number(statusCountMap.viewed || 0);

  const metricCards = [
    {
      label: "Total Invoices",
      value: formatCount(invoiceStatusTotal),
      note: "From invoice status data",
      icon: FileText,
      accent: coral,
      available: true
    },
    {
      label: "Total Revenue",
      value: "-",
      note: "Pending data",
      icon: DollarSign,
      accent: "#FFB65C",
      available: false
    },
    {
      label: "Outstanding",
      value: "-",
      note: "Pending data",
      icon: AlertTriangle,
      accent: coral,
      available: false
    },
    {
      label: "Paid Today",
      value: "-",
      note: "Pending data",
      icon: CreditCard,
      accent: "#4FB783",
      available: false
    },
    {
      label: "Sent",
      value: formatCount(sentInvoices),
      note: "From invoice status data",
      icon: Send,
      accent: "#FFB65C",
      available: true
    },
    {
      label: "Viewed",
      value: formatCount(viewedInvoices),
      note: "From invoice status data",
      icon: FileCheck2,
      accent: "#D97706",
      available: true
    },
    {
      label: "Overdue",
      value: formatCount(overdueInvoices),
      note: "From live invoice data",
      icon: Clock3,
      accent: coral,
      available: true
    },
    {
      label: "Draft",
      value: formatCount(draftInvoices),
      note: "From invoice status data",
      icon: FileCheck2,
      accent: "#7FA7D8",
      available: true
    }
  ];

  if (loading) {
    return (
      <section className="-m-4 min-h-[calc(100vh-5rem)] bg-[#fff6f2] p-6 text-[#251E1F] sm:-m-6">
        <div className="rounded-xl border border-[#f0d2ca] bg-white/90 p-8 text-center shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
          Loading dashboard data...
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
        <header className="flex flex-col gap-5 px-0 py-1 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold tracking-tight text-[#251E1F]">
              {getGreeting()}, {userName}!
            </h2>
            <p className="mt-1 text-sm text-[#6f5b55]">
              Here's what's happening with your invoicing today.
            </p>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="border-[#f0c9bf] sm:border-l sm:pl-8">
                <p className="text-sm font-bold text-[#251E1F]">{formatWeekday(today)}</p>
                <p className="mt-1 text-sm text-[#6f5b55]">{formatDisplayDate(today)}</p>
              </div>
              <div className="border-[#f0c9bf] sm:border-l sm:pl-8">
                <p className="text-sm font-semibold text-[#6f5b55]">Last Login</p>
                <p className="mt-1 text-sm text-[#6f5b55]">
                  {session?.user?.lastLogin ? formatDate(session.user.lastLogin) : "Not available"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-transparent text-[#251E1F]"
                aria-label="Search"
              >
                <Search size={21} />
              </button>
              <button
                type="button"
                className="relative flex h-11 w-11 items-center justify-center rounded-full bg-transparent text-[#251E1F]"
                aria-label="Notifications"
              >
                <Bell size={20} />
                {dashboard?.auditEventsToday ? (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#F38978] px-1 text-[10px] font-bold text-white">
                    {formatCount(dashboard.auditEventsToday)}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => quickActionsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#F38978] px-5 text-sm font-bold text-white shadow-[0_12px_25px_rgba(243,137,120,0.35)] transition hover:bg-[#e87562]"
              >
                <Activity size={16} />
                Quick Actions
                <ChevronDown size={14} />
              </button>
              <button
                type="button"
                onClick={() => loadDashboard(true)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-[#F38978] shadow-sm"
                aria-label="Refresh dashboard"
              >
                <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-xl border border-[#F38978]/30 bg-white px-4 py-3 text-sm font-semibold text-[#b64d3b]">
            {error}
          </div>
        ) : null}

        {dashboard?.missingTables?.length ? (
          <div className="rounded-xl border border-[#ffb65c]/40 bg-white px-4 py-3 text-sm font-semibold text-[#8a5b18]">
            Some dashboard sections are empty because these tables are missing: {dashboard.missingTables.join(", ")}.
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
          {metricCards.map((card) => (
            <MetricCard key={card.label} {...card} />
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_1.12fr_0.98fr]">
          <Panel
            title="Action Required"
            action={<button type="button" className="text-xs font-bold text-[#F38978]">View All</button>}
          >
            <div ref={actionRequiredRef} className="space-y-2">
              <ActionItem icon={AlertTriangle} label="Overdue Invoices" value={formatCount(overdueInvoices)} available color={coral} />
              <ActionItem icon={BellRing} label="Reminder Failed" value="-" available={false} color="#FFB65C" />
              <ActionItem icon={Clock3} label="Awaiting Approval" value="-" available={false} color="#FFB65C" />
              <ActionItem icon={CreditCard} label="Payments to Verify" value="-" available={false} color="#7FA7D8" />
              <ActionItem icon={CheckCircle2} label="Refund Requests" value="-" available={false} color="#4FB783" />
            </div>
          </Panel>

          <Panel title="Reminder Summary" action={<span className="text-xs font-bold text-[#251E1F]">Today</span>}>
            <div className="grid gap-3 sm:grid-cols-4">
              <ReminderStat label="Scheduled" value={formatCount(dashboard?.reminderJobs || 0)} icon={CalendarDays} tint={coral} />
              <ReminderStat label="Sent" value="-" icon={Send} tint="#B5833B" available={false} />
              <ReminderStat label="Pending" value="-" icon={Clock3} tint="#7FA7D8" available={false} />
              <ReminderStat label="Failed" value="-" icon={AlertTriangle} tint={coral} available={false} />
            </div>
            <div className="mt-7">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-[#251E1F]">Success Rate</span>
                <span className="text-sm font-bold text-[#8d7b76]">Pending data</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#f8ddd5]">
                <div className="h-full w-0 rounded-full bg-[#F38978]" />
              </div>
            </div>
          </Panel>

          <Panel title="Today's Focus">
            <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left xl:flex-col xl:text-center 2xl:flex-row 2xl:text-left">
              <div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-[#fff2ee]">
                <div className="absolute h-20 w-20 rounded-full border-2 border-[#F38978]" />
                <div className="absolute h-12 w-12 rounded-full border-2 border-[#F38978]" />
                <Target size={44} className="text-[#F38978]" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-bold text-[#251E1F]">Stay on top of important tasks</p>
                <p className="mt-2 text-sm leading-6 text-[#6f5b55]">
                  {overdueInvoices > 0
                    ? `There are ${formatCount(overdueInvoices)} overdue invoices in the current dashboard data.`
                    : "No overdue invoices are shown in the current dashboard data."}
                </p>
                <button
                  type="button"
                  onClick={() => actionRequiredRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
                  className="mt-5 rounded-lg bg-[#F38978] px-5 py-2.5 text-sm font-bold text-white shadow-[0_12px_25px_rgba(243,137,120,0.28)] transition hover:bg-[#e87562]"
                >
                  View Action Required
                </button>
              </div>
            </div>
          </Panel>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.43fr_0.57fr]">
          <Panel title="Invoice Status" action={<span className="text-xs font-bold text-[#251E1F]">This Month</span>}>
            <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
              <DonutChart statuses={invoiceStatusItems} total={invoiceStatusTotal} />
              <div className="space-y-3">
                {invoiceStatusItems.map((item) => {
                  const percentage = invoiceStatusTotal > 0 ? Math.round((item.count / invoiceStatusTotal) * 100) : 0;

                  return (
                    <div key={item.status} className="grid grid-cols-[1fr_auto] items-center gap-4 text-sm">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="truncate font-semibold text-[#251E1F]">{item.status}</span>
                      </div>
                      <span className="text-right text-[#6f5b55]">
                        {percentage}% ({formatCount(item.count)})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Panel>

          <Panel title="Revenue Trend" icon={TrendingUp} action={<MiniSelect value={revenuePeriod} onChange={setRevenuePeriod} />}>
            <div className="flex min-h-[230px] flex-col justify-center rounded-xl border border-dashed border-[#f0c9bf] bg-[#fff8f5] p-6">
              <div className="grid h-28 grid-rows-4 gap-4 opacity-70">
                <span className="border-t border-[#efd5cd]" />
                <span className="border-t border-[#efd5cd]" />
                <span className="border-t border-[#efd5cd]" />
                <span className="border-t border-[#efd5cd]" />
              </div>
              <div className="-mt-20 flex flex-col items-center text-center">
                <BarChart3 size={36} className="text-[#F38978]" />
                <p className="mt-4 text-sm font-bold text-[#251E1F]">
                  Revenue trend data is not available yet.
                </p>
                <p className="mt-2 text-xs text-[#7b6660]">
                  Selected period: {revenuePeriod}
                </p>
              </div>
            </div>
          </Panel>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.95fr_0.95fr_1.12fr_1.28fr]">
          <Panel title="Cash Flow Overview">
            <div className="space-y-3">
              <CashFlowRow label="Incoming" icon={DollarSign} tone="bg-[#edf8f1]" />
              <CashFlowRow label="Outstanding" icon={AlertTriangle} tone="bg-[#fff0eb]" />
              <CashFlowRow label="Net Cash" icon={CreditCard} tone="bg-[#eef5ff]" />
            </div>
          </Panel>

          <Panel
            title="Recent Activities"
            action={dashboard?.recentActivities?.length ? <span className="text-xs font-bold text-[#F38978]">View All</span> : null}
          >
            {dashboard?.recentActivities?.length ? (
              <div className="space-y-3">
                {dashboard.recentActivities.slice(0, 4).map((activity) => (
                  <div key={activity.id} className="flex gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fff0eb] text-[#F38978]">
                      <Activity size={15} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#251E1F]">{activity.action}</p>
                      <p className="mt-0.5 truncate text-xs text-[#7b6660]">
                        {activity.entityType} {activity.entityId ? `#${activity.entityId}` : ""} by {activity.actorName}
                      </p>
                      <p className="mt-0.5 text-xs text-[#a48d86]">{formatDate(activity.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState>No recent system activities yet.</EmptyState>
            )}
          </Panel>

          <Panel title="Upcoming Due Invoices" action={<span className="text-xs font-bold text-[#F38978]">View All</span>}>
            <EmptyState>No upcoming due invoice data available yet.</EmptyState>
          </Panel>

          <Panel title="Top Outstanding Customers" action={<span className="text-xs font-bold text-[#F38978]">View All</span>}>
            <EmptyState>No outstanding customer data available yet.</EmptyState>
          </Panel>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <Panel title="AI Insights" icon={Bot}>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#fff0eb] text-[#F38978]">
                <Bot size={30} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-6 text-[#251E1F]">
                  AI insights will appear here once invoice and reminder analytics are connected.
                </p>
                <p className="mt-1 text-xs text-[#7b6660]">
                  No AI backend or analytics endpoint is connected for this dashboard yet.
                </p>
              </div>
            </div>
          </Panel>

          <Panel title="Quick Actions">
            <div ref={quickActionsRef} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <QuickAction icon={Plus} label="Create Invoice" title="Create Invoice route is not available yet." />
              <QuickAction icon={Send} label="Send Reminder" to="/dashboard/invoicing/admin/reminder-settings" />
              <QuickAction icon={UserPlus} label="New Customer" title="New Customer route is not available yet." />
              <QuickAction icon={CreditCard} label="Record Payment" title="Record Payment route is not available yet." />
              <QuickAction icon={BarChart3} label="Generate Report" to="/dashboard/invoicing/admin/reports" />
              <QuickAction icon={Settings} label="Reminder Settings" to="/dashboard/invoicing/admin/reminder-settings" />
            </div>
          </Panel>
        </div>

        <p className="text-right text-xs font-medium text-[#7b6660]">
          Last updated: {lastUpdated ? formatDate(lastUpdated) : "-"}
        </p>
      </div>
    </section>
  );
}
