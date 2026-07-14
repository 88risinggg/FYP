import { useEffect, useState } from "react";
import { Check, Monitor, Moon, Palette, Sun, X } from "lucide-react";
import { fetchAppearance, updateAppearance } from "../../../services/settingsService.js";

const themes = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor }
];

const accentColors = [
  { value: "#7B2FF7", label: "Purple" },
  { value: "#FF4DDB", label: "Pink" },
  { value: "#4CC9F0", label: "Blue" },
  { value: "#34D399", label: "Green" },
  { value: "#F59E0B", label: "Amber" },
  { value: "#FB7185", label: "Rose" }
];

const fontSizes = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" }
];

export default function AppearanceSection() {
  const [settings, setSettings] = useState({
    theme: "system",
    accent_color: "#7B2FF7",
    compact_mode: false,
    font_size: "medium"
  });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    try {
      const data = await fetchAppearance();
      setSettings((prev) => ({ ...prev, ...data }));
    } catch (err) { /* ignore */ }
    finally { setLoading(false); }
  }

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function save(newSettings) {
    setSettings(newSettings);
    try {
      await updateAppearance(newSettings);
      showToast("Appearance saved");
    } catch (err) { showToast(err.message, "error"); }
  }

  if (loading) {
    return <div className="neon-glass neon-border rounded-2xl p-6"><div className="animate-pulse h-48 rounded-lg bg-white/[0.04]" /></div>;
  }

  return (
    <div className="space-y-6">
      {toast && <Toast toast={toast} />}

      <div className="neon-glass neon-border rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <Palette size={20} className="text-[#C77DFF]" />
          <h2 className="text-xl font-semibold text-white">Appearance</h2>
        </div>
        <p className="mt-1 text-sm text-[#d8c6e8]">Customize how the application looks.</p>

        <div className="mt-6 space-y-6">
          {/* Theme */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#C77DFF]/70">Theme</p>
            <div className="grid grid-cols-3 gap-3">
              {themes.map((t) => {
                const Icon = t.icon;
                const isActive = settings.theme === t.id;
                return (
                  <button key={t.id} type="button" onClick={() => save({ ...settings, theme: t.id })}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition ${
                      isActive ? "border-[#C77DFF]/50 bg-[#C77DFF]/10 shadow-lg shadow-[#9D4EDD]/15" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                    }`}>
                    <Icon size={22} className={isActive ? "text-[#C77DFF]" : "text-[#d8c6e8]"} />
                    <span className={`text-xs font-medium ${isActive ? "text-white" : "text-[#d8c6e8]"}`}>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accent Color */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#C77DFF]/70">Accent Color</p>
            <div className="flex flex-wrap gap-3">
              {accentColors.map((c) => (
                <button key={c.value} type="button" onClick={() => save({ ...settings, accent_color: c.value })}
                  className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
                    settings.accent_color === c.value ? "ring-2 ring-white ring-offset-2 ring-offset-[#090014]" : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}>
                  {settings.accent_color === c.value && <Check size={14} className="text-white" />}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#C77DFF]/70">Font Size</p>
            <div className="flex gap-3">
              {fontSizes.map((f) => (
                <button key={f.value} type="button" onClick={() => save({ ...settings, font_size: f.value })}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                    settings.font_size === f.value
                      ? "border-[#C77DFF]/50 bg-[#C77DFF]/10 text-white"
                      : "border-white/10 bg-white/[0.03] text-[#d8c6e8] hover:bg-white/[0.06]"
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Compact Mode */}
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div>
              <span className="text-sm font-medium text-white">Compact Mode</span>
              <p className="text-xs text-[#d8c6e8]">Reduce spacing and padding throughout the UI</p>
            </div>
            <button type="button" onClick={() => save({ ...settings, compact_mode: !settings.compact_mode })}
              className={`relative h-6 w-11 rounded-full transition ${settings.compact_mode ? "bg-[#7B2FF7]" : "bg-white/15"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${settings.compact_mode ? "translate-x-[22px]" : "translate-x-0.5"}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
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
