/**
 * WhatsApp Communication History
 *
 * Displays WhatsApp notification history for a specific invoice.
 * Shows message type, status, delivery tracking, timestamps, and errors.
 * Used within the InvoiceDetailsModal or as a standalone section.
 */

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  MessageCircle,
  Phone,
  RefreshCw,
  Send,
  X
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

function getHeaders() {
  const token = localStorage.getItem("authToken");
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-SG", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

const statusConfig = {
  queued: { color: "border-slate-400/30 bg-slate-500/10 text-slate-600", icon: Clock },
  sent: { color: "border-blue-400/30 bg-blue-500/10 text-blue-700", icon: Send },
  delivered: { color: "border-emerald-400/30 bg-emerald-500/10 text-emerald-700", icon: CheckCircle2 },
  read: { color: "border-emerald-400/30 bg-emerald-500/15 text-emerald-700", icon: Eye },
  failed: { color: "border-rose-400/30 bg-rose-500/10 text-rose-700", icon: X },
  undelivered: { color: "border-rose-400/30 bg-rose-500/10 text-rose-700", icon: AlertCircle },
  pending: { color: "border-amber-400/30 bg-amber-500/10 text-amber-700", icon: Clock }
};

export default function WhatsAppCommunicationHistory({ invoiceId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (invoiceId) loadHistory();
  }, [invoiceId]);

  async function loadHistory() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp-notifications/history/${invoiceId}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      } else {
        const data = await res.json();
        setError(data.message || "Failed to load history.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!invoiceId) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-6 text-sm text-[#7b6660]">
        <Loader2 size={16} className="animate-spin" /> Loading communication history...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#f0d2ca] px-4 py-6 text-center text-sm text-[#7b6660]">
        <MessageCircle size={20} className="mx-auto mb-2 text-[#7b6660]/50" />
        No WhatsApp messages sent for this invoice yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-[#F38978] flex items-center gap-2">
          <MessageCircle size={13} />
          WhatsApp History ({logs.length})
        </h4>
        <button
          type="button"
          onClick={loadHistory}
          className="rounded-md p-1.5 text-[#7b6660] hover:bg-[#FDD9CD]/30 hover:text-[#251E1F]"
          aria-label="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="space-y-2">
        {logs.map((log) => {
          const config = statusConfig[log.status] || statusConfig[log.delivery_status] || statusConfig.pending;
          const StatusIcon = config.icon;

          return (
            <div key={log.id} className="rounded-lg border border-[#f0d2ca] bg-[#fff8f5] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${config.color}`}>
                    <StatusIcon size={11} />
                    {log.delivery_status || log.status}
                  </span>
                  <span className="rounded-full bg-[#FDD9CD]/30 px-2 py-0.5 text-xs font-medium text-[#7b6660]">
                    {(log.notification_type || "").replace(/_/g, " ")}
                  </span>
                </div>
                <span className="text-xs text-[#7b6660]">{formatDateTime(log.sent_at || log.created_at)}</span>
              </div>

              <div className="mt-2 flex items-center gap-3 text-xs text-[#7b6660]">
                <span className="flex items-center gap-1"><Phone size={11} /> {log.phone_number || "-"}</span>
                {log.message_id && <span className="truncate max-w-[180px] font-mono">SID: {log.message_id}</span>}
              </div>

              {log.delivered_at && (
                <p className="mt-1 text-xs text-emerald-600">Delivered: {formatDateTime(log.delivered_at)}</p>
              )}
              {log.read_at && (
                <p className="text-xs text-emerald-600">Read: {formatDateTime(log.read_at)}</p>
              )}
              {log.error_message && (
                <p className="mt-1 text-xs text-rose-600">Error: {log.error_message}</p>
              )}
              {log.retry_count > 0 && (
                <p className="mt-1 text-xs text-amber-600">Retries: {log.retry_count}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
