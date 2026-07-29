/**
 * EVALUATION HEADER
 * FEATURE: SETTINGS - SHARED
 * PURPOSE: Implements the Language Section screen and its page-level interactions.
 * LAYER: Frontend page - renders a complete screen and coordinates its user interactions.
 * FIND RELATED CODE: Trace its imports for UI components and frontend services used by this screen.
 */
import { useEffect, useState } from "react";
import { Check, Globe, X } from "lucide-react";
import { fetchAppearance, updateAppearance } from "../../../services/settingsService.js";
import { reportSettingsSaveResult } from "../../../services/settingsEvents.js";

const languages = [
  { value: "en", label: "English", native: "English", flag: "🇬🇧" },
  { value: "zh", label: "Chinese", native: "中文", flag: "🇨🇳" },
  { value: "ms", label: "Malay", native: "Bahasa Melayu", flag: "🇲🇾" },
  { value: "ta", label: "Tamil", native: "தமிழ்", flag: "🇮🇳" }
];

export default function LanguageSection() {
  const [selected, setSelected] = useState("en");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    try {
      const data = await fetchAppearance();
      setSelected(data.language || "en");
    } catch (err) { /* ignore */ }
    finally { setLoading(false); }
  }

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateAppearance({ language: selected });
      showToast("Language updated");
      reportSettingsSaveResult(true);
    } catch (err) { showToast(err.message, "error"); reportSettingsSaveResult(false); }
    finally { setSaving(false); }
  }

  if (loading) {
    return <div className="app-panel rounded-2xl p-6"><div className="animate-pulse h-48 rounded-lg bg-[#FDD9CD]/30" /></div>;
  }

  return (
    <div className="space-y-6">
      {toast && <Toast toast={toast} />}

      <div className="app-panel rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <Globe size={20} className="text-[#F38978]" />
          <h2 className="text-xl font-semibold text-[#251E1F]">Language</h2>
        </div>
        <p className="mt-1 text-sm text-[#7b6660]">Choose your preferred display language.</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {languages.map((lang) => {
            const isActive = selected === lang.value;
            return (
              <button key={lang.value} type="button" data-settings-control onClick={() => setSelected(lang.value)}
                className={`flex items-center gap-4 rounded-xl border p-4 text-left transition ${
                  isActive
                    ? "border-[#F38978]/50 bg-[#F38978]/10 shadow-lg shadow-[#E77463]/15"
                    : "border-[#ead3cc] bg-[#fff3ee]/70 hover:bg-[#FDD9CD]/45"
                }`}>
                <span className="text-2xl">{lang.flag}</span>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${isActive ? "text-[#251E1F]" : "text-[#7b6660]"}`}>{lang.label}</p>
                  <p className="text-xs text-[#7b6660]/60">{lang.native}</p>
                </div>
                {isActive && <Check size={16} className="text-[#F38978]" />}
              </button>
            );
          })}
        </div>
        <button type="button" data-settings-save onClick={handleSave} disabled={saving}>Save language</button>
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
