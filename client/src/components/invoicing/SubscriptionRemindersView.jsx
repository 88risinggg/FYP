import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  BellOff,
  CalendarClock,
  Check,
  CheckCircle2,
  CreditCard,
  Filter,
  Loader2,
  Pause,
  RefreshCw,
  Search,
  XCircle,
  Zap,
} from "lucide-react";

import {
  fetchSubscriptionReminders,
  fetchReminderSummary,
  markReminderComplete,
  dismissReminder,
  triggerReminderGeneration,
} from "../../services/subscriptionReminderService.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_OPTIONS = ["High", "Medium", "Low"];
const STATUS_OPTIONS = ["Active", "Completed", "Dismissed"];

const REMINDER_TYPE_OPTIONS = [
  { value: "renewal_due_7_days", label: "Renewal Due (7 days)" },
  { value: "expires_today", label: "Expires Today" },
  { value: "expired", label: "Expired" },
  { value: "billing_today", label: "Billing Today" },
  { value: "invoice_generation_failed", label: "Invoice Generation Failed" },
  { value: "payment_failed", label: "Payment Failed" },
  { value: "subscription_paused", label: "Paused" },
  { value: "auto_renew_disabled", label: "Auto-Renew Disabled" },
  { value: "incomplete_import", label: "Incomplete Import" },
];

const priorityStyles = {
  High: "border-rose-400/30 bg-rose-500/15 text-rose-700",
  Medium: "border-amber-400/30 bg-amber-500/15 text-amber-700",
  Low: "border-slate-400/30 bg-slate-500/10 text-slate-600",
};

const priorityIcons = {
  High: AlertCircle,
  Medium: Bell,
  Low: CalendarClock,
};

const reminderTypeIcons = {
  renewal_due_7_days: CalendarClock,
  expires_today: AlertCircle,
  expired: XCircle,
  billing_today: CreditCard,
  invoice_generation_failed: Zap,
  payment_failed: CreditCard,
  subscription_paused: Pause,
  auto_renew_disabled: BellOff,
  incomplete_import: AlertCircle,
};

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-SG", { year: "numeric", month: "short", day: "numeric" });
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function SubscriptionRemindersView() {
  const navigate = useNavigate();
  const [reminders, setReminders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const filters = {};
      if (priorityFilter) filters.priority = priorityFilter;
      if (typeFilter) filters.reminderType = typeFilter;
      if (statusFilter) filters.status = statusFilter;
      if (search.trim()) filters.search = search.trim();

      const [remindersData, summaryData] = await Promise.all([
        fetchSubscriptionReminders(filters),
        fetchReminderSummary(),
      ]);
      setReminders(remindersData.reminders || []);
      setSummary(summaryData);
    } catch {
      setReminders([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [priorityFilter, typeFilter, statusFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => { loadData(); }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const handleComplete = async (reminderId) => {
    setActionLoading(reminderId);
    try {
      await markReminderComplete(reminderId);
      await loadData();
    } catch (err) {
      alert(err.message || "Failed to complete reminder.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDismiss = async (reminderId) => {
    setActionLoading(reminderId);
    try {
      await dismissReminder(reminderId);
      await loadData();
    } catch (err) {
      alert(err.message || "Failed to dismiss reminder.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await triggerReminderGeneration();
      alert(result.message || "Reminders generated.");
      await loadData();
    } catch (err) {
      alert(err.message || "Failed to generate reminders.");
    } finally {
      setGenerating(false);
    }
  };

  const summaryCards = summary
    ? [
        { label: "Renewals Due Today", value: summary.renewals_due_today, icon: CalendarClock, color: "text-amber-600" },
        { label: "Renewals This Week", value: summary.renewals_due_this_week, icon: CalendarClock, color: "text-blue-600" },
        { label: "Expired Subscriptions", value: summary.expired_subscriptions, icon: XCircle, color: "text-rose-600" },
        { label: "Failed Invoices", value: summary.failed_invoice_generations, icon: Zap, color: "text-red-600" },
        { label: "Failed Payments", value: summary.failed_payments, icon: CreditCard, color: "text-rose-700" },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard/invoicing/finance/subscriptions/dashboard")}
            className="rounded-lg p-1.5 hover:bg-[#FDD9CD]/40"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5 text-[#6f4f47]" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-[#251E1F]">Subscription Reminders</h2>
            <p className="text-sm text-[#6f4f47]">
              {summary ? `${summary.total_active} active reminder${summary.total_active !== 1 ? "s" : ""}` : "Loading..."}
            </p>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 rounded-lg bg-[#F38978] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#e07565] disabled:opacity-50"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh Reminders
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {summaryCards.map((card) => (
            <div key={card.label} className="rounded-xl border border-[#f2d5cc]/60 bg-white/80 p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <card.icon className={`h-4 w-4 ${card.color}`} />
                <span className="text-xs font-semibold uppercase tracking-wide text-[#6f4f47]">{card.label}</span>
              </div>
              <p className="mt-1 text-xl font-bold text-[#251E1F]">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6f4f47]" />
          <input
            type="text"
            placeholder="Search by customer or subscription ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[#f2d5cc] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#F38978]/40"
          />
        </div>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-[#f2d5cc] bg-white px-3 py-2 text-sm"
          aria-label="Filter by priority"
        >
          <option value="">All Priorities</option>
          {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-[#f2d5cc] bg-white px-3 py-2 text-sm"
          aria-label="Filter by reminder type"
        >
          <option value="">All Types</option>
          {REMINDER_TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-[#f2d5cc] bg-white px-3 py-2 text-sm"
          aria-label="Filter by status"
        >
          <option value="">Active Only</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Reminders Table */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-[#F38978]" />
        </div>
      ) : reminders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-400 mb-3" />
          <p className="text-sm font-medium text-[#251E1F]">No reminders found</p>
          <p className="text-xs text-[#6f4f47] mt-1">All subscription issues have been resolved.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#f2d5cc]/60 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#f2d5cc]/40 bg-[#fff8f5]">
                <th className="px-3 py-3 text-left font-semibold text-[#6f4f47]">Customer</th>
                <th className="px-3 py-3 text-left font-semibold text-[#6f4f47]">Company</th>
                <th className="px-3 py-3 text-center font-semibold text-[#6f4f47]">Sub ID</th>
                <th className="px-3 py-3 text-left font-semibold text-[#6f4f47]">Reminder Type</th>
                <th className="px-3 py-3 text-left font-semibold text-[#6f4f47]">Date</th>
                <th className="px-3 py-3 text-center font-semibold text-[#6f4f47]">Priority</th>
                <th className="px-3 py-3 text-right font-semibold text-[#6f4f47]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reminders.map((reminder) => {
                const TypeIcon = reminderTypeIcons[reminder.reminder_type] || Bell;
                const isProcessing = actionLoading === reminder.reminder_id;

                return (
                  <tr
                    key={reminder.reminder_id}
                    className={`border-b border-[#f2d5cc]/20 transition ${
                      reminder.status === "Active" ? "hover:bg-[#fff3ee]/50" : "opacity-60"
                    }`}
                  >
                    <td className="px-3 py-3">
                      <button
                        onClick={() => navigate(`/dashboard/invoicing/finance/subscriptions/${reminder.subscription_id}`)}
                        className="font-medium text-[#251E1F] hover:text-[#F38978] hover:underline text-left"
                      >
                        {reminder.customer_name || "—"}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-[#6f4f47]">{reminder.company_name || "—"}</td>
                    <td className="px-3 py-3 text-center text-[#6f4f47]">#{reminder.subscription_id}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-4 w-4 text-[#6f4f47]" />
                        <span className="text-[#251E1F]">{reminder.reminder_type_label}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[#6f4f47]">{formatDate(reminder.reminder_date)}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${priorityStyles[reminder.priority] || ""}`}>
                        {reminder.priority}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {reminder.status === "Active" && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleComplete(reminder.reminder_id)}
                            disabled={isProcessing}
                            title="Mark as completed"
                            className="rounded p-1.5 hover:bg-emerald-100 disabled:opacity-50"
                          >
                            {isProcessing ? (
                              <Loader2 className="h-4 w-4 animate-spin text-[#6f4f47]" />
                            ) : (
                              <Check className="h-4 w-4 text-emerald-600" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDismiss(reminder.reminder_id)}
                            disabled={isProcessing}
                            title="Dismiss"
                            className="rounded p-1.5 hover:bg-rose-100 disabled:opacity-50"
                          >
                            <XCircle className="h-4 w-4 text-rose-500" />
                          </button>
                        </div>
                      )}
                      {reminder.status === "Completed" && (
                        <span className="text-xs text-emerald-600 font-medium">Completed</span>
                      )}
                      {reminder.status === "Dismissed" && (
                        <span className="text-xs text-slate-500 font-medium">Dismissed</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
