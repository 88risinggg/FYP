/**
 * Send via WhatsApp Button
 *
 * Reusable button component that sends an invoice to the customer via WhatsApp.
 * Can be placed on Invoice List, Invoice Details, or Invoice Preview pages.
 * Handles loading state, success/error feedback, and optional PDF attachment.
 */

import { useState } from "react";
import { CheckCircle2, Loader2, MessageCircle, X } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

function getHeaders() {
  const token = localStorage.getItem("authToken");
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export default function SendWhatsAppButton({ invoiceId, size = "default", onSent }) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  async function handleSend() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp-notifications/send-invoice/${invoiceId}`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ send_pdf: true })
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, text: "Sent via WhatsApp" });
        if (onSent) onSent(data);
      } else {
        setResult({ success: false, text: data.message || data.error || "Failed" });
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
    <button
      type="button"
      onClick={handleSend}
      disabled={sending}
      className={`inline-flex items-center gap-2 rounded-lg border border-emerald-400/30 font-semibold text-emerald-700 transition hover:bg-emerald-500/10 disabled:opacity-50 ${
        isSmall ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-xs"
      }`}
    >
      {sending ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
      {isSmall ? "WhatsApp" : "Send via WhatsApp"}
    </button>
  );
}
