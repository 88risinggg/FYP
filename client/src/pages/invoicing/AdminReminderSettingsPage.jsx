import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  Mail,
  Pencil,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  XCircle
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

import {
  createReminderSetting,
  deleteReminderSetting,
  fetchReminderSettings,
  sendTestReminder,
  updateReminderSetting,
  updateReminderStatus
} from "../../services/adminReminderService.js";

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
  ruleName: "Standard overdue invoice reminders",
  enabled: true,
  frequency: "Daily",
  reminderTime: "09:00",
  timezone: "Asia/Singapore",
  deliveryChannel: "Email",
  whatsappEnabled: false,
  firstReminderDays: 1,
  secondReminderDays: 16,
  finalReminderDays: 31,
  unpaidOnly: true,
  stopWhenPaid: true,
  excludeCancelled: true,
  includePdf: true,
  templateName: "Overdue Invoice Reminder",
  emailSubject: "Reminder: Invoice {{invoice_number}} is overdue",
  emailBody:
    "Dear {{client_name}},\n\nThis is a reminder that invoice {{invoice_number}} for {{amount_due}} was due on {{due_date}} and is now {{overdue_days}} days overdue.\n\nPlease make payment here: {{payment_link}}\n\nRegards,\n{{company_name}}",
  testEmail: ""
};

function statusPill(enabled) {
  return enabled
    ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
    : "border-rose-300/30 bg-rose-400/10 text-rose-200";
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function renderPreview(text, form) {
  return String(text || "")
    .replaceAll("{{client_name}}", "Acme Supplies")
    .replaceAll("{{invoice_number}}", "INV-2026-001")
    .replaceAll("{{amount_due}}", "$1,280.00")
    .replaceAll("{{due_date}}", "15 May 2026")
    .replaceAll("{{overdue_days}}", String(form.firstReminderDays || 1))
    .replaceAll("{{company_name}}", "PayNivo")
    .replaceAll("{{payment_link}}", "https://pay.example.com/INV-2026-001");
}

export default function AdminReminderSettingsPage() {
  const [settings, setSettings] = useState([]);
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState({
    activeReminderRules: 0,
    remindersSentToday: 0,
    failedDeliveries: 0,
    paidInvoicesExcluded: 0
  });
  const [form, setForm] = useState(defaultForm);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  const timeline = useMemo(
    () => [
      { label: "Invoice Due Date", value: "Day 0", icon: FileText },
      { label: "1st Reminder", value: `${form.firstReminderDays || 0} days`, icon: BellRing },
      { label: "2nd Reminder", value: `${form.secondReminderDays || 0} days`, icon: Mail },
      { label: "Final Reminder", value: `${form.finalReminderDays || 0}+ days`, icon: ShieldCheck }
    ],
    [form.firstReminderDays, form.secondReminderDays, form.finalReminderDays]
  );

  async function loadData() {
    setLoading(true);
    setErrors([]);

    try {
      const data = await fetchReminderSettings();
      setSettings(data.settings || []);
      setLogs(data.logs || []);
      setSummary(data.summary || summary);
    } catch (error) {
      setErrors([error.message]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function validateForm() {
    const nextErrors = [];
    if (!form.frequency) nextErrors.push("Reminder frequency is required.");
    if (!form.reminderTime) nextErrors.push("Reminder time is required.");
    if (!form.timezone) nextErrors.push("Time zone is required.");
    if (!form.deliveryChannel) nextErrors.push("Delivery channel is required.");
    if (!Number(form.firstReminderDays) || Number(form.firstReminderDays) < 1) {
      nextErrors.push("1st reminder overdue interval must be at least 1 day.");
    }
    if (Number(form.secondReminderDays) <= Number(form.firstReminderDays)) {
      nextErrors.push("2nd reminder overdue interval must be greater than 1st reminder.");
    }
    if (!form.emailSubject.trim()) nextErrors.push("Email subject is required.");
    if (!form.emailBody.trim()) nextErrors.push("Email body is required.");
    ["{{client_name}}", "{{invoice_number}}", "{{amount_due}}", "{{due_date}}"].forEach((placeholder) => {
      if (!form.emailBody.includes(placeholder)) {
        nextErrors.push(`Email body is missing ${placeholder}.`);
      }
    });
    return nextErrors;
  }

  async function handleSave(event) {
    event.preventDefault();
    setMessage("");
    const nextErrors = validateForm();
    setErrors(nextErrors);
    if (nextErrors.length > 0) return;

    try {
      const payload = { ...form };
      delete payload.testEmail;
      if (form.id) {
        await updateReminderSetting(form.id, payload);
        setMessage("Reminder rule updated.");
      } else {
        await createReminderSetting(payload);
        setMessage("Reminder rule saved.");
      }
      setForm(defaultForm);
      await loadData();
    } catch (error) {
      setErrors([error.message]);
    }
  }

  async function handleEdit(setting) {
    setForm({ ...defaultForm, ...setting, testEmail: "" });
    setMessage("");
    setErrors([]);
  }

  async function handleStatus(setting) {
    try {
      await updateReminderStatus(setting.id, !setting.enabled);
      setMessage(setting.enabled ? "Reminder rule disabled." : "Reminder rule enabled.");
      await loadData();
    } catch (error) {
      setErrors([error.message]);
    }
  }

  async function handleDelete(setting) {
    try {
      await deleteReminderSetting(setting.id);
      setMessage("Reminder rule deleted.");
      await loadData();
    } catch (error) {
      setErrors([error.message]);
    }
  }

  async function handleTestEmail() {
    setMessage("");
    const nextErrors = validateForm();
    if (!form.testEmail) nextErrors.push("Test recipient email is required.");
    setErrors(nextErrors);
    if (nextErrors.length > 0) return;

    try {
      const payload = { to: form.testEmail, setting: form };
      await sendTestReminder(payload);
      setMessage("Test reminder email sent.");
    } catch (error) {
      setErrors([error.message]);
    }
  }

  const summaryCards = [
    { label: "Active Reminder Rules", value: summary.activeReminderRules, icon: BellRing },
    { label: "Reminders Sent Today", value: summary.remindersSentToday, icon: Send },
    { label: "Failed Deliveries", value: summary.failedDeliveries, icon: XCircle },
    { label: "Paid Invoices Excluded", value: summary.paidInvoicesExcluded, icon: CheckCircle2 }
  ];

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-medium text-[#C77DFF]">Admin Manage Automated Reminder Settings</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">
            Automated Invoicing System - Reminder Settings
          </h2>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm(defaultForm);
            setErrors([]);
            setMessage("");
          }}
          className="neon-button inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold"
        >
          <Plus size={17} />
          New Reminder Rule
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="neon-glass neon-border rounded-lg p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-[#d8c6e8]">{card.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{card.value}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#C77DFF]/15 text-[#C77DFF] ring-1 ring-[#C77DFF]/25">
                  <Icon size={21} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {errors.length > 0 ? (
        <div className="rounded-lg border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {message}
        </div>
      ) : null}

      <form onSubmit={handleSave} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <div className="neon-glass neon-border rounded-lg p-5">
            <div className="mb-5 flex items-center gap-3">
              <CalendarClock className="text-[#C77DFF]" size={22} />
              <h3 className="text-lg font-semibold text-white">Reminder Configuration</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3">
                <span className="text-sm font-medium text-white">Enable automated reminders</span>
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(event) => setField("enabled", event.target.checked)}
                  className="h-5 w-5 accent-[#C77DFF]"
                />
              </label>
              <label>
                <span className="text-sm text-[#d8c6e8]">Reminder frequency</span>
                <select value={form.frequency} onChange={(event) => setField("frequency", event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#140026] px-3 py-2 text-sm text-white outline-none">
                  <option value="">Select frequency</option>
                  <option value="Daily">Daily</option>
                  <option value="Weekdays">Weekdays</option>
                  <option value="Weekly">Weekly</option>
                </select>
              </label>
              <label>
                <span className="text-sm text-[#d8c6e8]">Reminder time</span>
                <input type="time" value={form.reminderTime} onChange={(event) => setField("reminderTime", event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none" />
              </label>
              <label>
                <span className="text-sm text-[#d8c6e8]">Time zone</span>
                <select value={form.timezone} onChange={(event) => setField("timezone", event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#140026] px-3 py-2 text-sm text-white outline-none">
                  <option value="">Select time zone</option>
                  <option value="Asia/Singapore">Asia/Singapore</option>
                  <option value="UTC">UTC</option>
                  <option value="Asia/Kuala_Lumpur">Asia/Kuala_Lumpur</option>
                </select>
              </label>
              <div className="md:col-span-2 grid gap-3 sm:grid-cols-2">
                <label className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 p-4">
                  <input type="radio" checked={form.deliveryChannel === "Email"} onChange={() => setField("deliveryChannel", "Email")} className="mr-2 accent-[#C77DFF]" />
                  <span className="font-semibold text-white">Email enabled</span>
                  <p className="mt-1 text-xs text-emerald-100">Priority notification channel</p>
                </label>
                <label className="rounded-lg border border-white/10 bg-white/[0.04] p-4 opacity-70">
                  <input type="checkbox" disabled className="mr-2" />
                  <span className="font-semibold text-white">WhatsApp optional</span>
                  <p className="mt-1 text-xs text-[#d8c6e8]">Future enhancement only</p>
                </label>
              </div>
            </div>
          </div>

          <div className="neon-glass neon-border rounded-lg p-5">
            <div className="mb-5 flex items-center gap-3">
              <Clock3 className="text-[#C77DFF]" size={22} />
              <h3 className="text-lg font-semibold text-white">Overdue Reminder Intervals</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <label>
                <span className="text-sm text-[#d8c6e8]">1st reminder days overdue</span>
                <input type="number" min="1" value={form.firstReminderDays} onChange={(event) => setField("firstReminderDays", event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none" />
              </label>
              <label>
                <span className="text-sm text-[#d8c6e8]">2nd reminder days overdue</span>
                <input type="number" min="2" value={form.secondReminderDays} onChange={(event) => setField("secondReminderDays", event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none" />
              </label>
              <label>
                <span className="text-sm text-[#d8c6e8]">Final reminder days overdue</span>
                <input type="number" min="3" value={form.finalReminderDays} onChange={(event) => setField("finalReminderDays", event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none" />
              </label>
            </div>
          </div>

          <div className="neon-glass neon-border rounded-lg p-5">
            <h3 className="text-lg font-semibold text-white">Reminder Options</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[
                ["unpaidOnly", "Send reminders to unpaid invoices only"],
                ["stopWhenPaid", "Stop reminders when invoice status becomes Paid"],
                ["excludeCancelled", "Exclude cancelled invoices"],
                ["includePdf", "Include invoice PDF attachment"]
              ].map(([field, label]) => (
                <label key={field} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white">
                  <input type="checkbox" checked={form[field]} onChange={(event) => setField(field, event.target.checked)} className="h-4 w-4 accent-[#C77DFF]" />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="neon-glass neon-border rounded-lg p-5">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-white">Email Template</h3>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowPreview((current) => !current)} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-[#d8c6e8] hover:bg-white/10 hover:text-white">
                  <Eye size={15} />
                  Preview
                </button>
                <button type="button" onClick={handleTestEmail} className="inline-flex items-center gap-2 rounded-lg border border-[#C77DFF]/30 bg-[#C77DFF]/15 px-3 py-2 text-sm font-semibold text-white hover:bg-[#C77DFF]/25">
                  <Send size={15} />
                  Send Test
                </button>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className="text-sm text-[#d8c6e8]">Template name</span>
                <input value={form.templateName} onChange={(event) => setField("templateName", event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none" />
              </label>
              <label>
                <span className="text-sm text-[#d8c6e8]">Test recipient email</span>
                <input type="email" value={form.testEmail} onChange={(event) => setField("testEmail", event.target.value)} placeholder="admin@example.com" className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none placeholder:text-[#d8c6e8]/60" />
              </label>
              <label className="md:col-span-2">
                <span className="text-sm text-[#d8c6e8]">Email subject</span>
                <input value={form.emailSubject} onChange={(event) => setField("emailSubject", event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none" />
              </label>
              <label className="md:col-span-2">
                <span className="text-sm text-[#d8c6e8]">Email body</span>
                <textarea rows="8" value={form.emailBody} onChange={(event) => setField("emailBody", event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none" />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {placeholders.map((placeholder) => (
                <button key={placeholder} type="button" onClick={() => setField("emailBody", `${form.emailBody} ${placeholder}`)} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-[#d8c6e8] hover:bg-white/10 hover:text-white">
                  {placeholder}
                </button>
              ))}
            </div>
            {showPreview ? (
              <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-semibold text-white">{renderPreview(form.emailSubject, form)}</p>
                <pre className="mt-3 whitespace-pre-wrap text-sm text-[#d8c6e8]">{renderPreview(form.emailBody, form)}</pre>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="neon-glass neon-border rounded-lg p-5">
            <h3 className="text-lg font-semibold text-white">Reminder Timeline Preview</h3>
            <div className="mt-5 space-y-4">
              {timeline.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C77DFF]/15 text-[#C77DFF] ring-1 ring-[#C77DFF]/25">
                        <Icon size={18} />
                      </div>
                      {index < timeline.length - 1 ? <div className="h-8 w-px bg-white/15" /> : null}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{item.label}</p>
                      <p className="text-sm text-[#d8c6e8]">{item.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <button type="submit" className="neon-button mt-6 inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold">
              <Save size={16} />
              Save Reminder Settings
            </button>
          </div>
        </aside>
      </form>

      <div className="neon-glass neon-border overflow-hidden rounded-lg">
        <div className="border-b border-white/10 px-5 py-4">
          <h3 className="text-lg font-semibold text-white">Reminder Schedule Rules</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-[#d8c6e8]">
              <tr>
                <th className="px-4 py-3">Rule Name</th>
                <th className="px-4 py-3">Target Invoices</th>
                <th className="px-4 py-3">Overdue Interval</th>
                <th className="px-4 py-3">Next Run</th>
                <th className="px-4 py-3">Delivery Channel</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr><td colSpan="7" className="px-4 py-10 text-center text-[#d8c6e8]">Loading reminder rules...</td></tr>
              ) : settings.length === 0 ? (
                <tr><td colSpan="7" className="px-4 py-12 text-center text-[#d8c6e8]">No reminder rules configured yet.</td></tr>
              ) : settings.map((setting) => (
                <tr key={setting.id} className="text-[#f7efff]">
                  <td className="px-4 py-4 font-medium">{setting.ruleName}</td>
                  <td className="px-4 py-4 text-[#d8c6e8]">Unpaid overdue invoices</td>
                  <td className="px-4 py-4">{setting.firstReminderDays}, {setting.secondReminderDays}, {setting.finalReminderDays || "-"} days</td>
                  <td className="px-4 py-4">{setting.frequency} at {setting.reminderTime}</td>
                  <td className="px-4 py-4">{setting.deliveryChannel}</td>
                  <td className="px-4 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusPill(setting.enabled)}`}>{setting.enabled ? "Active" : "Disabled"}</span></td>
                  <td className="px-4 py-4">
                    <div className="flex gap-1">
                      <button type="button" onClick={() => handleEdit(setting)} className="rounded-lg p-2 text-[#d8c6e8] hover:bg-white/10 hover:text-white" title="Edit rule"><Pencil size={16} /></button>
                      <button type="button" onClick={() => handleStatus(setting)} className="rounded-lg p-2 text-[#d8c6e8] hover:bg-white/10 hover:text-white" title="Enable or disable rule">{setting.enabled ? <XCircle size={16} /> : <CheckCircle2 size={16} />}</button>
                      <button type="button" onClick={() => handleDelete(setting)} className="rounded-lg p-2 text-rose-200 hover:bg-rose-400/10" title="Delete rule"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="neon-glass neon-border overflow-hidden rounded-lg">
        <div className="border-b border-white/10 px-5 py-4">
          <h3 className="text-lg font-semibold text-white">Reminder Logs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-[#d8c6e8]">
              <tr>
                <th className="px-4 py-3">Invoice Number</th>
                <th className="px-4 py-3">Client Email</th>
                <th className="px-4 py-3">Reminder Type</th>
                <th className="px-4 py-3">Delivery Channel</th>
                <th className="px-4 py-3">Delivery Status</th>
                <th className="px-4 py-3">Sent At</th>
                <th className="px-4 py-3">Error Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {logs.length === 0 ? (
                <tr><td colSpan="7" className="px-4 py-12 text-center text-[#d8c6e8]">No reminder delivery logs yet.</td></tr>
              ) : logs.map((log) => (
                <tr key={log.id} className="text-[#f7efff]">
                  <td className="px-4 py-4">{log.invoiceNumber}</td>
                  <td className="px-4 py-4 text-[#d8c6e8]">{log.clientEmail}</td>
                  <td className="px-4 py-4">{log.reminderType}</td>
                  <td className="px-4 py-4">{log.deliveryChannel}</td>
                  <td className="px-4 py-4">{log.deliveryStatus}</td>
                  <td className="px-4 py-4">{formatDate(log.sentAt)}</td>
                  <td className="px-4 py-4 text-rose-100">{log.errorMessage || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
