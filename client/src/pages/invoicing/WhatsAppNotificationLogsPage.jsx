/**
 * WhatsApp Notification Logs Page
 *
 * Displays a searchable, filterable, sortable, paginated table of all
 * WhatsApp notification logs. Accessible from the Finance sidebar.
 */

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Loader2,
  MessageSquare,
  RotateCcw,
  Search,
  XCircle
} from "lucide-react";
import { getWhatsAppLogs } from "../../services/whatsappNotificationService.js";

const typeLabels = {
  invoice_created: "Invoice Created",
  payment_received: "Payment Received",
  payment_reminder: "Due Reminder",
  overdue_notice: "Overdue Notice",
  subscription_invoice: "Subscription Invoice"
};

const statusStyles = {
  sent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  retry: "bg-blue-50 text-blue-700 border-blue-200"
};

const statusIcons = {
  sent: CheckCircle2,
  failed: XCircle,
  pending: Clock,
  retry: RotateCcw
};

export default function WhatsAppNotificationLogsPage() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 15,
    search: "",
    notification_type: "",
    status: "",
    sort_by: "created_at",
    sort_order: "DESC"
  });

  useEffect(() => {
    fetchLogs();
  }, [filters.page, filters.notification_type, filters.status, filters.sort_by, filters.sort_order]);

  async function fetchLogs() {
    setLoading(true);
    try {
      const result = await getWhatsAppLogs(filters);
      setLogs(result.logs || []);
      setTotal(result.total || 0);
      setTotalPages(result.totalPages || 0);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    setFilters((prev) => ({ ...prev, page: 1 }));
    fetchLogs();
  }

  function handleFilterChange(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  function handleSort(column) {
    setFilters((prev) => ({
      ...prev,
      sort_by: column,
      sort_order: prev.sort_by === column && prev.sort_order === "DESC" ? "ASC" : "DESC"
    }));
  }

  function formatDate(dateStr) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("en-SG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
          <MessageSquare size={20} className="text-emerald-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Notification History</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {total} total notification{total !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="app-panel rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <form onSubmit={handleSearch} className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder="Search customer, phone, invoice..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </form>

          {/* Type Filter */}
          <select
            value={filters.notification_type}
            onChange={(e) => handleFilterChange("notification_type", e.target.value)}
            className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            aria-label="Filter by notification type"
          >
            <option value="">All Types</option>
            <option value="invoice_created">Invoice Created</option>
            <option value="payment_received">Payment Received</option>
            <option value="payment_reminder">Due Reminder</option>
            <option value="overdue_notice">Overdue Notice</option>
            <option value="subscription_invoice">Subscription Invoice</option>
          </select>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange("status", e.target.value)}
            className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            aria-label="Filter by status"
          >
            <option value="">All Statuses</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
            <option value="retry">Retry</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="app-panel rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-[#F38978]" size={28} />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--color-text-secondary)]">
            <MessageSquare size={40} className="mb-3 opacity-40" />
            <p className="text-sm">No notification logs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <th className="text-left px-4 py-3 font-medium text-[var(--color-text-secondary)]">Customer</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--color-text-secondary)]">Invoice</th>
                  <th
                    className="text-left px-4 py-3 font-medium text-[var(--color-text-secondary)] cursor-pointer select-none hover:text-[var(--color-text-primary)]"
                    onClick={() => handleSort("notification_type")}
                  >
                    Type {filters.sort_by === "notification_type" && (filters.sort_order === "ASC" ? "↑" : "↓")}
                  </th>
                  <th
                    className="text-left px-4 py-3 font-medium text-[var(--color-text-secondary)] cursor-pointer select-none hover:text-[var(--color-text-primary)]"
                    onClick={() => handleSort("status")}
                  >
                    Status {filters.sort_by === "status" && (filters.sort_order === "ASC" ? "↑" : "↓")}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--color-text-secondary)]">Phone</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--color-text-secondary)]">Provider</th>
                  <th
                    className="text-left px-4 py-3 font-medium text-[var(--color-text-secondary)] cursor-pointer select-none hover:text-[var(--color-text-primary)]"
                    onClick={() => handleSort("sent_at")}
                  >
                    Sent At {filters.sort_by === "sent_at" && (filters.sort_order === "ASC" ? "↑" : "↓")}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--color-text-secondary)]">Error</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const StatusIcon = statusIcons[log.status] || Clock;
                  return (
                    <tr key={log.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]/50 transition">
                      <td className="px-4 py-3 text-[var(--color-text-primary)] font-medium">
                        {log.customer_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                        {log.invoice_number || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
                          {typeLabels[log.notification_type] || log.notification_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium ${statusStyles[log.status] || ""}`}>
                          <StatusIcon size={12} />
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)] font-mono text-xs">
                        {log.phone_number || "—"}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs">
                        {log.provider || "—"}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs">
                        {formatDate(log.sent_at)}
                      </td>
                      <td className="px-4 py-3 text-rose-600 text-xs max-w-[200px] truncate" title={log.error_message || ""}>
                        {log.error_message || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)]">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Page {filters.page} of {totalPages} ({total} results)
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
                disabled={filters.page <= 1}
                className="p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] disabled:opacity-40 transition"
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
                disabled={filters.page >= totalPages}
                className="p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] disabled:opacity-40 transition"
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
