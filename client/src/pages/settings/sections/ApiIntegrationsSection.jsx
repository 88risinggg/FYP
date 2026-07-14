import { useEffect, useState } from "react";
import { Check, Copy, Key, Loader2, RefreshCw, X } from "lucide-react";
import { fetchApiSettings, generateApiKey, updateApiSettings } from "../../../services/settingsService.js";

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
    } catch (err) { showToast(err.message, "error"); }
    finally { setSaving(false); }
  }

  function copyToClipboard(text, label) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) {
    return <div className="neon-glass neon-border rounded-2xl p-6"><div className="animate-pulse h-48 rounded-lg bg-white/[0.04]" /></div>;
  }

  return (
    <div className="space-y-6">
      {toast && <Toast toast={toast} />}

      <div className="neon-glass neon-border rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <Key size={20} className="text-[#C77DFF]" />
          <h2 className="text-xl font-semibold text-white">API & Integrations</h2>
        </div>
        <p className="mt-1 text-sm text-[#d8c6e8]">Manage your API keys and webhook configuration.</p>

        <div className="mt-6 space-y-5">
          {/* API Key */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#C77DFF]/70">API Key</p>
            {settings.api_key ? (
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 overflow-hidden text-ellipsis rounded-lg bg-white/[0.06] px-3 py-2 font-mono text-xs text-white">
                  {settings.api_key}
                </code>
                <button type="button" onClick={() => copyToClipboard(settings.api_key, "api")}
                  className="rounded-lg border border-white/10 bg-white/[0.06] p-2 text-[#d8c6e8] transition hover:bg-white/10 hover:text-white">
                  {copied === "api" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
            ) : (
              <p className="mt-2 text-sm text-[#d8c6e8]/60">No API key generated yet.</p>
            )}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={handleGenerate} disabled={generating}
                className="neon-button inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold disabled:opacity-50">
                {generating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                {settings.api_key ? "Regenerate" : "Generate"} API Key
              </button>
            </div>
          </div>

          {/* Webhook Secret */}
          {settings.webhook_secret && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#C77DFF]/70">Webhook Secret</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 overflow-hidden text-ellipsis rounded-lg bg-white/[0.06] px-3 py-2 font-mono text-xs text-white">
                  {settings.webhook_secret}
                </code>
                <button type="button" onClick={() => copyToClipboard(settings.webhook_secret, "secret")}
                  className="rounded-lg border border-white/10 bg-white/[0.06] p-2 text-[#d8c6e8] transition hover:bg-white/10 hover:text-white">
                  {copied === "secret" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          )}

          {/* Webhook URL */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#C77DFF]/70">Webhook Configuration</p>
            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#d8c6e8]">Webhook URL</label>
                <input type="url" value={settings.webhook_url || ""} onChange={(e) => setSettings((p) => ({ ...p, webhook_url: e.target.value }))}
                  placeholder="https://your-domain.com/webhook"
                  className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-[#d8c6e8]/40 focus:border-[#C77DFF]/50 focus:ring-1 focus:ring-[#C77DFF]/30" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white">Enable Webhooks</span>
                <button type="button" onClick={() => setSettings((p) => ({ ...p, webhooks_enabled: !p.webhooks_enabled }))}
                  className={`relative h-6 w-11 rounded-full transition ${settings.webhooks_enabled ? "bg-[#7B2FF7]" : "bg-white/15"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${settings.webhooks_enabled ? "translate-x-[22px]" : "translate-x-0.5"}`} />
                </button>
              </div>
            </div>
            <button type="button" onClick={handleSave} disabled={saving}
              className="mt-4 neon-button inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold disabled:opacity-50">
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
      toast.type === "error" ? "border-rose-400/20 bg-rose-500/15 text-rose-200" : "border-emerald-400/20 bg-emerald-500/15 text-emerald-200"
    }`}>
      <div className="flex items-center gap-2">
        {toast.type === "error" ? <X size={16} /> : <Check size={16} />}
        <span className="text-sm font-medium">{toast.message}</span>
      </div>
    </div>
  );
}
