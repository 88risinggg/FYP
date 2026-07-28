/**
 * Admin WhatsApp Integration Settings Page
 *
 * Admin → Settings → Integrations → WhatsApp
 * Only Admin users can access this page.
 *
 * Features:
 *   - Configure Twilio credentials (Account SID, Auth Token, WhatsApp Number)
 *   - Enable/Disable toggle
 *   - Test Twilio Connection
 *   - Send Test Message
 *   - Message Template Management
 *   - Default Notification Rules
 *   - Integration Logs
 *   - Webhook Status
 */

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Edit3,
  FileText,
  Key,
  Loader2,
  MessageCircle,
  Phone,
  Plus,
  Save,
  Send,
  Settings2,
  Shield,
  Star,
  Trash2,
  Wifi,
  WifiOff,
  X
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

function getHeaders() {
  const token = localStorage.getItem("authToken");
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

export default function AdminWhatsAppIntegrationPage() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingMessage, setTestingMessage] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [message, setMessage] = useState(null);
  const [activeTab, setActiveTab] = useState("credentials");
  const [templates, setTemplates] = useState([]);
  const [placeholders, setPlaceholders] = useState([]);
  const [rules, setRules] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logsTotal, setLogsTotal] = useState(0);

  // Form state for credentials
  const [form, setForm] = useState({
    account_sid: "",
    auth_token: "",
    whatsapp_number: "",
    webhook_url: "",
    is_enabled: false
  });

  useEffect(() => {
    loadConfig();
    loadTemplates();
    loadRules();
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
        if (data.configured) {
          setForm({
            account_sid: "",
            auth_token: "",
            whatsapp_number: data.whatsapp_number || "",
            webhook_url: data.webhook_url || "",
            is_enabled: data.is_enabled || false
          });
        }
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

  async function loadRules() {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/admin/notification-rules`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
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

  async function handleSaveConfig() {
    if (!form.account_sid && !config?.configured) {
      showMessage("Account SID is required.", "error");
      return;
    }
    if (!form.auth_token && !config?.configured) {
      showMessage("Auth Token is required.", "error");
      return;
    }
    if (!form.whatsapp_number) {
      showMessage("WhatsApp Number is required.", "error");
      return;
    }
    setSaving(true);
    try {
      const body = { ...form };
      // If fields are empty and already configured, skip sending them
      if (!body.account_sid && config?.configured) body.account_sid = "AC_UNCHANGED_PLACEHOLDER_SID_XX";
      if (!body.auth_token && config?.configured) body.auth_token = "UNCHANGED_PLACEHOLDER_TOKEN_XX";

      const res = await fetch(`${API_BASE}/api/whatsapp/admin/config`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        showMessage("Configuration saved successfully.");
        setConfig(data.config);
        loadLogs();
      } else {
        showMessage(data.message || "Failed to save.", "error");
      }
    } catch (err) {
      showMessage(err.message, "error");
    } finally {
      setSaving(false);
    }
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
        setForm((prev) => ({ ...prev, is_enabled: enabled }));
        showMessage(enabled ? "WhatsApp integration enabled." : "WhatsApp integration disabled.");
        loadLogs();
      } else {
        showMessage(data.message || "Failed to toggle.", "error");
      }
    } catch (err) {
      showMessage(err.message, "error");
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/admin/test-connection`, {
        method: "POST",
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        showMessage(`Connected: ${data.accountName} (${data.status})`);
        loadConfig();
        loadLogs();
      } else {
        showMessage(data.error || data.message || "Connection failed.", "error");
      }
    } catch (err) {
      showMessage(err.message, "error");
    } finally {
      setTesting(false);
    }
  }

  async function handleTestMessage() {
    if (!testPhone.trim()) { showMessage("Enter a phone number.", "error"); return; }
    setTestingMessage(true);
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/admin/test-message`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ phone: testPhone.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        showMessage("Test message sent successfully.");
        loadLogs();
      } else {
        showMessage(data.error || data.message || "Test failed.", "error");
      }
    } catch (err) {
      showMessage(err.message, "error");
    } finally {
      setTestingMessage(false);
    }
  }

  async function handleRuleToggle(ruleType, enabled) {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/admin/notification-rules/${ruleType}`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify({ is_enabled: enabled })
      });
      if (res.ok) { loadRules(); }
    } catch { /* non-critical */ }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-xl border border-[#f0d2ca] px-5 py-16 text-[#7b6660]">
        <Loader2 size={20} className="animate-spin" /> Loading WhatsApp integration settings...
      </div>
    );
  }

  const tabs = [
    { key: "credentials", label: "Credentials", icon: Key },
    { key: "templates", label: "Templates", icon: FileText },
    { key: "rules", label: "Notification Rules", icon: Bell },
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

      {/* Credentials Tab */}
      {activeTab === "credentials" && (
        <div className="space-y-6">
          {/* Twilio Credentials Form */}
          <div className="rounded-xl border border-[#f0d2ca] bg-white p-6">
            <div className="flex items-center gap-3 mb-5">
              <Shield size={20} className="text-[#F38978]" />
              <div>
                <h3 className="text-base font-bold text-[#251E1F]">Twilio Credentials</h3>
                <p className="text-xs text-[#7b6660]">Credentials are encrypted before storage. Never exposed to Finance users.</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-[#7b6660]">Account SID</span>
                <input type="text" value={form.account_sid}
                  onChange={(e) => setForm((p) => ({ ...p, account_sid: e.target.value }))}
                  placeholder={config?.configured ? config.account_sid_masked : "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
                  className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white px-3 py-2.5 text-sm text-[#251E1F] outline-none placeholder:text-[#7b6660]/50 focus:border-[#F38978]" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-[#7b6660]">Auth Token</span>
                <input type="password" value={form.auth_token}
                  onChange={(e) => setForm((p) => ({ ...p, auth_token: e.target.value }))}
                  placeholder={config?.configured ? "••••••••••••" : "Enter auth token"}
                  className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white px-3 py-2.5 text-sm text-[#251E1F] outline-none placeholder:text-[#7b6660]/50 focus:border-[#F38978]" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-[#7b6660]">WhatsApp Number</span>
                <input type="text" value={form.whatsapp_number}
                  onChange={(e) => setForm((p) => ({ ...p, whatsapp_number: e.target.value }))}
                  placeholder="whatsapp:+14155238886"
                  className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white px-3 py-2.5 text-sm text-[#251E1F] outline-none placeholder:text-[#7b6660]/50 focus:border-[#F38978]" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-[#7b6660]">Webhook URL (optional)</span>
                <input type="text" value={form.webhook_url}
                  onChange={(e) => setForm((p) => ({ ...p, webhook_url: e.target.value }))}
                  placeholder="https://yourdomain.com/api/whatsapp/webhook/status"
                  className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white px-3 py-2.5 text-sm text-[#251E1F] outline-none placeholder:text-[#7b6660]/50 focus:border-[#F38978]" />
              </label>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={handleSaveConfig} disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-[#F38978] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#F38978]/20 transition hover:bg-[#e87562] disabled:opacity-60">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                Save Credentials
              </button>
              <button type="button" onClick={handleTestConnection} disabled={testing || !config?.configured}
                className="inline-flex items-center gap-2 rounded-xl border border-[#f0d2ca] px-5 py-2.5 text-sm font-semibold text-[#251E1F] transition hover:bg-[#FDD9CD]/30 disabled:opacity-50">
                {testing ? <Loader2 size={15} className="animate-spin" /> : <Wifi size={15} />}
                Test Connection
              </button>
            </div>
          </div>

          {/* Test Message */}
          <div className="rounded-xl border border-[#f0d2ca] bg-white p-6">
            <div className="flex items-center gap-3 mb-4">
              <Send size={20} className="text-[#F38978]" />
              <div>
                <h3 className="text-base font-bold text-[#251E1F]">Send Test Message</h3>
                <p className="text-xs text-[#7b6660]">Verify WhatsApp delivery by sending a test message.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <input type="text" value={testPhone} onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+6591234567"
                className="flex-1 max-w-xs rounded-lg border border-[#f0d2ca] bg-white px-3 py-2.5 text-sm text-[#251E1F] outline-none placeholder:text-[#7b6660]/50 focus:border-[#F38978]" />
              <button type="button" onClick={handleTestMessage} disabled={testingMessage || !config?.configured}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">
                {testingMessage ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Send Test
              </button>
            </div>
          </div>

          {/* Webhook Status */}
          <div className="rounded-xl border border-[#f0d2ca] bg-white p-6">
            <div className="flex items-center gap-3 mb-4">
              <Settings2 size={20} className="text-[#F38978]" />
              <h3 className="text-base font-bold text-[#251E1F]">Webhook Status</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full ${config?.webhook_url ? "bg-emerald-500" : "bg-amber-500"}`} />
                <span className="text-[#251E1F]">Status Callback URL: {config?.webhook_url || "Not configured"}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full ${config?.connection_status === "connected" ? "bg-emerald-500" : "bg-amber-500"}`} />
                <span className="text-[#251E1F]">Connection: {config?.connection_status || "untested"}</span>
              </div>
              {config?.last_tested_at && (
                <p className="text-xs text-[#7b6660]">Last tested: {new Date(config.last_tested_at).toLocaleString("en-SG")}</p>
              )}
              {config?.account_name && (
                <p className="text-xs text-[#7b6660]">Account: {config.account_name}</p>
              )}
            </div>
          </div>
        </div>
      )}

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

      {/* Notification Rules Tab */}
      {activeTab === "rules" && (
        <div className="rounded-xl border border-[#f0d2ca] bg-white p-6">
          <div className="flex items-center gap-3 mb-5">
            <Bell size={20} className="text-[#F38978]" />
            <div>
              <h3 className="text-base font-bold text-[#251E1F]">Default Notification Rules</h3>
              <p className="text-xs text-[#7b6660]">Configure which events automatically trigger WhatsApp messages.</p>
            </div>
          </div>
          <div className="space-y-3">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between rounded-lg border border-[#f0d2ca] bg-[#fff8f5] px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-[#251E1F] capitalize">{rule.rule_type.replace(/_/g, " ")}</p>
                  {rule.reminder_days_before && (
                    <p className="text-xs text-[#7b6660]">Reminder days: {JSON.stringify(rule.reminder_days_before)}</p>
                  )}
                </div>
                <Toggle checked={rule.is_enabled} onChange={(val) => handleRuleToggle(rule.rule_type, val)} />
              </div>
            ))}
            {rules.length === 0 && (
              <p className="text-center text-sm text-[#7b6660] py-8">No notification rules found.</p>
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
