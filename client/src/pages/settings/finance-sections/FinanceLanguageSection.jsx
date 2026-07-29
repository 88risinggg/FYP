/**
 * EVALUATION HEADER
 * FEATURE: SETTINGS - SHARED
 * PURPOSE: Implements the Finance Language Section screen and its page-level interactions.
 * LAYER: Frontend page - renders a complete screen and coordinates its user interactions.
 * FIND RELATED CODE: Trace its imports for UI components and frontend services used by this screen.
 */
import { useEffect, useState } from "react";
import { Check, Globe, Loader2, X } from "lucide-react";
import { fetchProfile, updateProfile } from "../../../services/settingsService.js";
import { reportSettingsSaveResult } from "../../../services/settingsEvents.js";

const languages = [
  { value: "en", label: "English", native: "English" },
  { value: "zh", label: "Chinese (Simplified)", native: "简体中文" },
  { value: "zh-TW", label: "Chinese (Traditional)", native: "繁體中文" },
  { value: "ms", label: "Malay", native: "Bahasa Melayu" },
  { value: "ta", label: "Tamil", native: "தமிழ்" },
  { value: "ja", label: "Japanese", native: "日本語" },
  { value: "ko", label: "Korean", native: "한국어" }
];

const dateFormats = [
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY", example: "26/07/2026" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY", example: "07/26/2026" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD", example: "2026-07-26" }
];

const timeFormats = [
  { value: "12h", label: "12-hour (3:00 PM)" },
  { value: "24h", label: "24-hour (15:00)" }
];

export default function FinanceLanguageSection({ onDirty }) {
  const [form, setForm] = useState({
    preferred_language: "en",
    date_format: "DD/MM/YYYY",
    time_format: "12h"
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    try {
      const data = await fetchProfile();
      setForm({
        preferred_language: data.preferred_language || "en",
        date_format: data.date_format || "DD/MM/YYYY",
        time_format: data.time_format || "12h"
      });
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

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    onDirty?.();
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateProfile(form);
      showToast("Language preferences saved");
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
          <Globe size={20} className="text-[#F38978]" />
          <h2 className="text-xl font-semibold text-[#251E1F]">Language & Region</h2>
        </div>
        <p className="mt-1 text-sm text-[#7b6660]">Set your preferred language and regional formats.</p>

        <div className="mt-6 space-y-6">
          {/* Language Selection */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#F38978]/70">Display Language</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {languages.map((lang) => (
                <button
                  key={lang.value}
                  type="button"
                  onClick={() => handleChange("preferred_language", lang.value)}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                    form.preferred_language === lang.value
                      ? "border-[#F38978]/50 bg-[#F38978]/10 shadow-md"
                      : "border-[#ead3cc] bg-[#fff3ee]/70 hover:bg-[#FDD9CD]/45"
                  }`}
                >
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${form.preferred_language === lang.value ? "text-[#251E1F]" : "text-[#7b6660]"}`}>{lang.label}</p>
                    <p className="text-xs text-[#7b6660]">{lang.native}</p>
                  </div>
                  {form.preferred_language === lang.value && <Check size={16} className="text-[#F38978]" />}
                </button>
              ))}
            </div>
          </div>

          {/* Date Format */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#F38978]/70">Date Format</p>
            <div className="space-y-2">
              {dateFormats.map((df) => (
                <button
                  key={df.value}
                  type="button"
                  onClick={() => handleChange("date_format", df.value)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 transition ${
                    form.date_format === df.value
                      ? "border-[#F38978]/50 bg-[#F38978]/10"
                      : "border-[#ead3cc] bg-[#fff3ee]/70 hover:bg-[#FDD9CD]/45"
                  }`}
                >
                  <span className={`text-sm font-medium ${form.date_format === df.value ? "text-[#251E1F]" : "text-[#7b6660]"}`}>{df.label}</span>
                  <span className="text-xs text-[#7b6660]">{df.example}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Time Format */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#F38978]/70">Time Format</p>
            <div className="flex gap-3">
              {timeFormats.map((tf) => (
                <button
                  key={tf.value}
                  type="button"
                  onClick={() => handleChange("time_format", tf.value)}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                    form.time_format === tf.value
                      ? "border-[#F38978]/50 bg-[#F38978]/10 text-[#251E1F]"
                      : "border-[#ead3cc] bg-[#fff3ee]/70 text-[#7b6660] hover:bg-[#FDD9CD]/45"
                  }`}
                >
                  {tf.label}
                </button>
              ))}
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
