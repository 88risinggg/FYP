import { useEffect, useState } from "react";
import { Bell, Check, Loader2, X } from "lucide-react";
import { fetchNotificationSettings, updateNotificationSettings } from "../../../services/settingsService.js";

const invoiceNotifications = [
  { key: "invoice_approved", label: "Invoice Approved" },
  { key: "invoice_rejected", label: "Invoice Rejected" },
  { key: "invoice_paid", label: "Invoice Paid" },
  { key: "invoice_overdue", label: "Invoice Overdue" },
  { key: "fraud_alert", label: "Fraud Detection Alerts" }
];

const payrollNotifications = [
  { key: "payroll_completed", label: "Payroll Completed" },
  { key: "payroll_failed", label: "Payroll Failed" },
  { key: "salary_released", label: "Salary Released" },
  { key: "cpf_reminder", label: "CPF Reminder" },
  { key: "tax_reminder", label: "Tax Reminder" }
];

const generalNotifications = [
  { key: "email_notifications", label: "Email Notifications" },
  { key: "sms_notifications", label: "SMS Notifications" },
  { key: "push_notifications", label: "Push Notifications" }
];

export default function NotificationsSection() {
  const [prefs, setPrefs] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const data = await fetchNotificationSettings();
      setPrefs(data.preferences || {});
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  function toggle(key) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateNotificationSettings(prefs);
      showToast("Notification preferences saved");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="app-panel rounded-2xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 rounded bg-white/10" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-white/[0.04]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && <Toast toast={toast} />}

      <div className="app-panel rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <Bell size={20} className="text-[#F38978]" />
          <h2 className="text-xl font-semibold text-white">Notification Settings</h2>
        </div>
        <p className="mt-1 text-sm text-[#7b6660]">Choose what notifications you want to receive.</p>

        <div className="mt-6 space-y-6">
          <NotificationGroup title="Invoice Notifications" items={invoiceNotifications} prefs={prefs} onToggle={toggle} />
          <NotificationGroup title="Payroll Notifications" items={payrollNotifications} prefs={prefs} onToggle={toggle} />
          <NotificationGroup title="General" items={generalNotifications} prefs={prefs} onToggle={toggle} />
        </div>

        <div className="mt-6 pt-4 border-t border-white/10">
          <button type="button" onClick={handleSave} disabled={saving}
            className="primary-button inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}

function NotificationGroup({ title, items, prefs, onToggle }) {
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#F38978]/70">{title}</p>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <span className="text-sm text-white">{item.label}</span>
            <Toggle checked={!!prefs[item.key]} onChange={() => onToggle(item.key)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button type="button" onClick={onChange}
      className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${checked ? "bg-[#F38978]" : "bg-white/15"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
    </button>
  );
}

function Toast({ toast }) {
  return (
    <div className={`fixed right-6 top-24 z-50 animate-[slideDown_0.3s_ease] rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${
      toast.type === "error" ? "border-rose-400/20 bg-rose-500/15 text-rose-200" : "border-emerald-400/20 bg-emerald-500/15 text-emerald-200"
    }`}>
      <div className="flex items-center gap-2">
        {toast.type === "error" ? <X size={16} /> : <Check size={16} />}
        <span className="text-sm font-medium">{toast.message}</span>
      </div>
    </div>
  );
}