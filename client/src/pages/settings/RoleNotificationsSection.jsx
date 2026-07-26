import { useEffect, useState } from "react";
import { Bell, Check, Loader2, X } from "lucide-react";

import { fetchNotificationSettings, updateNotificationSettings } from "../../services/settingsService.js";
import { reportSettingsSaveResult } from "../../services/settingsEvents.js";

const roleNotificationGroups = {
  HR: [
    {
      title: "HR Notifications",
      items: [
        { key: "hr_staff_updates", label: "Staff record updates" },
        { key: "hr_leave_requests", label: "Leave requests" },
        { key: "hr_claim_requests", label: "Claim requests" },
        { key: "hr_loan_requests", label: "Loan requests" },
        { key: "hr_payroll_alerts", label: "Payroll alerts" }
      ]
    },
    {
      title: "Notification Channels",
      items: [
        { key: "channel_in_app", label: "In-app notifications" },
        { key: "channel_email", label: "Email notifications" }
      ]
    }
  ],
  Staff: [
    {
      title: "Staff Notifications",
      items: [
        { key: "staff_payslip_available", label: "Payslip available" },
        { key: "staff_leave_updates", label: "Leave request updates" },
        { key: "staff_claim_updates", label: "Claim request updates" },
        { key: "staff_loan_updates", label: "Loan request updates" },
        { key: "staff_account_alerts", label: "Account alerts" }
      ]
    },
    {
      title: "Notification Channels",
      items: [
        { key: "channel_in_app", label: "In-app notifications" },
        { key: "channel_email", label: "Email notifications" }
      ]
    }
  ]
};

export default function RoleNotificationsSection({ role = "Staff", onDirty }) {
  const [prefs, setPrefs] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const groups = roleNotificationGroups[role] || roleNotificationGroups.Staff;

  useEffect(() => { loadSettings(); }, []);

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
    onDirty?.();
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateNotificationSettings(prefs);
      showToast("Notification preferences saved");
      reportSettingsSaveResult(true);
    } catch (err) {
      showToast(err.message, "error");
      reportSettingsSaveResult(false);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="app-panel rounded-2xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 rounded bg-[#FDD9CD]/50" />
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-12 rounded-lg bg-[#FDD9CD]/30" />
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
          <h2 className="text-xl font-semibold text-[#251E1F]">Notification Preferences</h2>
        </div>
        <p className="mt-1 text-sm text-[#7b6660]">Choose the {role} account notifications you want to receive.</p>

        <div className="mt-6 space-y-6">
          {groups.map((group) => (
            <NotificationGroup key={group.title} title={group.title} items={group.items} prefs={prefs} onToggle={toggle} />
          ))}
        </div>

        <div className="mt-6 border-t border-[#ead3cc] pt-4">
          <button type="button" data-settings-save onClick={handleSave} disabled={saving}
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
          <div key={item.key} className="flex items-center justify-between rounded-xl border border-[#ead3cc] bg-[#fff3ee]/70 px-4 py-3">
            <span className="text-sm text-[#251E1F]">{item.label}</span>
            <Toggle checked={!!prefs[item.key]} onChange={() => onToggle(item.key)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button type="button" data-settings-control onClick={onChange}
      className={`relative ml-3 h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${checked ? "bg-[#F38978]" : "bg-[#f0d2ca]"}`}>
      <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

function Toast({ toast }) {
  return (
    <div className={`fixed right-6 top-24 z-50 animate-[slideDown_0.3s_ease] rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${
      toast.type === "error" ? "border-rose-400/20 bg-rose-500/15 text-rose-700" : "border-emerald-400/20 bg-emerald-500/15 text-emerald-700"
    }`}>
      <div className="flex items-center gap-2">
        {toast.type === "error" ? <X size={16} /> : <Check size={16} />}
        <span className="text-sm font-medium">{toast.message}</span>
      </div>
    </div>
  );
}
