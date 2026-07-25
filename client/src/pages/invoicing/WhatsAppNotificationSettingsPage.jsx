/**
 * WhatsApp Notification Settings Page
 *
 * Allows Finance/Admin users to configure WhatsApp notification settings.
 * Provides toggle switches for enabling/disabling notification types,
 * a test message sender, and WhatsApp integration status.
 */

import { useEffect, useState } from "react";
import {
  Bell,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Phone,
  Save,
  Send,
  Settings2,
  X,
  XCircle
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import {
  getWhatsAppSettings,
  updateWhatsAppSettings,
  sendWhatsAppTest
} from "../../services/whatsappNotificationService.js";

const notificationToggles = [
  { key: "send_invoice_created", label: "Invoice Generated", description: "Send when a new invoice is sent to a customer" },
  { key: "send_payment_received", label: "Payment Confirmation", description: "Send when payment is received for an invoice" },
  { key: "send_payment_reminder", label: "Due Reminder", description: "Send reminders before invoice due date (7, 3, 1 days)" },
  { key: "send_overdue_notice", label: "Overdue Reminder", description: "Send when an invoice becomes overdue" },
  { key: "send_subscription_invoice", label: "Subscription Invoice", description: "Send when a recurring subscription invoice is generated" }
];

export default function WhatsAppNotificationSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const data = await getWhatsAppSettings();
      setSettings(data);
    } catch (err) {
      showToast(err.message || "Failed to load settings", "error");
    } finally {
      setLoading(false);
    }
  }

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  function handleToggle(key) {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleMasterToggle() {
    setSettings((prev) => ({ ...prev, whatsapp_enabled: !prev.whatsapp_enabled }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updateWhatsAppSettings(settings);
      setSettings(result.settings || settings);
      showToast("WhatsApp notification settings saved successfully");
    } catch (err) {
      showToast(err.message || "Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestSend() {
    if (!testPhone.trim()) {
      showToast("Enter a phone number to send a test message", "error");
      return;
    }
    setTestSending(true);
    try {
      await sendWhatsAppTest(testPhone.trim());
      showToast("Test message sent successfully");
    } catch (err) {
      showToast(err.message || "Test message failed", "error");
    } finally {
      setTestSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-[#F38978]" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
          toast.type === "error" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
        }`}>
          {toast.type === "error" ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <MessageSquare size={20} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">WhatsApp Notifications</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">Configure automated WhatsApp messages for invoice events</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F38978] text-white text-sm font-medium hover:bg-[#e07060] transition disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save Settings
        </button>
      </div>

      {/* Master Toggle */}
      <div className="app-panel rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell size={20} className="text-emerald-600" />
            <div>
              <p className="font-medium text-[var(--color-text-primary)]">Enable WhatsApp Notifications</p>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Master toggle — when disabled, no WhatsApp messages will be sent
              </p>
            </div>
          </div>
          <button
            onClick={handleMasterToggle}
            role="switch"
            aria-checked={settings?.whatsapp_enabled || false}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings?.whatsapp_enabled ? "bg-emerald-500" : "bg-gray-300"
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings?.whatsapp_enabled ? "translate-x-6" : "translate-x-1"
            }`} />
          </button>
        </div>
      </div>

      {/* Notification Type Toggles */}
      <div className="app-panel rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wide mb-4">
          Notification Types
        </h3>
        <div className="space-y-4">
          {notificationToggles.map((item) => (
            <div key={item.key} className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">{item.label}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{item.description}</p>
              </div>
              <button
                onClick={() => handleToggle(item.key)}
                disabled={!settings?.whatsapp_enabled}
                role="switch"
                aria-checked={settings?.[item.key] || false}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-40 ${
                  settings?.[item.key] ? "bg-emerald-500" : "bg-gray-300"
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings?.[item.key] ? "translate-x-6" : "translate-x-1"
                }`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Test Message */}
      <div className="app-panel rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wide mb-4">
          Test WhatsApp Integration
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          Send a test message to verify your WhatsApp integration is working correctly.
        </p>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
            <input
              type="text"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="+65 9123 4567"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
          <button
            onClick={handleTestSend}
            disabled={testSending || !testPhone.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50"
          >
            {testSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Send Test
          </button>
        </div>
      </div>

      {/* Integration Status */}
      <div className="app-panel rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wide mb-4">
          Integration Status
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm text-[var(--color-text-primary)]">Twilio WhatsApp Sandbox / Meta Cloud API (auto-detected)</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm text-[var(--color-text-primary)]">Scheduler: Daily 9:00 AM (SGT) + retries every 4 hours</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-sm text-[var(--color-text-secondary)]">
              Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM in server .env
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
