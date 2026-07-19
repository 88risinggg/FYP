import { useEffect, useState } from "react";
import { Check, Monitor, Moon, Palette, Sun, X } from "lucide-react";
import { fetchAppearance, updateAppearance } from "../../../services/settingsService.js";

const themes = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor }
];

const accentColors = [
  { value: "#F38978", label: "Coral" },
  { value: "#F26E5F", label: "Pink" },
  { value: "#3269A8", label: "Blue" },
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
    accent_color: "#F38978",
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
        <p className="mt-1 text-sm text-[#7b6660]">Customize how the application looks.</p>

        <div className="mt-6 space-y-6">
          {/* Theme */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#F38978]/70">Theme</p>
            <div className="grid grid-cols-3 gap-3">
              {themes.map((t) => {
                const Icon = t.icon;
                const isActive = settings.theme === t.id;
                return (
                  <button key={t.id} type="button" onClick={() => save({ ...settings, theme: t.id })}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition ${
                      isActive ? "border-[#F38978]/50 bg-[#F38978]/10 shadow-lg shadow-[#f2b5a9]/15" : "border-[#ead3cc] bg-[#fff3ee]/70 hover:bg-[#FDD9CD]/45"
                    }`}>
                    <Icon size={22} className={isActive ? "text-[#F38978]" : "text-[#7b6660]"} />
                    <span className={`text-xs font-medium ${isActive ? "text-[#251E1F]" : "text-[#7b6660]"}`}>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accent Color */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#F38978]/70">Accent Color</p>
            <div className="flex flex-wrap gap-3">
              {accentColors.map((c) => (
                <button key={c.value} type="button" onClick={() => save({ ...settings, accent_color: c.value })}
                  className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
                    settings.accent_color === c.value ? "ring-2 ring-[#f0d2ca] ring-offset-2 ring-offset-[#fff8f5]" : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}>
                  {settings.accent_color === c.value && <Check size={14} className="text-[#251E1F]" />}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#F38978]/70">Font Size</p>
            <div className="flex gap-3">
              {fontSizes.map((f) => (
                <button key={f.value} type="button" onClick={() => save({ ...settings, font_size: f.value })}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                    settings.font_size === f.value
                    ? "border-[#F38978]/50 bg-[#F38978]/10 text-[#251E1F]"
                      : "border-[#ead3cc] bg-[#fff3ee]/70 text-[#7b6660] hover:bg-[#FDD9CD]/45"
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Compact Mode */}
          <div className="flex items-center justify-between rounded-xl border border-[#ead3cc] bg-[#fff3ee]/70 px-4 py-3">
            <div>
              <span className="text-sm font-medium text-[#251E1F]">Compact Mode</span>
              <p className="text-xs text-[#7b6660]">Reduce spacing and padding throughout the UI</p>
            </div>
            <button type="button" onClick={() => save({ ...settings, compact_mode: !settings.compact_mode })}
              className={`relative h-6 w-11 rounded-full transition ${settings.compact_mode ? "bg-[#F38978]" : "bg-[#f0d2ca]"}`}>
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
      toast.type === "error" ? "border-rose-400/20 bg-rose-500/15 text-rose-700" : "border-emerald-400/20 bg-emerald-500/15 text-emerald-700"
    }`}>
      <div className="flex items-center gap-2">
        {toast.type === "error" ? <X size={16} /> : <Check size={16} />}
        <span className="text-sm font-medium">{toast.message}</span>
      </div>
    </div>
  );
}