/**
 * WhatsApp Dashboard Widgets
 *
 * Renders stat cards and a recent notifications list for the Finance Dashboard.
 * Shows: Today's Messages, Successful Sends, Failed Sends, Pending Notifications,
 * and a compact list of recent notifications.
 */

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Loader2,
  MessageSquare,
  Send,
  XCircle
} from "lucide-react";
import { getWhatsAppDashboard } from "../../services/whatsappNotificationService.js";

const typeLabels = {
  invoice_created: "Invoice Created",
  payment_received: "Payment Received",
  payment_reminder: "Due Reminder",
  overdue_notice: "Overdue",
  subscription_invoice: "Subscription"
};

const statusColors = {
  sent: "text-emerald-600",
  failed: "text-rose-600",
  pending: "text-amber-600",
  retry: "text-blue-600"
};

export default function WhatsAppDashboardWidgets() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const result = await getWhatsAppDashboard();
      setData(result);
    } catch (err) {
      console.error("[WhatsApp Dashboard] Failed to load:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="app-panel rounded-2xl p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin text-emerald-500" size={24} />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { stats, recentLogs } = data;
  const todayTotal = (stats.today_sent || 0) + (stats.today_failed || 0) + (stats.today_pending || 0);

  function formatTime(dateStr) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <MessageSquare size={18} className="text-emerald-600" />
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">WhatsApp Notifications</h3>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<Send size={18} className="text-blue-600" />}
          label="Today's Messages"
          value={todayTotal}
          bgColor="bg-blue-50"
        />
        <StatCard
          icon={<CheckCircle2 size={18} className="text-emerald-600" />}
          label="Successful"
          value={stats.today_sent || 0}
          bgColor="bg-emerald-50"
        />
        <StatCard
          icon={<XCircle size={18} className="text-rose-600" />}
          label="Failed"
          value={stats.today_failed || 0}
          bgColor="bg-rose-50"
        />
        <StatCard
          icon={<Clock size={18} className="text-amber-600" />}
          label="Pending"
          value={stats.today_pending || 0}
          bgColor="bg-amber-50"
        />
      </div>

      {/* Recent Notifications */}
      {recentLogs && recentLogs.length > 0 && (
        <div className="app-panel rounded-xl p-4">
          <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-3">
            Recent Notifications
          </h4>
          <div className="space-y-2">
            {recentLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)] last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-xs font-medium ${statusColors[log.status] || "text-gray-600"}`}>
                    {log.status === "sent" ? "✓" : log.status === "failed" ? "✗" : "○"}
                  </span>
                  <span className="text-sm text-[var(--color-text-primary)] truncate">
                    {log.customer_name || "Unknown"}
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)] hidden sm:inline">
                    — {typeLabels[log.notification_type] || log.notification_type}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {log.invoice_number && (
                    <span className="text-xs text-[var(--color-text-secondary)] font-mono">
                      {log.invoice_number}
                    </span>
                  )}
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {formatTime(log.sent_at || log.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, bgColor }) {
  return (
    <div className={`rounded-xl p-3 ${bgColor} border border-[var(--color-border)]`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
      </div>
      <p className="text-xl font-bold text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}
