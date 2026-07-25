import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Bell,
  BellOff,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
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

const REMINDER_TYPE_LABELS = {
  renewal_due_7_days: "Renewal Due (7 days)",
  expires_today: "Expires Today",
  expired: "Expired",
  billing_today: "Billing Today",
  invoice_generation_failed: "Invoice Generation Failed",
  payment_failed: "Payment Failed",
  subscription_paused: "Paused",
  auto_renew_disabled: "Auto-Renew Disabled",
  incomplete_import: "Incomplete Import",
};

const priorityStyles = {
  High: "border-rose-400/30 bg-rose-500/15 text-rose-700",
  Medium: "border-amber-400/30 bg-amber-500/15 text-amber-700",
  Low: "border-slate-400/30 bg-slate-500/10 text-slate-600",
};

const statusStyles = {
  Active: "border-blue-400/30 bg-blue-500/15 text-blue-700",
  Completed: "border-emerald-400/30 bg-emerald-500/15 text-emerald-700",
  Dismissed: "border-slate-400/30 bg-slate-500/10 text-slate-600",
};

function formatDate(value) {
  if (!value) return "\u2014";
  return new Date(value).toLocaleDateString("en-SG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function FinanceRemindersPage() {
  const navigate = useNavigate();
  const [reminders, setReminders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortField, setSortField] = useState("reminder_date");
  const [sortDir, setSortDir] = useState("desc");
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

  useEffect(() => {
    loadData();
  }, [priorityFilter, typeFilter, statusFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 400);
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

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  // Client-side sort by due date
  const sortedReminders = useMemo(() => {
    const sorted = [...reminders];
    sorted.sort((a, b) => {
      const aVal = a[sortField] || "";
      const bVal = b[sortField] || "";
      if (sortDir === "asc") return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    });
    return sorted;
  }, [reminders, sortField, sortDir]);

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? (
      <ChevronUp className="inline h-3 w-3" />
    ) : (
      <ChevronDown className="inline h-3 w-3" />
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#251E1F]">Reminders</h2>
          <p className="text-sm text-[#6f4f47]">
            {summary
              ? `${summary.total_active} active reminder${summary.total_active !== 1 ? "s" : ""}`
              : "Loading..."}
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 rounded-lg bg-[#F38978] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#e07565] disabled:opacity-50"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh Reminders
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6f4f47]" />
          <input
            type="text"
            placeholder="Search by customer name or subscription ID..."
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
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-[#f2d5cc] bg-white px-3 py-2 text-sm"
          aria-label="Filter by reminder type"
        >
          <option value="">All Types</option>
          {REMINDER_TYPE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-[#f2d5cc] bg-white px-3 py-2 text-sm"
          aria-label="Filter by status"
        >
          <option value="">Active Only</option>
          <option value="Active">Active</option>
          <option value="Completed">Completed</option>
          <option value="Dismissed">Dismissed</option>
        </select>
      </div>

      {/* Reminders Table */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-[#F38978]" />
        </div>
      ) : sortedReminders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-400 mb-3" />
          <p className="text-sm font-medium text-[#251E1F]">No reminders found</p>
          <p className="text-xs text-[#6f4f47] mt-1">
            All subscription issues have been resolved.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#f2d5cc]/60 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#f2d5cc]/40 bg-[#fff8f5]">
                <th className="px-3 py-3 text-left font-semibold text-[#6f4f47]">
                  Reminder ID
                </th>
                <th className="px-3 py-3 text-left font-semibold text-[#6f4f47]">
                  Customer Name
                </th>
                <th className="px-3 py-3 text-center font-semibold text-[#6f4f47]">
                  Subscription ID
                </th>
                <th className="px-3 py-3 text-left font-semibold text-[#6f4f47]">
                  Reminder Type
                </th>
                <th
                  className="px-3 py-3 text-left font-semibold text-[#6f4f47] cursor-pointer select-none hover:text-[#F38978]"
                  onClick={() => toggleSort("reminder_date")}
                >
                  Due Date <SortIcon field="reminder_date" />
                </th>
                <th className="px-3 py-3 text-center font-semibold text-[#6f4f47]">
                  Priority
                </th>
                <th className="px-3 py-3 text-center font-semibold text-[#6f4f47]">
                  Status
                </th>
                <th className="px-3 py-3 text-right font-semibold text-[#6f4f47]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedReminders.map((reminder) => {
                const isProcessing = actionLoading === reminder.reminder_id;
                const isActive = reminder.status === "Active";

                return (
                  <tr
                    key={reminder.reminder_id}
                    className={`border-b border-[#f2d5cc]/20 transition ${
                      isActive ? "hover:bg-[#fff3ee]/50" : "opacity-60"
                    }`}
                  >
                    <td className="px-3 py-3 text-[#6f4f47] font-mono text-xs">
                      #{reminder.reminder_id}
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-medium text-[#251E1F]">
                        {reminder.customer_name || "\u2014"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="font-mono text-xs text-[#6f4f47]">
                        {reminder.subscription_id}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-sm text-[#251E1F]">
                        {REMINDER_TYPE_LABELS[reminder.reminder_type] ||
                          reminder.reminder_type}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-[#251E1F]">
                      {formatDate(reminder.reminder_date)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          priorityStyles[reminder.priority] || priorityStyles.Medium
                        }`}
                      >
                        {reminder.priority}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          statusStyles[reminder.status] || statusStyles.Active
                        }`}
                      >
                        {reminder.status === "Active" ? "Pending" : reminder.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        {/* View Subscription */}
                        <button
                          onClick={() =>
                            navigate(
                              `/dashboard/invoicing/finance/subscriptions/${reminder.subscription_id}`
                            )
                          }
                          className="rounded-lg border border-[#f2d5cc] px-2.5 py-1.5 text-xs font-medium text-[#6f4f47] hover:bg-[#FDD9CD]/30 hover:text-[#251E1F] transition"
                          title="View Subscription"
                        >
                          View
                        </button>
                        {/* Mark as Completed */}
                        {isActive && (
                          <button
                            onClick={() => handleComplete(reminder.reminder_id)}
                            disabled={isProcessing}
                            className="rounded-lg border border-emerald-400/30 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-500/10 transition disabled:opacity-50"
                            title="Mark as Completed"
                          >
                            {isProcessing ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="inline h-3 w-3 mr-1" />
                            )}
                            Complete
                          </button>
                        )}
                        {/* Dismiss */}
                        {isActive && (
                          <button
                            onClick={() => handleDismiss(reminder.reminder_id)}
                            disabled={isProcessing}
                            className="rounded-lg border border-slate-400/30 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-500/10 transition disabled:opacity-50"
                            title="Dismiss Reminder"
                          >
                            {isProcessing ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <XCircle className="inline h-3 w-3 mr-1" />
                            )}
                            Dismiss
                          </button>
                        )}
                      </div>
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
