import { useEffect, useState } from "react";
import { Check, Globe, X } from "lucide-react";
import { fetchAppearance, updateAppearance } from "../../../services/settingsService.js";

const languages = [
  { value: "en", label: "English", native: "English", flag: "🇬🇧" },
  { value: "zh", label: "Chinese", native: "中文", flag: "🇨🇳" },
  { value: "ms", label: "Malay", native: "Bahasa Melayu", flag: "🇲🇾" },
  { value: "ta", label: "Tamil", native: "தமிழ்", flag: "🇮🇳" }
];

export default function LanguageSection() {
  const [selected, setSelected] = useState("en");
  const [loading, setLoading] = useState(true);
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

  async function handleSelect(lang) {
    setSelected(lang);
    try {
      await updateAppearance({ language: lang });
      showToast("Language updated");
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
          <Globe size={20} className="text-[#C77DFF]" />
          <h2 className="text-xl font-semibold text-white">Language</h2>
        </div>
        <p className="mt-1 text-sm text-[#d8c6e8]">Choose your preferred display language.</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {languages.map((lang) => {
            const isActive = selected === lang.value;
            return (
              <button key={lang.value} type="button" onClick={() => handleSelect(lang.value)}
                className={`flex items-center gap-4 rounded-xl border p-4 text-left transition ${
                  isActive
                    ? "border-[#C77DFF]/50 bg-[#C77DFF]/10 shadow-lg shadow-[#9D4EDD]/15"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                }`}>
                <span className="text-2xl">{lang.flag}</span>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${isActive ? "text-white" : "text-[#d8c6e8]"}`}>{lang.label}</p>
                  <p className="text-xs text-[#d8c6e8]/60">{lang.native}</p>
                </div>
                {isActive && <Check size={16} className="text-[#C77DFF]" />}
              </button>
            );
          })}
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
