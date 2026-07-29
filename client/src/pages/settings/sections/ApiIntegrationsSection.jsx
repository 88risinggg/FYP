/**
 * EVALUATION HEADER
 * FEATURE: SETTINGS - SHARED
 * PURPOSE: Implements the API Integrations Section screen and its page-level interactions.
 * LAYER: Frontend page - renders a complete screen and coordinates its user interactions.
 * FIND RELATED CODE: Trace its imports for UI components and frontend services used by this screen.
 */
import { useEffect, useState } from "react";
import { Check, Copy, Key, Loader2, RefreshCw, X } from "lucide-react";
import { fetchApiSettings, generateApiKey, updateApiSettings } from "../../../services/settingsService.js";
import { reportSettingsSaveResult } from "../../../services/settingsEvents.js";

export default function ApiIntegrationsSection() {
  const [settings, setSettings] = useState({ api_key: null, webhook_url: "", webhook_secret: "", webhooks_enabled: false });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [copied, setCopied] = useState(null);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    try {
      const data = await fetchApiSettings();
      setSettings((prev) => ({ ...prev, ...data }));
    } catch (err) { showToast(err.message, "error"); }
    finally { setLoading(false); }
  }

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const data = await generateApiKey();
      setSettings((prev) => ({ ...prev, api_key: data.api_key, webhook_secret: data.webhook_secret }));
      showToast("API key generated");
    } catch (err) { showToast(err.message, "error"); }
    finally { setGenerating(false); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateApiSettings({ webhook_url: settings.webhook_url, webhooks_enabled: settings.webhooks_enabled });
      showToast("Webhook settings saved");
      reportSettingsSaveResult(true);
    } catch (err) { showToast(err.message, "error"); reportSettingsSaveResult(false); }
    finally { setSaving(false); }
  }

  function copyToClipboard(text, label) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) {
    return <div className="app-panel rounded-2xl p-6"><div className="animate-pulse h-48 rounded-lg bg-[#FDD9CD]/30" /></div>;
  }

  return (
    <div className="space-y-6">
      {toast && <Toast toast={toast} />}

      <div className="app-panel rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <Key size={20} className="text-[#F38978]" />
          <h2 className="text-xl font-semibold text-[#251E1F]">API & Integrations</h2>
        </div>
        <p className="mt-1 text-sm text-[#7b6660]">Manage your API keys and webhook configuration.</p>

        <div className="mt-6 space-y-5">
          {/* API Key */}
          <div className="rounded-xl border border-[#ead3cc] bg-[#fff3ee]/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#F38978]/70">API Key</p>
            {settings.api_key ? (
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 overflow-hidden text-ellipsis rounded-lg bg-white px-3 py-2 font-mono text-xs text-[#251E1F]">
                  {settings.api_key}
                </code>
                <button type="button" onClick={() => copyToClipboard(settings.api_key, "api")}
                  className="rounded-lg border border-[#ead3cc] bg-white p-2 text-[#7b6660] transition hover:bg-[#FDD9CD]/50 hover:text-[#251E1F]">
                  {copied === "api" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
            ) : (
              <p className="mt-2 text-sm text-[#7b6660]/60">No API key generated yet.</p>
            )}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={handleGenerate} disabled={generating}
                className="primary-button inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold disabled:opacity-50">
                {generating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                {settings.api_key ? "Regenerate" : "Generate"} API Key
              </button>
            </div>
          </div>

          {/* Webhook Secret */}
          {settings.webhook_secret && (
            <div className="rounded-xl border border-[#ead3cc] bg-[#fff3ee]/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#F38978]/70">Webhook Secret</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 overflow-hidden text-ellipsis rounded-lg bg-white px-3 py-2 font-mono text-xs text-[#251E1F]">
                  {settings.webhook_secret}
                </code>
                <button type="button" onClick={() => copyToClipboard(settings.webhook_secret, "secret")}
                  className="rounded-lg border border-[#ead3cc] bg-white p-2 text-[#7b6660] transition hover:bg-[#FDD9CD]/50 hover:text-[#251E1F]">
                  {copied === "secret" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          )}

          {/* Webhook URL */}
          <div className="rounded-xl border border-[#ead3cc] bg-[#fff3ee]/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#F38978]/70">Webhook Configuration</p>
            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#7b6660]">Webhook URL</label>
                <input type="url" value={settings.webhook_url || ""} onChange={(e) => setSettings((p) => ({ ...p, webhook_url: e.target.value }))}
                  placeholder="https://your-domain.com/webhook"
                  className="w-full rounded-lg border border-[#ead3cc] bg-white px-3 py-2.5 text-sm text-[#251E1F] outline-none transition placeholder:text-[#7b6660]/40 focus:border-[#F38978]/50 focus:ring-1 focus:ring-[#F38978]/30" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#251E1F]">Enable Webhooks</span>
                <button type="button" data-settings-control onClick={() => setSettings((p) => ({ ...p, webhooks_enabled: !p.webhooks_enabled }))}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${settings.webhooks_enabled ? "bg-[#F38978]" : "bg-[#f0d2ca]"}`}>
                  <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${settings.webhooks_enabled ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
            </div>
            <button type="button" data-settings-save onClick={handleSave} disabled={saving}
              className="mt-4 primary-button inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold disabled:opacity-50">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Save Webhook Settings
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
