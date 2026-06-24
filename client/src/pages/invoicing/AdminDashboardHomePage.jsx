import {
  Activity,
  AlertTriangle,
  BellRing,
  Clock3,
  FileClock,
  FileText,
  RefreshCw,
  Settings,
  Users
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { fetchAdminInvoicingDashboard } from "../../services/adminDashboardService.js";

const refreshIntervalMs = 5 * 60 * 1000;

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatTime(value) {
  if (!value) return "-";
  return String(value).slice(0, 5);
}

function EmptyState({ children }) {
  return (
    <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.035] px-4 py-8 text-center text-sm text-[#d8c6e8]">
      {children}
    </div>
  );
}

const statusColors = {
  Draft: "#A78BFA",
  Sent: "#38BDF8",
  Viewed: "#F59E0B",
  Paid: "#34D399",
  Overdue: "#FB7185"
};

function getStatusColor(status, index) {
  const fallback = ["#C77DFF", "#38BDF8", "#F59E0B", "#FB7185", "#34D399"];
  return statusColors[status] || fallback[index % fallback.length];
}

function DonutSegment({ item, index, total, offset }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const value = total > 0 ? item.count / total : 0;
  const dashLength = value * circumference;
  const gap = total > 0 && value < 1 ? 2 : 0;

  return (
    <circle
      cx="64"
      cy="64"
      r={radius}
      fill="none"
      stroke={getStatusColor(item.status, index)}
      strokeWidth="18"
      strokeLinecap="round"
      strokeDasharray={`${Math.max(dashLength - gap, 0)} ${circumference}`}
      strokeDashoffset={-offset}
      transform="rotate(-90 64 64)"
    />
  );
}

export default function AdminDashboardHomePage() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

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

  const invoiceStatusTotal = useMemo(() => {
    return (dashboard?.invoiceStatusDistribution || []).reduce((sum, item) => sum + item.count, 0);
  }, [dashboard?.invoiceStatusDistribution]);

  const donutOffsets = useMemo(() => {
    const radius = 44;
    const circumference = 2 * Math.PI * radius;
    let currentOffset = 0;

    return (dashboard?.invoiceStatusDistribution || []).map((item) => {
      const offset = currentOffset;
      currentOffset += invoiceStatusTotal > 0 ? (item.count / invoiceStatusTotal) * circumference : 0;
      return offset;
    });
  }, [dashboard?.invoiceStatusDistribution, invoiceStatusTotal]);

  const cards = [
    { label: "Total Users", value: dashboard?.totalUsers || 0, icon: Users, tone: "text-[#C77DFF]" },
    { label: "Active Invoices", value: dashboard?.activeInvoices || 0, icon: FileText, tone: "text-emerald-200" },
    { label: "Overdue Invoices", value: dashboard?.overdueInvoices || 0, icon: AlertTriangle, tone: "text-rose-200" },
    { label: "Reminder Jobs", value: dashboard?.reminderJobs || 0, icon: BellRing, tone: "text-sky-200" },
    { label: "Audit Events Today", value: dashboard?.auditEventsToday || 0, icon: Activity, tone: "text-amber-200" }
  ];

  if (loading) {
    return (
      <section className="neon-glass neon-border rounded-lg p-8 text-center text-[#d8c6e8]">
        Loading dashboard data...
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-medium text-[#C77DFF]">Admin System Overview</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">
            Automated Invoicing System - Admin Dashboard
          </h2>
          <p className="mt-2 text-sm text-[#d8c6e8]">
            Data refreshes automatically every 5 minutes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadDashboard(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {dashboard?.missingTables?.length ? (
        <div className="rounded-lg border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          Some dashboard sections are empty because these tables are missing: {dashboard.missingTables.join(", ")}.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className="neon-glass neon-border rounded-lg p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-[#d8c6e8]">{card.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{card.value}</p>
                </div>
                <div className={`flex h-11 w-11 items-center justify-center rounded-lg bg-white/[0.07] ${card.tone}`}>
                  <Icon size={21} />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <section className="neon-glass neon-border rounded-lg p-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-white">Invoice Status Distribution</h3>
            <FileClock size={20} className="text-[#C77DFF]" />
          </div>
          {dashboard?.invoiceStatusDistribution?.length ? (
            <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
              <div className="relative mx-auto h-56 w-56">
                <svg viewBox="0 0 128 128" className="h-full w-full drop-shadow-[0_0_28px_rgba(199,125,255,0.22)]">
                  <circle cx="64" cy="64" r="44" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="18" />
                  {dashboard.invoiceStatusDistribution.map((item, index) => (
                    <DonutSegment
                      key={item.status}
                      item={item}
                      index={index}
                      total={invoiceStatusTotal}
                      offset={donutOffsets[index]}
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <p className="text-3xl font-semibold text-white">{invoiceStatusTotal}</p>
                  <p className="mt-1 text-xs font-medium uppercase text-[#d8c6e8]">Invoices</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_80px_96px] gap-3 px-1 text-xs font-semibold uppercase tracking-wide text-[#d8c6e8]/80">
                  <span>Status</span>
                  <span className="text-right">Count</span>
                  <span className="text-right">Percentage</span>
                </div>
                {dashboard.invoiceStatusDistribution.map((item, index) => {
                  const percentage = Number(item.percentage || 0);

                  return (
                    <div key={item.status} className="rounded-lg border border-white/10 bg-white/[0.045] p-4">
                      <div className="grid grid-cols-[1fr_80px_96px] items-center gap-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: getStatusColor(item.status, index) }}
                          />
                          <span className="font-medium text-white">{item.status}</span>
                        </div>
                        <p className="text-right font-semibold text-white">{item.count}</p>
                        <p className="text-right text-sm text-[#d8c6e8]">{percentage}%</p>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(percentage, item.count > 0 ? 6 : 0)}%`,
                            backgroundColor: getStatusColor(item.status, index)
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <EmptyState>No invoice status records available yet.</EmptyState>
          )}
        </section>

        <section className="neon-glass neon-border rounded-lg p-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-white">Quick Actions</h3>
            <Settings size={20} className="text-[#C77DFF]" />
          </div>
          <div className="grid gap-3">
            <Link to="/dashboard/invoicing/admin/users" className="rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white hover:bg-white/10">
              Manage user accounts
            </Link>
            <Link to="/dashboard/invoicing/admin/reminder-settings" className="rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white hover:bg-white/10">
              Configure reminder settings
            </Link>
            <Link to="/dashboard/invoicing/admin/audit-logs" className="rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white hover:bg-white/10">
              View audit logs
            </Link>
          </div>
          <p className="mt-5 text-xs text-[#d8c6e8]">
            Last updated: {lastUpdated ? formatDate(lastUpdated) : "-"}
          </p>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="neon-glass neon-border rounded-lg p-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-white">Recent System Activities</h3>
            <Activity size={20} className="text-[#C77DFF]" />
          </div>
          {dashboard?.recentActivities?.length ? (
            <div className="space-y-3">
              {dashboard.recentActivities.map((activity) => (
                <div key={activity.id} className="rounded-lg border border-white/10 bg-white/[0.05] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-white">{activity.action}</p>
                      <p className="mt-1 text-sm text-[#d8c6e8]">
                        {activity.entityType} {activity.entityId ? `#${activity.entityId}` : ""} by {activity.actorName}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-[#d8c6e8]">{formatDate(activity.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>No recent system activities yet.</EmptyState>
          )}
        </section>

        <section className="neon-glass neon-border rounded-lg p-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-white">Upcoming Reminder Schedule</h3>
            <Clock3 size={20} className="text-[#C77DFF]" />
          </div>
          {dashboard?.upcomingReminderSchedule?.length ? (
            <div className="space-y-3">
              {dashboard.upcomingReminderSchedule.map((job) => (
                <div key={job.id} className="rounded-lg border border-white/10 bg-white/[0.05] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-white">{job.ruleName}</p>
                      <p className="mt-1 text-sm text-[#d8c6e8]">
                        {job.frequency} at {formatTime(job.reminderTime)} ({job.timezone})
                      </p>
                    </div>
                    <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
                      {job.deliveryChannel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>No upcoming reminder jobs configured yet.</EmptyState>
          )}
        </section>
      </div>
    </section>
  );
}
