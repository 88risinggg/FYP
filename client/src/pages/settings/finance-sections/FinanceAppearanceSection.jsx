import { useEffect, useState } from "react";
import { Check, Monitor, Moon, Palette, Sun, X } from "lucide-react";
import { applyAppearance, DEFAULT_APPEARANCE, normalizeAppearance } from "../../../services/appearanceService.js";
import { fetchAppearance, updateAppearance } from "../../../services/settingsService.js";
import { reportSettingsSaveResult } from "../../../services/settingsEvents.js";

const themes = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor }
];

const sidebarModes = [
  { value: "expanded", label: "Expanded" },
  { value: "collapsed", label: "Collapsed" }
];

export default function FinanceAppearanceSection({ onDirty }) {
  const [settings, setSettings] = useState(DEFAULT_APPEARANCE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    try {
      const data = await fetchAppearance();
      const next = normalizeAppearance(data);
      setSettings(next);
      applyAppearance(next);
    } catch (err) { /* ignore */ }
    finally { setLoading(false); }
  }

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  function updateDraft(newSettings) {
    const normalized = applyAppearance(newSettings, { persist: false });
    setSettings(normalized);
    onDirty?.();
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateAppearance(settings);
      applyAppearance(settings);
      showToast("Appearance saved");
      reportSettingsSaveResult(true);
    } catch (err) {
      showToast(err.message, "error");
      reportSettingsSaveResult(false);
    } finally {
      setSaving(false);
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
          <Palette size={20} className="text-[#F38978]" />
          <h2 className="text-xl font-semibold text-[#251E1F]">Appearance</h2>
        </div>
        <p className="mt-1 text-sm text-[#7b6660]">Customise how the application looks.</p>

        <div className="mt-6 space-y-6">
          {/* Theme */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#F38978]/70">Theme</p>
            <div className="grid grid-cols-3 gap-3">
              {themes.map((t) => {
                const Icon = t.icon;
                const isActive = settings.theme === t.id;
                return (
                  <button key={t.id} type="button" data-settings-control onClick={() => updateDraft({ ...settings, theme: t.id })}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition ${
                      isActive ? "border-[#F38978]/50 bg-[#F38978]/10 shadow-lg shadow-[#FDD9CD]/15" : "border-[#F0D2CA] bg-[#fff3ee]/70 hover:bg-[#FDD9CD]/45"
                    }`}>
                    <Icon size={22} className={isActive ? "text-[#F38978]" : "text-[#7b6660]"} />
                    <span className={`text-xs font-medium ${isActive ? "text-[#251E1F]" : "text-[#7b6660]"}`}>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sidebar */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#F38978]/70">Sidebar</p>
            <div className="flex gap-3">
              {sidebarModes.map((mode) => (
                <button key={mode.value} type="button" data-settings-control
                  onClick={() => updateDraft({ ...settings, sidebar_mode: mode.value })}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                    settings.sidebar_mode === mode.value
                      ? "border-[#F38978]/50 bg-[#F38978]/10 text-[#251E1F]"
                      : "border-[#F0D2CA] bg-[#fff3ee]/70 text-[#7b6660] hover:bg-[#FDD9CD]/45"
                  }`}>
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {/* Compact Mode */}
          <div className="flex items-center justify-between rounded-xl border border-[#F0D2CA] bg-[#fff3ee]/70 px-4 py-3">
            <div>
              <span className="text-sm font-medium text-[#251E1F]">Compact Mode</span>
              <p className="text-xs text-[#7b6660]">Reduce spacing and padding throughout the UI</p>
            </div>
            <button type="button" data-settings-control onClick={() => updateDraft({ ...settings, compact_mode: !settings.compact_mode })}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${settings.compact_mode ? "bg-[#F38978]" : "bg-[#f0d2ca]"}`}>
              <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${settings.compact_mode ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>

          {/* Note about branding */}
          <div className="rounded-xl border border-[#ead3cc] bg-[#fff3ee]/70 p-4">
            <p className="text-xs text-[#7b6660]">The coral-and-black PayNivo branding is maintained across all themes.</p>
          </div>

          <button type="button" data-settings-save onClick={handleSave} disabled={saving}
            className="primary-button inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:opacity-50">
            {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Check size={15} />}
            Save Appearance
          </button>
        </div>
      </div>
    </div>
  );
}

function Toast({ toast }) {
  return (
    <div className={`fixed right-6 top-24 z-50 animate-[slideDown_0.3s_ease] rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${
      toast.type === "error" ? "border-[#F3C6BC] bg-[#FFF0EB] text-[#C94C3A]" : "border-[#B8D9C6] bg-[#E9F7EF] text-[#2F8758]"
    }`}>
      <div className="flex items-center gap-2">
        {toast.type === "error" ? <X size={16} /> : <Check size={16} />}
        <span className="text-sm font-medium">{toast.message}</span>
      </div>
    </div>
  );
}
