/**
 * Finance Reminders View
 *
 * Unified reminder module for Finance users covering:
 * - Invoice due within 7 days
 * - Invoice due today
 * - Invoice overdue
 * - Payment failed
 * - Payment succeeded
 * - Subscription renewal due
 * - Invoice generation failed
 * - Bulk upload validation errors
 *
 * Supports filtering, searching, mark as completed, and dismiss.
 */

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bell,
  BellOff,
  CalendarClock,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Loader2,
  Search,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import {
  fetchFinanceReminders,
  fetchFinanceReminderSummary,
  completeReminder,
  dismissReminder,
} from "../../services/financeReminderService.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const REMINDER_TYPE_LABELS = {
  invoice_due_7_days: "Invoice due within 7 days",
  invoice_due_today: "Invoice due today",
  invoice_overdue: "Invoice overdue",
  payment_failed: "Payment failed",
  payment_succeeded: "Payment received",
  subscription_renewal_due: "Subscription renewal approaching",
  invoice_generation_failed: "Invoice generation failed",
  bulk_upload_validation_error: "Bulk upload validation error",
};

const REMINDER_TYPE_ICONS = {
  invoice_due_7_days: CalendarClock,
  invoice_due_today: Clock,
  invoice_overdue: AlertCircle,
  payment_failed: XCircle,
  payment_succeeded: CreditCard,
  subscription_renewal_due: CalendarClock,
  invoice_generation_failed: ShieldAlert,
  bulk_upload_validation_error: FileText,
};

const PRIORITY_STYLES = {
  High: "border-rose-400/30 bg-rose-500/10 text-rose-700",
  Medium: "border-amber-400/30 bg-amber-500/10 text-amber-700",
  Low: "border-emerald-400/30 bg-emerald-500/10 text-emerald-700",
};

const STATUS_FILTERS = ["Active", "Completed", "Dismissed"];
const PRIORITY_FILTERS = ["High", "Medium", "Low"];
const TYPE_FILTERS = Object.keys(REMINDER_TYPE_LABELS);

function formatCurrency(value) {
  if (!value) return "";
  return new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(Number(value));
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-SG", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-SG", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function FinanceRemindersView() {
  const [reminders, setReminders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Active");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const filters = {};
      if (statusFilter) filters.status = statusFilter;
      if (priorityFilter) filters.priority = priorityFilter;
      if (typeFilter) filters.type = typeFilter;
      if (search.trim()) filters.search = search.trim();

      const [reminderData, summaryData] = await Promise.all([
        fetchFinanceReminders(filters),
        fetchFinanceReminderSummary(),
      ]);

      setReminders(reminderData.reminders || []);
      setSummary(summaryData);
    } catch (err) {
      setError(err.message || "Failed to load reminders.");
      setReminders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, priorityFilter, typeFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return reminders;
    const q = search.toLowerCase();
    return reminders.filter(
      (r) =>
        r.customer_name?.toLowerCase().includes(q) ||
        r.invoice_number?.toLowerCase().includes(q) ||
        r.title?.toLowerCase().includes(q) ||
        r.message?.toLowerCase().includes(q)
    );
  }, [reminders, search]);

  const handleComplete = async (reminderId) => {
    setActionLoading(reminderId);
    try {
      await completeReminder(reminderId);
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to complete reminder.");
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
      setError(err.message || "Failed to dismiss reminder.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#251E1F]">Finance Reminders</h2>
          <p className="text-sm text-[#6f4f47]">Manage invoice and subscription reminders</p>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <SummaryCard label="Total Active" value={summary.total_active} color="text-[#251E1F]" />
          <SummaryCard label="High Priority" value={summary.high_priority} color="text-rose-700" />
          <SummaryCard label="Overdue" value={summary.overdue_count} color="text-rose-700" />
          <SummaryCard label="Due Today" value={summary.due_today_count} color="text-amber-700" />
          <SummaryCard label="Due Soon" value={summary.due_soon_count} color="text-blue-700" />
          <SummaryCard label="Payment Failed" value={summary.payment_failed_count} color="text-rose-600" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6f4f47]" />
          <input
            type="text"
            placeholder="Search reminders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadData()}
            className="w-full rounded-lg border border-[#f2d5cc] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#F38978]/40"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-[#f2d5cc] bg-white px-3 py-2 text-sm"
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-[#f2d5cc] bg-white px-3 py-2 text-sm"
          aria-label="Filter by priority"
        >
          <option value="">All Priorities</option>
          {PRIORITY_FILTERS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-[#f2d5cc] bg-white px-3 py-2 text-sm"
          aria-label="Filter by type"
        >
          <option value="">All Types</option>
          {TYPE_FILTERS.map((t) => (
            <option key={t} value={t}>{REMINDER_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* Reminder List */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-[#F38978]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#f2d5cc] bg-[#fff8f5] p-10 text-center">
          <Bell className="mx-auto h-10 w-10 text-[#f2d5cc]" />
          <p className="mt-3 text-sm text-[#6f4f47]">
            {statusFilter === "Active" ? "No active reminders. All caught up!" : "No reminders match the current filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((reminder) => (
            <ReminderCard
              key={reminder.reminder_id}
              reminder={reminder}
              onComplete={handleComplete}
              onDismiss={handleDismiss}
              isLoading={actionLoading === reminder.reminder_id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({ label, value, color }) {
  return (
    <div className="rounded-xl border border-[#f2d5cc]/60 bg-white/80 p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#6f4f47]">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value || 0}</p>
    </div>
  );
}

function ReminderCard({ reminder, onComplete, onDismiss, isLoading }) {
  const Icon = REMINDER_TYPE_ICONS[reminder.reminder_type] || Bell;
  const priorityStyle = PRIORITY_STYLES[reminder.priority] || PRIORITY_STYLES.Medium;
  const isActive = reminder.status === "Active";

  return (
    <div className={`rounded-xl border p-4 transition ${
      isActive
        ? "border-[#f2d5cc]/60 bg-white shadow-sm hover:shadow-md"
        : "border-[#f2d5cc]/30 bg-[#fafafa] opacity-70"
    }`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          reminder.priority === "High" ? "bg-rose-100 text-rose-600" :
          reminder.priority === "Medium" ? "bg-amber-100 text-amber-600" :
          "bg-emerald-100 text-emerald-600"
        }`}>
          <Icon className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-[#251E1F] truncate">{reminder.title}</p>
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${priorityStyle}`}>
              {reminder.priority}
            </span>
            {reminder.status !== "Active" && (
              <span className="inline-flex rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                {reminder.status}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[#6f4f47] line-clamp-2">{reminder.message}</p>

          {/* Metadata row */}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#6f4f47]/80">
            {reminder.customer_name && (
              <span className="font-medium">{reminder.customer_name}</span>
            )}
            {reminder.invoice_number && (
              <span className="rounded bg-[#EAF2FF] px-1.5 py-0.5 font-mono text-[10px] text-[#3269A8]">
                {reminder.invoice_number}
              </span>
            )}
            {reminder.amount && (
              <span className="font-semibold text-[#251E1F]">{formatCurrency(reminder.amount)}</span>
            )}
            {reminder.due_date && (
              <span>Due: {formatDate(reminder.due_date)}</span>
            )}
            <span className="text-[#6f4f47]/50">{formatDateTime(reminder.created_at)}</span>
          </div>

          {/* Resolved info */}
          {reminder.resolved_at && (
            <p className="mt-1 text-xs text-[#6f4f47]/60">
              Resolved: {formatDateTime(reminder.resolved_at)}
              {reminder.notes && ` — ${reminder.notes}`}
            </p>
          )}
        </div>

        {/* Actions */}
        {isActive && (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={() => onComplete(reminder.reminder_id)}
              disabled={isLoading}
              title="Mark as completed"
              className="rounded-lg border border-emerald-300 p-1.5 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 transition"
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => onDismiss(reminder.reminder_id)}
              disabled={isLoading}
              title="Dismiss"
              className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
            >
              <BellOff className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
