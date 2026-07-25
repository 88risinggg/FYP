import { useEffect, useState } from "react";
import { Check, Download, Lock, Loader2, X } from "lucide-react";
import { fetchPrivacySettings, updatePrivacySettings, exportPersonalData } from "../../../services/settingsService.js";
import { reportSettingsSaveResult } from "../../../services/settingsEvents.js";

export default function FinanceDataPrivacySection({ onDirty }) {
  const [form, setForm] = useState({
    analytics_tracking: true,
    profile_visible: true,
    activity_visible: false,
    analytics_cookies: true,
    marketing_cookies: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    try {
      const data = await fetchPrivacySettings();
      if (data && Object.keys(data).length > 0) {
        setForm((prev) => ({ ...prev, ...data }));
      }
    } catch (err) {
      // Use defaults
    } finally {
      setLoading(false);
    }
  }

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  function handleToggle(field) {
    setForm((prev) => ({ ...prev, [field]: !prev[field] }));
    onDirty?.();
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updatePrivacySettings(form);
      showToast("Privacy settings saved");
      reportSettingsSaveResult(true);
    } catch (err) {
      showToast(err.message, "error");
      reportSettingsSaveResult(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleExportData() {
    setExporting(true);
    try {
      const data = await exportPersonalData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "my-data-export.json";
      a.click();
      URL.revokeObjectURL(url);
      showToast("Data exported successfully");
    } catch (err) {
      showToast(err.message || "Failed to export data", "error");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return <div className="app-panel rounded-2xl p-6"><div className="animate-pulse h-48 rounded-lg bg-[#FDD9CD]/30" /></div>;
  }

  return (
    <div className="space-y-6">
      {toast && <Toast toast={toast} />}

      <div className="app-panel rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <Lock size={20} className="text-[#F38978]" />
          <h2 className="text-xl font-semibold text-[#251E1F]">Data & Privacy</h2>
        </div>
        <p className="mt-1 text-sm text-[#7b6660]">Manage your data and privacy preferences.</p>

        <div className="mt-6 space-y-6">
          {/* Privacy Settings */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#F38978]/70">Privacy</p>
            <div className="space-y-3">
              <ToggleRow
                label="Profile Visibility"
                description="Allow other users to see your profile information"
                checked={form.profile_visible}
                onToggle={() => handleToggle("profile_visible")}
              />
              <ToggleRow
                label="Activity Visibility"
                description="Show your recent activity to other users"
                checked={form.activity_visible}
                onToggle={() => handleToggle("activity_visible")}
              />
            </div>
          </div>

          {/* Cookie Preferences */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#F38978]/70">Cookies & Tracking</p>
            <div className="space-y-3">
              <ToggleRow
                label="Analytics Tracking"
                description="Help us improve by sharing anonymous usage data"
                checked={form.analytics_tracking}
                onToggle={() => handleToggle("analytics_tracking")}
              />
              <ToggleRow
                label="Analytics Cookies"
                description="Allow cookies for usage analytics"
                checked={form.analytics_cookies}
                onToggle={() => handleToggle("analytics_cookies")}
              />
              <ToggleRow
                label="Marketing Cookies"
                description="Allow cookies for personalised content"
                checked={form.marketing_cookies}
                onToggle={() => handleToggle("marketing_cookies")}
              />
            </div>
          </div>

          {/* Data Export */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#F38978]/70">Your Data</p>
            <div className="rounded-xl border border-[#ead3cc] bg-[#fff3ee]/70 p-4">
              <p className="text-sm font-medium text-[#251E1F]">Export Personal Data</p>
              <p className="mt-1 text-xs text-[#7b6660]">Download a copy of all your personal data stored in the system.</p>
              <button
                type="button"
                onClick={handleExportData}
                disabled={exporting}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#ead3cc] bg-white px-4 py-2 text-xs font-semibold text-[#251E1F] transition hover:bg-[#FDD9CD]/50 disabled:opacity-50"
              >
                {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                {exporting ? "Exporting..." : "Export My Data"}
              </button>
            </div>
          </div>

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

function ToggleRow({ label, description, checked, onToggle }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#ead3cc] bg-[#fff3ee]/70 px-4 py-3">
      <div>
        <span className="text-sm font-medium text-[#251E1F]">{label}</span>
        {description && <p className="text-xs text-[#7b6660]">{description}</p>}
      </div>
      <button type="button" onClick={onToggle}
        className={`relative ml-3 h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${checked ? "bg-[#F38978]" : "bg-[#f0d2ca]"}`}>
        <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
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
