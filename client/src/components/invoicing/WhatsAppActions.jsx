/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - SHARED
 * PURPOSE: Implements the reusable Whats App Actions interface component.
 * LAYER: Frontend component - provides reusable interface and interaction logic.
 * FIND RELATED CODE: Use Find All References to locate the pages that render this component.
 */
/**
 * WhatsApp Actions Component (Finance)
 *
 * Provides WhatsApp action buttons for the Invoice module:
 *   - Send Invoice via WhatsApp
 *   - Send Payment Reminder
 *   - Send Overdue Notification
 *   - Send Payment Confirmation
 *   - View Message Delivery Status
 *   - Resend Failed Messages
 *
 * Used in: Invoice List, Invoice Details, Customer Invoice View
 */

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  X
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

function getHeaders() {
  const token = sessionStorage.getItem("authToken");
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

const statusConfig = {
  queued: { color: "border-slate-400/30 bg-slate-500/10 text-slate-600", icon: Clock, label: "Queued" },
  sent: { color: "border-blue-400/30 bg-blue-500/10 text-blue-700", icon: Send, label: "Sent" },
  delivered: { color: "border-emerald-400/30 bg-emerald-500/10 text-emerald-700", icon: CheckCircle2, label: "Delivered" },
  read: { color: "border-emerald-400/30 bg-emerald-500/15 text-emerald-700", icon: Eye, label: "Read" },
  failed: { color: "border-rose-400/30 bg-rose-500/10 text-rose-700", icon: X, label: "Failed" }
};

/**
 * Send WhatsApp Button — sends an invoice via WhatsApp.
 * Can be placed on Invoice List or Invoice Details.
 */
export function SendWhatsAppButton({ invoiceId, size = "default", onSent }) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  async function handleSend() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/finance/send-invoice/${invoiceId}`, {
        method: "POST",
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, text: "Sent via WhatsApp" });
        if (onSent) onSent(data);
      } else {
        setResult({ success: false, text: data.error || data.message || "Failed" });
      }
    } catch (err) {
      setResult({ success: false, text: err.message });
    } finally {
      setSending(false);
      setTimeout(() => setResult(null), 4000);
    }
  }

  const isSmall = size === "small";

  if (result) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold ${
        result.success
          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-700"
          : "border-rose-400/30 bg-rose-500/10 text-rose-700"
      }`}>
        {result.success ? <CheckCircle2 size={13} /> : <X size={13} />}
        {result.text}
      </span>
    );
  }

  return (
    <button type="button" onClick={handleSend} disabled={sending}
      className={`inline-flex items-center gap-2 rounded-lg border border-emerald-400/30 font-semibold text-emerald-700 transition hover:bg-emerald-500/10 disabled:opacity-50 ${
        isSmall ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-xs"
      }`}>
      {sending ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
      {isSmall ? "WhatsApp" : "Send via WhatsApp"}
    </button>
  );
}

/**
 * WhatsApp Invoice Actions Panel — shown in Invoice Details.
 * Shows: Send Invoice, Send Reminder, Send Overdue, Send Confirmation,
 *        Delivery Status, Resend Failed.
 */
export function WhatsAppInvoiceActions({ invoiceId, invoiceStatus }) {
  const [sending, setSending] = useState("");
  const [message, setMessage] = useState(null);

  async function handleAction(action) {
    setSending(action);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/finance/${action}/${invoiceId}`, {
        method: "POST",
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: data.message || "Sent successfully." });
      } else {
        setMessage({ type: "error", text: data.error || data.message || "Failed to send." });
      }
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSending("");
      setTimeout(() => setMessage(null), 5000);
    }
  }

  const actions = [
    { key: "send-invoice", label: "Send Invoice", icon: Send, show: true },
    { key: "send-reminder", label: "Send Reminder", icon: Clock, show: ["Sent", "Viewed", "Overdue"].includes(invoiceStatus) },
    { key: "send-overdue", label: "Overdue Notice", icon: AlertCircle, show: invoiceStatus === "Overdue" },
    { key: "send-confirmation", label: "Payment Confirmation", icon: CheckCircle2, show: invoiceStatus === "Paid" }
  ];

  return (
    <div className="space-y-3">
      {message && (
        <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${
          message.type === "error"
            ? "border-rose-400/30 bg-rose-500/10 text-rose-700"
            : "border-emerald-400/30 bg-emerald-500/10 text-emerald-700"
        }`}>
          {message.text}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {actions.filter((a) => a.show).map((action) => {
          const Icon = action.icon;
          const isActive = sending === action.key;
          return (
            <button key={action.key} type="button" onClick={() => handleAction(action.key)} disabled={Boolean(sending)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/10 disabled:opacity-50">
              {isActive ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
              {action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * WhatsApp Communication History — shows message history for an invoice.
 * Displays: message type, status, delivery tracking, timestamps.
 */
export function WhatsAppHistory({ invoiceId }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useState(() => {
    if (invoiceId) loadHistory();
  }, [invoiceId]);

  async function loadHistory() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/finance/history/${invoiceId}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
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

  async function handleResend(messageId) {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/finance/resend/${messageId}`, {
        method: "POST",
        headers: getHeaders()
      });
      if (res.ok) { loadHistory(); }
    } catch { /* non-critical */ }
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
      <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">{error}</div>
    );
  }

  if (messages.length === 0) {
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
          <MessageCircle size={13} /> WhatsApp History ({messages.length})
        </h4>
        <button type="button" onClick={loadHistory}
          className="rounded-md p-1.5 text-[#7b6660] hover:bg-[#FDD9CD]/30 hover:text-[#251E1F]" aria-label="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>
      <div className="space-y-2">
        {messages.map((msg) => {
          const cfg = statusConfig[msg.status] || statusConfig.queued;
          const StatusIcon = cfg.icon;
          return (
            <div key={msg.id} className="rounded-lg border border-[#f0d2ca] bg-[#fff8f5] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${cfg.color}`}>
                    <StatusIcon size={11} /> {cfg.label}
                  </span>
                  <span className="rounded-full bg-[#FDD9CD]/30 px-2 py-0.5 text-xs font-medium text-[#7b6660]">
                    {(msg.message_type || "").replace(/_/g, " ")}
                  </span>
                </div>
                <span className="text-xs text-[#7b6660]">
                  {msg.sent_at ? new Date(msg.sent_at).toLocaleString("en-SG", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-"}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-[#7b6660]">
                <span className="flex items-center gap-1">{msg.recipient_phone || "-"}</span>
                {msg.twilio_message_sid && <span className="truncate max-w-[160px] font-mono">SID: {msg.twilio_message_sid}</span>}
              </div>
              {msg.delivered_at && <p className="mt-1 text-xs text-emerald-600">Delivered: {new Date(msg.delivered_at).toLocaleString("en-SG")}</p>}
              {msg.read_at && <p className="text-xs text-emerald-600">Read: {new Date(msg.read_at).toLocaleString("en-SG")}</p>}
              {msg.error_message && <p className="mt-1 text-xs text-rose-600">{msg.error_message}</p>}
              {msg.status === "failed" && msg.retry_count < 3 && (
                <button type="button" onClick={() => handleResend(msg.id)}
                  className="mt-2 inline-flex items-center gap-1 rounded-md border border-amber-400/30 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-500/10">
                  <RefreshCw size={11} /> Retry
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
