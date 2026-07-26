import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Mail,
  MessageCircle,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Wifi,
  WifiOff,
  XCircle
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  createReminderSetting,
  fetchReminderSettings,
  sendTestReminder,
  updateReminderSetting
} from "../../services/adminReminderService.js";
import {
  getWhatsAppConfig,
  getWhatsAppMessages,
  getWhatsAppNotificationRules,
  getWhatsAppTemplates
} from "../../services/whatsappService.js";

const tabs = [
  { id: "policy", label: "Policy", icon: CalendarClock },
  { id: "email", label: "Email", icon: Mail },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "logs", label: "Delivery Logs", icon: FileText }
];

const placeholders = [
  "{{client_name}}",
  "{{invoice_number}}",
  "{{amount_due}}",
  "{{due_date}}",
  "{{overdue_days}}",
  "{{company_name}}",
  "{{payment_link}}"
];

const defaultForm = {
  id: null,
  ruleName: "Invoice reminder policy",
  enabled: false,
  frequency: "Weekdays",
  reminderTime: "09:00",
  timezone: "Asia/Singapore",
  deliveryChannel: "Email",
  firstReminderDays: 1,
  secondReminderDays: 16,
  finalReminderDays: 31,
  templateName: "Overdue Invoice Reminder",
  emailSubject: "Reminder: Invoice {{invoice_number}} is overdue",
  emailBody:
    "Dear {{client_name}},\n\nThis is a reminder that invoice {{invoice_number}} for {{amount_due}} was due on {{due_date}} and is now {{overdue_days}} days overdue.\n\nPlease make payment here: {{payment_link}}\n\nRegards,\n{{company_name}}",
  testEmail: ""
};

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function renderPreview(text, form) {
  return String(text || "")
    .replaceAll("{{client_name}}", "Acme Supplies")
    .replaceAll("{{invoice_number}}", "INV-2026-001")
    .replaceAll("{{amount_due}}", "SGD 1,280.00")
    .replaceAll("{{due_date}}", "15 May 2026")
    .replaceAll("{{overdue_days}}", String(form.firstReminderDays || 1))
    .replaceAll("{{company_name}}", "PayNivo")
    .replaceAll("{{payment_link}}", "https://pay.example.com/INV-2026-001");
}

function Panel({ title, description, icon: Icon, action, children }) {
  return (
    <section className="app-panel rounded-xl p-5">
      <div className="mb-5 flex flex-col gap-3 border-b border-[#f0d2ca] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F38978]/15 text-[#F38978]">
            <Icon size={20} />
          </div>
          <div>
            <h3 className="font-bold text-[#251E1F]">{title}</h3>
            {description ? <p className="mt-1 text-sm text-[#7b6660]">{description}</p> : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatusPill({ active, activeText = "Active", inactiveText = "Inactive" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
      active
        ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-700"
        : "border-slate-400/30 bg-slate-500/10 text-slate-600"
    }`}>
      {active ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
      {active ? activeText : inactiveText}
    </span>
  );
}

export default function AdminReminderSettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("policy");
  const [form, setForm] = useState(defaultForm);
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState({
    activeReminderRules: 0,
    remindersSentToday: 0,
    failedDeliveries: 0,
    missingCustomerEmails: 0
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [logChannel, setLogChannel] = useState("All");
  const [logStatus, setLogStatus] = useState("All");
  const [whatsApp, setWhatsApp] = useState({
    loading: true,
    config: null,
    templates: [],
    rules: [],
    messages: [],
    error: ""
  });

  const timeline = useMemo(() => [
    { label: "Due date", value: "Day 0" },
    { label: "First", value: `Day ${form.firstReminderDays || 0}` },
    { label: "Second", value: `Day ${form.secondReminderDays || 0}` },
    { label: "Final", value: `Day ${form.finalReminderDays || 0}` }
  ], [form.firstReminderDays, form.secondReminderDays, form.finalReminderDays]);

  const combinedLogs = useMemo(() => {
    const emailLogs = logs.map((log) => ({
      id: `email-${log.id}`,
      invoiceNumber: log.invoiceNumber,
      recipient: log.clientEmail,
      type: log.reminderType,
      channel: "Email",
      status: log.deliveryStatus,
      sentAt: log.sentAt,
      error: log.errorMessage
    }));
    const whatsAppLogs = whatsApp.messages
      .filter((item) => ["payment_reminder", "overdue_notice"].includes(item.message_type))
      .map((item) => ({
        id: `whatsapp-${item.id}`,
        invoiceNumber: item.invoice_number || `Invoice ${item.invoice_id || "-"}`,
        recipient: item.recipient_name || item.recipient_phone,
        type: item.message_type === "overdue_notice" ? "Overdue Notice" : "Payment Reminder",
        channel: "WhatsApp",
        status: item.status,
        sentAt: item.sent_at || item.created_at,
        error: item.error_message
      }));
    return [...emailLogs, ...whatsAppLogs]
      .filter((item) => logChannel === "All" || item.channel === logChannel)
      .filter((item) => logStatus === "All" || String(item.status).toLowerCase() === logStatus.toLowerCase())
      .sort((a, b) => new Date(b.sentAt || 0) - new Date(a.sentAt || 0));
  }, [logs, whatsApp.messages, logChannel, logStatus]);

  const reminderTemplate = whatsApp.templates.find((item) => item.is_default)
    || whatsApp.templates[0]
    || null;
  const reminderRule = whatsApp.rules.find((item) => item.rule_type === "payment_reminder")
    || null;
  const whatsAppReady = Boolean(
    whatsApp.config?.configured
    && whatsApp.config?.is_enabled
    && whatsApp.config?.connection_status === "connected"
  );

  async function loadReminderData() {
    setLoading(true);
    try {
      const data = await fetchReminderSettings();
      setLogs(data.logs || []);
      setSummary(data.summary || {});
      if (data.settings?.[0]) {
        setForm((current) => ({
          ...defaultForm,
          ...data.settings[0],
          testEmail: current.testEmail
        }));
      }
    } catch (error) {
      setErrors([error.message]);
    } finally {
      setLoading(false);
    }
  }

  async function loadWhatsAppData() {
    setWhatsApp((current) => ({ ...current, loading: true, error: "" }));
    const [configResult, templateResult, ruleResult, messageResult] = await Promise.allSettled([
      getWhatsAppConfig(),
      getWhatsAppTemplates("payment_reminder"),
      getWhatsAppNotificationRules(),
      getWhatsAppMessages({ limit: 100 })
    ]);
    setWhatsApp({
      loading: false,
      config: configResult.status === "fulfilled" ? configResult.value : null,
      templates: templateResult.status === "fulfilled" ? templateResult.value.templates || [] : [],
      rules: ruleResult.status === "fulfilled" ? ruleResult.value.rules || [] : [],
      messages: messageResult.status === "fulfilled" ? messageResult.value.messages || [] : [],
      error: configResult.status === "rejected" ? configResult.reason?.message || "Unable to load WhatsApp status." : ""
    });
  }

  useEffect(() => {
    loadReminderData();
    loadWhatsAppData();
  }, []);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function validateForm() {
    const nextErrors = [];
    if (!["Daily", "Weekdays"].includes(form.frequency)) nextErrors.push("Select Daily or Weekdays.");
    if (!form.reminderTime) nextErrors.push("Reminder time is required.");
    if (!Number.isInteger(Number(form.firstReminderDays)) || Number(form.firstReminderDays) < 1) {
      nextErrors.push("First reminder must be at least 1 day overdue.");
    }
    if (Number(form.secondReminderDays) <= Number(form.firstReminderDays)) {
      nextErrors.push("Second reminder must be after the first reminder.");
    }
    if (Number(form.finalReminderDays) <= Number(form.secondReminderDays)) {
      nextErrors.push("Final reminder must be after the second reminder.");
    }
    if (!form.emailSubject.trim()) nextErrors.push("Email subject is required.");
    if (!form.emailBody.trim()) nextErrors.push("Email body is required.");
    ["{{client_name}}", "{{invoice_number}}", "{{amount_due}}", "{{due_date}}"].forEach((placeholder) => {
      if (!form.emailBody.includes(placeholder)) nextErrors.push(`Email body is missing ${placeholder}.`);
    });
    return nextErrors;
  }

  async function savePolicy(successMessage) {
    const nextErrors = validateForm();
    setErrors(nextErrors);
    setMessage("");
    if (nextErrors.length) return;

    setSaving(true);
    try {
      const payload = { ...form };
      delete payload.testEmail;
      if (form.id) await updateReminderSetting(form.id, payload);
      else await createReminderSetting(payload);
      await loadReminderData();
      setMessage(successMessage);
    } catch (error) {
      setErrors([error.message]);
    } finally {
      setSaving(false);
    }
  }

  async function handleTestEmail() {
    const nextErrors = validateForm();
    if (!form.testEmail) nextErrors.push("Test recipient email is required.");
    setErrors(nextErrors);
    setMessage("");
    if (nextErrors.length) return;
    try {
      await sendTestReminder({ to: form.testEmail, setting: form });
      setMessage("Test reminder email sent.");
    } catch (error) {
      setErrors([error.message]);
    }
  }

  if (loading) {
    return (
      <div className="app-panel flex min-h-[420px] items-center justify-center gap-2 rounded-xl text-sm font-semibold text-[#7b6660]">
        <Loader2 className="animate-spin" size={18} />
        Loading reminder settings...
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-bold text-[#F38978]">Admin · Customer Communications</p>
          <h2 className="mt-1 text-2xl font-bold text-[#251E1F]">Reminder Settings</h2>
          <p className="mt-1 text-sm text-[#7b6660]">
            Configure each reminder channel separately. Finance receives read-only policy updates and delivery notifications.
          </p>
        </div>
        <StatusPill
          active={form.enabled}
          activeText="Automatic email reminders active"
          inactiveText="Automatic email reminders disabled"
        />
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Policy", form.enabled ? "Active" : "Disabled", BellRing],
          ["Sent today", summary.remindersSentToday || 0, Send],
          ["Failed today", summary.failedDeliveries || 0, XCircle],
          ["Missing email", summary.missingCustomerEmails || 0, Mail]
        ].map(([label, value, Icon]) => (
          <div key={label} className="app-panel flex items-center justify-between rounded-xl px-4 py-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#7b6660]">{label}</p>
              <p className="mt-1 text-lg font-bold text-[#251E1F]">{value}</p>
            </div>
            <Icon className="text-[#F38978]" size={20} />
          </div>
        ))}
      </div>

      {errors.length ? (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errors.map((error) => <p key={error}>{error}</p>)}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <nav className="grid grid-cols-2 gap-1 rounded-xl border border-[#f0d2ca] bg-white/80 p-1.5 lg:grid-cols-4" aria-label="Reminder settings sections">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setErrors([]);
                setMessage("");
              }}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold transition ${
                activeTab === tab.id
                  ? "bg-[#F38978] text-white shadow-sm"
                  : "text-[#7b6660] hover:bg-[#FDD9CD]/30 hover:text-[#251E1F]"
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {activeTab === "policy" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Panel
            title="Reminder Policy"
            description="Control when automatic email reminders run."
            icon={CalendarClock}
            action={<StatusPill active={form.enabled} />}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center justify-between rounded-lg border border-[#f0d2ca] bg-[#fff8f5] px-4 py-3 md:col-span-2">
                <span>
                  <span className="block text-sm font-bold text-[#251E1F]">Automatic email reminders</span>
                  <span className="mt-0.5 block text-xs text-[#7b6660]">Admin controls this company-wide policy.</span>
                </span>
                <input type="checkbox" checked={form.enabled} onChange={(event) => setField("enabled", event.target.checked)} className="h-5 w-5 accent-[#F38978]" />
              </label>
              <label>
                <span className="text-sm font-semibold text-[#7b6660]">Run schedule</span>
                <select value={form.frequency} onChange={(event) => setField("frequency", event.target.value)} className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white px-3 py-2.5 text-sm">
                  <option value="Daily">Daily</option>
                  <option value="Weekdays">Weekdays</option>
                </select>
              </label>
              <label>
                <span className="text-sm font-semibold text-[#7b6660]">Send time</span>
                <input type="time" value={form.reminderTime} onChange={(event) => setField("reminderTime", event.target.value)} className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white px-3 py-2.5 text-sm" />
              </label>
              <div className="rounded-lg border border-[#f0d2ca] bg-[#fff8f5] px-4 py-3 md:col-span-2">
                <p className="text-xs font-bold uppercase tracking-wide text-[#7b6660]">Timezone</p>
                <p className="mt-1 text-sm font-bold text-[#251E1F]">Asia/Singapore</p>
              </div>
              {[
                ["firstReminderDays", "First reminder", 1],
                ["secondReminderDays", "Second reminder", 2],
                ["finalReminderDays", "Final reminder", 3]
              ].map(([field, label, min]) => (
                <label key={field} className={field === "finalReminderDays" ? "md:col-span-2" : ""}>
                  <span className="text-sm font-semibold text-[#7b6660]">{label} — days overdue</span>
                  <input type="number" min={min} value={form[field]} onChange={(event) => setField(field, event.target.value)} className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white px-3 py-2.5 text-sm" />
                </label>
              ))}
            </div>
            <button type="button" disabled={saving} onClick={() => savePolicy("Reminder policy saved. Finance has been notified.")} className="primary-button mt-5 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold disabled:opacity-60">
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Save Policy
            </button>
          </Panel>

          <div className="space-y-5">
            <Panel title="Timeline" description="Current overdue sequence." icon={Clock3}>
              <div className="space-y-3">
                {timeline.map((item, index) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F38978]/15 text-xs font-bold text-[#F38978]">{index}</div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-[#251E1F]">{item.label}</p>
                      <p className="text-xs text-[#7b6660]">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Safeguards" description="Always enforced by the server." icon={ShieldCheck}>
              <div className="space-y-2">
                {[
                  "Outstanding invoices only",
                  "Stop after payment",
                  "Exclude cancelled, void and refunded",
                  "Skip missing customer email"
                ].map((item) => (
                  <p key={item} className="flex items-center gap-2 text-sm text-[#514440]">
                    <CheckCircle2 className="text-emerald-600" size={15} />
                    {item}
                  </p>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      ) : null}

      {activeTab === "email" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Panel title="Email Template" description="Used by automatic reminders and Finance manual reminders." icon={Mail}>
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-[#7b6660]">Subject</span>
                <input value={form.emailSubject} onChange={(event) => setField("emailSubject", event.target.value)} className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white px-3 py-2.5 text-sm" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[#7b6660]">Message</span>
                <textarea rows="11" value={form.emailBody} onChange={(event) => setField("emailBody", event.target.value)} className="mt-1 w-full resize-y rounded-lg border border-[#f0d2ca] bg-white px-3 py-2.5 text-sm" />
              </label>
              <div className="flex flex-wrap gap-2">
                {placeholders.map((placeholder) => (
                  <button key={placeholder} type="button" onClick={() => setField("emailBody", `${form.emailBody} ${placeholder}`)} className="rounded-full border border-[#f0d2ca] bg-[#fff8f5] px-3 py-1 text-xs font-bold text-[#7b6660] hover:border-[#F38978]">
                    {placeholder}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={saving} onClick={() => savePolicy("Email template saved. Finance now sees the updated template.")} className="primary-button inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold disabled:opacity-60">
                  <Save size={16} />
                  Save Email
                </button>
                <button type="button" onClick={() => setShowPreview((current) => !current)} className="inline-flex items-center gap-2 rounded-lg border border-[#f0d2ca] bg-white px-4 py-2.5 text-sm font-bold text-[#514440]">
                  <Eye size={16} />
                  {showPreview ? "Hide Preview" : "Preview"}
                </button>
              </div>
            </div>
          </Panel>

          <div className="space-y-5">
            <Panel title="Send Test" description="Test without changing the saved policy." icon={Send}>
              <label className="block">
                <span className="text-sm font-semibold text-[#7b6660]">Recipient email</span>
                <input type="email" value={form.testEmail} onChange={(event) => setField("testEmail", event.target.value)} placeholder="admin@example.com" className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white px-3 py-2.5 text-sm" />
              </label>
              <button type="button" onClick={handleTestEmail} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#F38978]/30 bg-[#F38978]/15 px-4 py-2.5 text-sm font-bold text-[#251E1F]">
                <Send size={16} />
                Send Test Email
              </button>
            </Panel>
            {showPreview ? (
              <Panel title="Customer Preview" description="Example values are used." icon={Eye}>
                <p className="text-sm font-bold text-[#251E1F]">{renderPreview(form.emailSubject, form)}</p>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-[#fff8f5] p-3 text-sm font-sans text-[#514440]">{renderPreview(form.emailBody, form)}</pre>
              </Panel>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeTab === "whatsapp" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <Panel
            title="WhatsApp Reminder Channel"
            description="Status is read from the existing Twilio WhatsApp integration."
            icon={MessageCircle}
            action={<StatusPill active={whatsAppReady} activeText="Ready" inactiveText="Not ready" />}
          >
            {whatsApp.loading ? (
              <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-[#7b6660]"><Loader2 className="animate-spin" size={17} />Loading WhatsApp status...</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-[#f0d2ca] bg-[#fff8f5] p-4">
                  <p className="text-xs font-bold uppercase text-[#7b6660]">Configuration</p>
                  <p className="mt-2 flex items-center gap-2 font-bold text-[#251E1F]">
                    {whatsApp.config?.configured ? <Wifi className="text-emerald-600" size={17} /> : <WifiOff className="text-slate-500" size={17} />}
                    {whatsApp.config?.configured ? "Credentials configured" : "Not configured"}
                  </p>
                </div>
                <div className="rounded-lg border border-[#f0d2ca] bg-[#fff8f5] p-4">
                  <p className="text-xs font-bold uppercase text-[#7b6660]">Integration</p>
                  <p className="mt-2 font-bold text-[#251E1F]">{whatsApp.config?.is_enabled ? "Enabled" : "Disabled"}</p>
                </div>
                <div className="rounded-lg border border-[#f0d2ca] bg-[#fff8f5] p-4">
                  <p className="text-xs font-bold uppercase text-[#7b6660]">Connected number</p>
                  <p className="mt-2 font-bold text-[#251E1F]">{whatsApp.config?.whatsapp_number || "-"}</p>
                </div>
                <div className="rounded-lg border border-[#f0d2ca] bg-[#fff8f5] p-4">
                  <p className="text-xs font-bold uppercase text-[#7b6660]">Connection status</p>
                  <p className="mt-2 font-bold capitalize text-[#251E1F]">{whatsApp.config?.connection_status || "Untested"}</p>
                  <p className="mt-1 text-xs text-[#7b6660]">Last tested: {formatDate(whatsApp.config?.last_tested_at)}</p>
                </div>
              </div>
            )}
            {whatsApp.error ? <p className="mt-4 text-sm text-rose-700">{whatsApp.error}</p> : null}
            <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
              WhatsApp manual payment reminders are available when the integration is connected. The scheduled Admin reminder policy currently sends Email only; WhatsApp timing and templates remain managed in WhatsApp Integration.
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => navigate("/dashboard/invoicing/admin/integrations/whatsapp")} className="primary-button inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold">
                <ExternalLink size={16} />
                Open WhatsApp Integration
              </button>
              <button type="button" onClick={loadWhatsAppData} className="inline-flex items-center gap-2 rounded-lg border border-[#f0d2ca] bg-white px-4 py-2.5 text-sm font-bold text-[#514440]">
                <RefreshCw size={16} />
                Refresh Status
              </button>
            </div>
          </Panel>

          <div className="space-y-5">
            <Panel title="Payment Reminder Rule" description="Configured in WhatsApp Integration." icon={BellRing}>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between"><span className="text-[#7b6660]">Rule</span><StatusPill active={Boolean(reminderRule?.is_enabled)} /></div>
                <div className="flex items-center justify-between gap-3"><span className="text-[#7b6660]">Default template</span><span className="text-right font-bold text-[#251E1F]">{reminderTemplate?.template_name || "Not selected"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-[#7b6660]">Active templates</span><span className="font-bold text-[#251E1F]">{whatsApp.templates.filter((item) => item.is_active).length}</span></div>
              </div>
            </Panel>
            <Panel title="Channel Ownership" description="Keep responsibilities separate." icon={ShieldCheck}>
              <div className="space-y-2 text-sm text-[#514440]">
                <p><strong>Reminder Policy:</strong> automatic Email schedule</p>
                <p><strong>Email tab:</strong> Email subject and body</p>
                <p><strong>WhatsApp Integration:</strong> Twilio, WhatsApp rules and templates</p>
                <p><strong>Finance:</strong> read-only policy and manual customer actions</p>
              </div>
            </Panel>
          </div>
        </div>
      ) : null}

      {activeTab === "logs" ? (
        <Panel
          title="Reminder Delivery Logs"
          description="Email and WhatsApp reminder attempts are shown together without mixing their settings."
          icon={FileText}
          action={(
            <button type="button" onClick={() => { loadReminderData(); loadWhatsAppData(); }} className="inline-flex items-center gap-2 rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm font-bold text-[#514440]">
              <RefreshCw size={15} />
              Refresh
            </button>
          )}
        >
          <div className="mb-4 flex flex-wrap gap-3">
            <label>
              <span className="sr-only">Channel</span>
              <select value={logChannel} onChange={(event) => setLogChannel(event.target.value)} className="rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm">
                <option>All</option>
                <option>Email</option>
                <option>WhatsApp</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Status</span>
              <select value={logStatus} onChange={(event) => setLogStatus(event.target.value)} className="rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm">
                <option>All</option>
                <option>Sent</option>
                <option>Failed</option>
                <option>Delivered</option>
                <option>Read</option>
                <option>Queued</option>
              </select>
            </label>
          </div>
          <div className="max-h-[520px] overflow-auto rounded-lg border border-[#f0d2ca]">
            <table className="min-w-[900px] w-full text-left text-sm">
              <thead className="sticky top-0 bg-[#fff8f5] text-xs font-bold uppercase text-[#7b6660]">
                <tr>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Recipient</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Sent At</th>
                  <th className="px-4 py-3">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0d2ca] bg-white">
                {combinedLogs.length ? combinedLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-3 font-bold text-[#251E1F]">{log.invoiceNumber || "-"}</td>
                    <td className="px-4 py-3 text-[#7b6660]">{log.recipient || "-"}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-[#F38978]/10 px-2.5 py-1 text-xs font-bold text-[#F38978]">{log.channel}</span></td>
                    <td className="px-4 py-3 text-[#514440]">{log.type}</td>
                    <td className="px-4 py-3"><StatusPill active={["sent", "delivered", "read"].includes(String(log.status).toLowerCase())} activeText={log.status} inactiveText={log.status} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#7b6660]">{formatDate(log.sentAt)}</td>
                    <td className="max-w-64 truncate px-4 py-3 text-rose-700" title={log.error}>{log.error || "-"}</td>
                  </tr>
                )) : (
                  <tr><td colSpan="7" className="px-4 py-12 text-center text-[#7b6660]">No reminder deliveries match the selected filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
    </section>
  );
}
