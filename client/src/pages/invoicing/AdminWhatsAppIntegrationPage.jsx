/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - ADMIN
 * PURPOSE: Implements the Admin Whats App Integration Page screen and its page-level interactions.
 * LAYER: Frontend page - renders a complete screen and coordinates its user interactions.
 * FIND RELATED CODE: Trace its imports for UI components and frontend services used by this screen.
 */
/**
 * Admin WhatsApp Integration Settings Page
 *
 * Admin → Settings → Integrations → WhatsApp
 * Only Admin users can access this page.
 *
 * Features:
 *   - Enable/Disable toggle
 *   - Message Template Management
 *   - Integration Logs
 */

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  MessageCircle,
  Settings2,
  Star
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

function getHeaders() {
  const token = sessionStorage.getItem("authToken");
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-emerald-500" : "bg-[#ead3cc]"
      }`}
      role="switch"
      aria-checked={checked}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

function maskWhatsAppNumber(value) {
  const text = String(value || "").trim();
  if (!text) return "Not configured";

  const prefix = text.startsWith("whatsapp:") ? "whatsapp:" : "";
  const number = prefix ? text.slice(prefix.length) : text;
  if (number.length <= 4) return `${prefix}••••`;

  return `${prefix}${number.slice(0, 3)}••••${number.slice(-4)}`;
}

export default function AdminWhatsAppIntegrationPage() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [activeTab, setActiveTab] = useState("templates");
  const [templates, setTemplates] = useState([]);
  const [placeholders, setPlaceholders] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logsTotal, setLogsTotal] = useState(0);

  useEffect(() => {
    loadConfig();
    loadTemplates();
    loadLogs();
  }, []);

  function showMessage(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  }

  async function loadConfig() {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/admin/config`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (err) {
      console.error("Failed to load config:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadTemplates() {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/admin/templates`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
        setPlaceholders(data.placeholders || []);
      }
    } catch { /* non-critical */ }
  }

  async function loadLogs() {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/admin/logs?limit=20`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setLogsTotal(data.total || 0);
      }
    } catch { /* non-critical */ }
  }

  async function handleToggle(enabled) {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/admin/toggle`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify({ is_enabled: enabled })
      });
      const data = await res.json();
      if (res.ok) {
        setConfig(data.config);
        showMessage(enabled ? "WhatsApp integration enabled." : "WhatsApp integration disabled.");
        loadLogs();
      } else {
        showMessage(data.message || "Failed to toggle.", "error");
      }
    } catch (err) {
      showMessage(err.message, "error");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-xl border border-[#f0d2ca] px-5 py-16 text-[#7b6660]">
        <Loader2 size={20} className="animate-spin" /> Loading WhatsApp integration settings...
      </div>
    );
  }

  const tabs = [
    { key: "templates", label: "Templates", icon: FileText },
    { key: "logs", label: "Integration Logs", icon: Settings2 }
  ];

  return (
    <section className="space-y-6">
      {/* Messages */}
      {message && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${
          message.type === "error"
            ? "border-rose-400/30 bg-rose-500/10 text-rose-700"
            : "border-emerald-400/30 bg-emerald-500/10 text-emerald-700"
        }`}>
          <div className="flex items-center gap-2">
            {message.type === "error" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            {message.text}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <MessageCircle size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#251E1F]">WhatsApp Integration</h2>
            <p className="text-sm text-[#7b6660]">Configure Twilio WhatsApp for invoice notifications</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Connection Status */}
          <div className="flex items-center gap-2 text-sm">
            {config?.connection_status === "connected" ? (
              <><div className="h-2 w-2 rounded-full bg-emerald-500" /><span className="text-emerald-700 font-medium">Connected</span></>
            ) : config?.connection_status === "failed" ? (
              <><div className="h-2 w-2 rounded-full bg-rose-500" /><span className="text-rose-700 font-medium">Failed</span></>
            ) : (
              <><div className="h-2 w-2 rounded-full bg-amber-500" /><span className="text-amber-700 font-medium">Untested</span></>
            )}
          </div>
          {/* Enable/Disable */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#7b6660]">{config?.is_enabled ? "Enabled" : "Disabled"}</span>
            <Toggle checked={config?.is_enabled || false} onChange={handleToggle} disabled={!config?.configured} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#f0d2ca]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition ${
                activeTab === tab.key
                  ? "border-b-2 border-[#F38978] bg-[#FDD9CD]/20 text-[#251E1F]"
                  : "text-[#7b6660] hover:bg-[#FDD9CD]/10"
              }`}>
              <Icon size={15} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Templates Tab */}
      {activeTab === "templates" && (
        <div className="rounded-xl border border-[#f0d2ca] bg-white p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <FileText size={20} className="text-[#F38978]" />
              <div>
                <h3 className="text-base font-bold text-[#251E1F]">Message Templates</h3>
                <p className="text-xs text-[#7b6660]">Configure templates with placeholders: {placeholders.map((p) => `{{${p.key}}}`).join(", ")}</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {templates.map((tpl) => (
              <div key={tpl.id} className="rounded-lg border border-[#f0d2ca] bg-[#fff8f5] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#251E1F]">{tpl.template_name}</span>
                    {tpl.is_default ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        <Star size={10} /> Default
                      </span>
                    ) : null}
                    <span className="rounded-full border border-[#f0d2ca] bg-[#FDD9CD]/20 px-2 py-0.5 text-xs text-[#7b6660]">
                      {tpl.template_type.replace(/_/g, " ")}
                    </span>
                  </div>
                  <span className={`text-xs font-medium ${tpl.is_active ? "text-emerald-600" : "text-[#7b6660]"}`}>
                    {tpl.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-[#FDD9CD]/10 p-3 text-xs text-[#7b6660] font-mono">
                  {tpl.message_body}
                </pre>
              </div>
            ))}
            {templates.length === 0 && (
              <p className="text-center text-sm text-[#7b6660] py-8">No templates configured. Run the migration to seed defaults.</p>
            )}
          </div>
        </div>
      )}

      {/* Integration Logs Tab */}
      {activeTab === "logs" && (
        <div className="rounded-xl border border-[#f0d2ca] bg-white p-6">
          <div className="mb-5 flex items-center">
            <div className="flex items-center gap-3">
              <Settings2 size={20} className="text-[#F38978]" />
              <div>
                <h3 className="text-base font-bold text-[#251E1F]">Integration Logs</h3>
                <p className="text-xs text-[#7b6660]">{logsTotal} total events recorded</p>
              </div>
            </div>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 rounded-lg border border-[#f0d2ca] bg-[#fff8f5] px-4 py-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#251E1F]">{log.action.replace(/_/g, " ")}</span>
                    <span className="text-xs text-[#7b6660]">{log.user_name || "System"}</span>
                  </div>
                  <p className="text-xs text-[#7b6660] mt-0.5">
                    {new Date(log.created_at).toLocaleString("en-SG")}
                    {log.ip_address ? ` • ${log.ip_address}` : ""}
                  </p>
                </div>
              </div>
            ))}
            {logs.length === 0 && (
              <p className="text-center text-sm text-[#7b6660] py-8">No integration logs yet.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
