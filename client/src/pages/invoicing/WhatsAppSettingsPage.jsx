/**
 * WhatsApp Settings Page
 *
 * Finance → Invoice → WhatsApp
 * Configuration UI for WhatsApp integration via Twilio.
 * Allows enabling/disabling, testing connection, configuring auto-send options,
 * and managing default country code and PDF attachment preferences.
 */

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  FileText,
  Loader2,
  MessageCircle,
  Phone,
  Save,
  Send,
  Settings2,
  ToggleLeft,
  ToggleRight,
  Wifi,
  WifiOff,
  X
} from "lucide-react";
import WhatsAppTemplateManager from "../../components/invoicing/WhatsAppTemplateManager.jsx";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

function getHeaders() {
  const token = localStorage.getItem("authToken");
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-[#F38978]" : "bg-[#ead3cc]"
      }`}
      role="switch"
      aria-checked={checked}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

export default function WhatsAppSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [message, setMessage] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    loadSettings();
    loadDashboard();
  }, []);

  async function loadSettings() {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp-notifications/settings`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error("Failed to load WhatsApp settings:", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadDashboard() {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp-notifications/dashboard`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDashboard(data);
      }
    } catch { /* non-critical */ }
  }

  async function saveSettings() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp-notifications/settings`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Settings saved successfully." });
        if (data.settings) setSettings(data.settings);
      } else {
        setMessage({ type: "error", text: data.message || "Failed to save settings." });
      }
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp-notifications/test-connection`, {
        method: "POST",
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setConnectionStatus({ success: true, accountName: data.accountName, status: data.status });
      } else {
        setConnectionStatus({ success: false, error: data.error || data.message });
      }
    } catch (err) {
      setConnectionStatus({ success: false, error: err.message });
    } finally {
      setTestingConnection(false);
    }
  }

  async function handleSendTest() {
    if (!testPhone.trim()) {
      setMessage({ type: "error", text: "Enter a phone number to test." });
      return;
    }
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp-notifications/test`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ phone: testPhone.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: `Test message sent! Provider: ${data.provider}` });
      } else {
        setMessage({ type: "error", text: data.error || data.message || "Test failed." });
      }
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setTesting(false);
    }
  }

  function updateSetting(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-xl border border-[#f0d2ca] px-5 py-16 text-[#7b6660]">
        <Loader2 size={20} className="animate-spin" />
        Loading WhatsApp settings...
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#F38978]/80">WhatsApp Integration</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#251E1F]">WhatsApp Settings</h2>
          <p className="mt-1 text-sm text-[#7b6660]">Configure Twilio WhatsApp notifications for invoices, payments, and subscriptions.</p>
        </div>
        <button
          type="button"
          onClick={saveSettings}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-[#F38978] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#F38978]/30 transition hover:bg-[#e87562] disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save Settings
        </button>
      </div>

      {/* Messages */}
      {message && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${
          message.type === "error"
            ? "border-rose-400/30 bg-rose-500/10 text-rose-700"
            : "border-emerald-400/30 bg-emerald-500/10 text-emerald-700"
        }`}>
          <div className="flex items-center gap-2">
            {message.type === "error" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            {message.text}
          </div>
        </div>
      )}

      {/* Dashboard Stats */}
      {dashboard?.stats && (
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-[#f0d2ca] bg-white p-4">
            <p className="text-xs font-bold uppercase text-[#7b6660]">Today Sent</p>
            <p className="mt-2 text-2xl font-bold text-[#251E1F]">{dashboard.stats.today_sent}</p>
          </div>
          <div className="rounded-xl border border-[#f0d2ca] bg-white p-4">
            <p className="text-xs font-bold uppercase text-[#7b6660]">Today Failed</p>
            <p className="mt-2 text-2xl font-bold text-rose-700">{dashboard.stats.today_failed}</p>
          </div>
          <div className="rounded-xl border border-[#f0d2ca] bg-white p-4">
            <p className="text-xs font-bold uppercase text-[#7b6660]">Pending</p>
            <p className="mt-2 text-2xl font-bold text-amber-700">{dashboard.stats.today_pending}</p>
          </div>
          <div className="rounded-xl border border-[#f0d2ca] bg-white p-4">
            <p className="text-xs font-bold uppercase text-[#7b6660]">Total Sent</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">{dashboard.stats.total_sent}</p>
          </div>
        </div>
      )}

      {/* Connection & Enable/Disable */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Enable/Disable WhatsApp */}
        <div className="rounded-xl border border-[#f0d2ca] bg-white p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F38978]/12 text-[#F38978]">
              <MessageCircle size={20} />
            </div>
            <h3 className="text-base font-bold text-[#251E1F]">WhatsApp Notifications</h3>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-[#ead3cc] bg-[#fff8f5] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[#251E1F]">Enable WhatsApp</p>
              <p className="text-xs text-[#7b6660]">Send notifications via WhatsApp to customers</p>
            </div>
            <Toggle
              checked={Boolean(settings?.whatsapp_enabled)}
              onChange={(val) => updateSetting("whatsapp_enabled", val)}
            />
          </div>

          <div className="mt-4 rounded-lg border border-[#ead3cc] bg-[#fff8f5] px-4 py-3">
            <p className="text-xs font-bold uppercase text-[#7b6660] mb-2">Default Country Code</p>
            <input
              type="text"
              value={settings?.default_country_code || "+65"}
              onChange={(e) => updateSetting("default_country_code", e.target.value)}
              placeholder="+65"
              className="w-24 rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#F38978]"
            />
          </div>
        </div>

        {/* Test Connection */}
        <div className="rounded-xl border border-[#f0d2ca] bg-white p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F38978]/12 text-[#F38978]">
              <Wifi size={20} />
            </div>
            <h3 className="text-base font-bold text-[#251E1F]">Connection Test</h3>
          </div>

          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testingConnection}
            className="w-full rounded-lg border border-[#F38978]/30 bg-[#FDD9CD]/20 px-4 py-3 text-sm font-semibold text-[#251E1F] transition hover:bg-[#FDD9CD]/40 disabled:opacity-50"
          >
            {testingConnection ? (
              <span className="flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" /> Testing...</span>
            ) : (
              <span className="flex items-center justify-center gap-2"><Wifi size={15} /> Test Twilio Connection</span>
            )}
          </button>

          {connectionStatus && (
            <div className={`mt-3 rounded-lg border px-4 py-3 text-sm ${
              connectionStatus.success
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-700"
                : "border-rose-400/30 bg-rose-500/10 text-rose-700"
            }`}>
              {connectionStatus.success ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>Connected: {connectionStatus.accountName} ({connectionStatus.status})</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <WifiOff size={16} />
                  <span>Failed: {connectionStatus.error}</span>
                </div>
              )}
            </div>
          )}

          <div className="mt-4">
            <p className="text-xs font-bold uppercase text-[#7b6660] mb-2">Send Test Message</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+6591234567"
                className="flex-1 rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none placeholder:text-[#7b6660]/60 focus:border-[#F38978]"
              />
              <button
                type="button"
                onClick={handleSendTest}
                disabled={testing}
                className="rounded-lg bg-[#F38978] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e87562] disabled:opacity-50"
              >
                {testing ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Toggles */}
      <div className="rounded-xl border border-[#f0d2ca] bg-white p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F38978]/12 text-[#F38978]">
            <Bell size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#251E1F]">Notification Events</h3>
            <p className="text-xs text-[#7b6660]">Choose which events trigger WhatsApp notifications</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { key: "send_invoice_created", label: "Invoice Created", desc: "When a new invoice is generated" },
            { key: "send_payment_received", label: "Payment Received", desc: "When payment is confirmed" },
            { key: "send_payment_reminder", label: "Payment Reminder", desc: "Automated due date reminders" },
            { key: "send_overdue_notice", label: "Overdue Notice", desc: "When invoice is past due date" },
            { key: "send_subscription_invoice", label: "Subscription Billing", desc: "Subscription lifecycle notifications" }
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between rounded-lg border border-[#ead3cc] bg-[#fff8f5] px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[#251E1F]">{item.label}</p>
                <p className="text-xs text-[#7b6660]">{item.desc}</p>
              </div>
              <Toggle
                checked={Boolean(settings?.[item.key])}
                onChange={(val) => updateSetting(item.key, val)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Auto-Send & Attachments */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Auto-send Options */}
        <div className="rounded-xl border border-[#f0d2ca] bg-white p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F38978]/12 text-[#F38978]">
              <Send size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#251E1F]">Auto-Send</h3>
              <p className="text-xs text-[#7b6660]">Automatically send messages without manual action</p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { key: "auto_send_invoice", label: "Auto-send Invoice", desc: "Send WhatsApp when invoice is created" },
              { key: "auto_send_receipt", label: "Auto-send Receipt", desc: "Send receipt PDF after payment" },
              { key: "auto_send_subscription", label: "Auto-send Subscription", desc: "Notify on subscription events" }
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between rounded-lg border border-[#ead3cc] bg-[#fff8f5] px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-[#251E1F]">{item.label}</p>
                  <p className="text-xs text-[#7b6660]">{item.desc}</p>
                </div>
                <Toggle
                  checked={Boolean(settings?.[item.key])}
                  onChange={(val) => updateSetting(item.key, val)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* PDF Attachments */}
        <div className="rounded-xl border border-[#f0d2ca] bg-white p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F38978]/12 text-[#F38978]">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#251E1F]">Attachments</h3>
              <p className="text-xs text-[#7b6660]">PDF attachment options for WhatsApp messages</p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-[#ead3cc] bg-[#fff8f5] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[#251E1F]">Send PDF Attachments</p>
              <p className="text-xs text-[#7b6660]">Attach invoice/receipt PDF to WhatsApp messages</p>
            </div>
            <Toggle
              checked={Boolean(settings?.send_pdf_attachments)}
              onChange={(val) => updateSetting("send_pdf_attachments", val)}
            />
          </div>

          <div className="mt-4 rounded-lg border border-[#ead3cc] bg-[#fff8f5] px-4 py-3">
            <p className="text-xs font-bold uppercase text-[#7b6660] mb-2">Reminder Schedule (days before due)</p>
            <input
              type="text"
              value={Array.isArray(settings?.reminder_days_before) ? settings.reminder_days_before.join(", ") : "7, 3, 1"}
              onChange={(e) => {
                const days = e.target.value.split(",").map((d) => Number(d.trim())).filter((d) => !isNaN(d) && d > 0);
                updateSetting("reminder_days_before", days.length > 0 ? days : [7, 3, 1]);
              }}
              placeholder="7, 3, 1"
              className="w-full rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#F38978]"
            />
            <p className="mt-1 text-xs text-[#7b6660]">Comma-separated days (e.g., 7, 3, 1)</p>
          </div>
        </div>
      </div>

      {/* Message Templates */}
      <div className="rounded-xl border border-[#f0d2ca] bg-white p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F38978]/12 text-[#F38978]">
            <FileText size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#251E1F]">Message Templates</h3>
            <p className="text-xs text-[#7b6660]">Manage WhatsApp message templates with placeholder support</p>
          </div>
        </div>
        <WhatsAppTemplateManager />
      </div>

      {/* Recent Notification Logs */}
      {dashboard?.recentLogs && dashboard.recentLogs.length > 0 && (
        <div className="rounded-xl border border-[#f0d2ca] bg-white p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F38978]/12 text-[#F38978]">
              <Settings2 size={20} />
            </div>
            <h3 className="text-base font-bold text-[#251E1F]">Recent Notifications</h3>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#f0d2ca]">
            <table className="min-w-[700px] w-full text-left text-sm">
              <thead className="bg-[#FDD9CD]/20 text-xs uppercase tracking-wide text-[#7b6660]">
                <tr>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ead3cc]">
                {dashboard.recentLogs.map((log) => (
                  <tr key={log.id} className="text-[#251E1F]">
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-[#f0d2ca] bg-[#FDD9CD]/20 px-2.5 py-1 text-xs font-semibold">
                        {(log.notification_type || "").replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{log.customer_name || "-"}</td>
                    <td className="px-4 py-3">{log.invoice_number || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        log.status === "sent" || log.status === "delivered" || log.status === "read"
                          ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-700"
                          : log.status === "failed" || log.status === "undelivered"
                          ? "border-rose-400/30 bg-rose-500/15 text-rose-700"
                          : "border-amber-400/30 bg-amber-500/15 text-amber-700"
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#7b6660]">
                      {log.sent_at ? new Date(log.sent_at).toLocaleString("en-SG") : new Date(log.created_at).toLocaleString("en-SG")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
