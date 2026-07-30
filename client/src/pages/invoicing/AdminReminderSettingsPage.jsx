/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - ADMIN
 * PURPOSE: Implements the Admin Reminder Settings Page screen and its page-level interactions.
 * LAYER: Frontend page - renders a complete screen and coordinates its user interactions.
 * FIND RELATED CODE: Trace its imports for UI components and frontend services used by this screen.
 */
import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  Eye,
  Loader2,
  Mail,
  Save,
  Send,
  ShieldCheck,
  XCircle
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  createReminderSetting,
  fetchReminderSettings,
  sendTestReminder,
  updateReminderSetting
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
  ruleName: "Invoice reminder policy",
  enabled: true,
  frequency: "Weekdays",
  reminderTime: "09:00",
  timezone: "Asia/Singapore",
  deliveryChannel: "Email",
  whatsappEnabled: false,
  firstReminderDays: 1,
  secondReminderDays: 16,
  finalReminderDays: 31,
  templateName: "Overdue Invoice Reminder",
  emailSubject: "Reminder: Invoice {{invoice_number}} is overdue",
  emailBody:
    "Dear {{client_name}},\n\nThis is a reminder that invoice {{invoice_number}} for {{amount_due}} was due on {{due_date}} and is now {{overdue_days}} days overdue.\n\nPlease make payment here: {{payment_link}}\n\nRegards,\n{{company_name}}",
  testEmail: ""
};

function renderPreview(text, form) {
  return String(text || "")
    .replaceAll("{{client_name}}", "Acme Supplies")
    .replaceAll("{{invoice_number}}", "INV-2026-001")
    .replaceAll("{{amount_due}}", "SGD 1,280.00")
    .replaceAll("{{due_date}}", "15 May 2026")
    .replaceAll("{{overdue_days}}", String(form.firstReminderDays || 1))
    .replaceAll("{{company_name}}", "Vaniday")
    .replaceAll("{{payment_link}}", "https://pay.example.com/INV-2026-001");
}

function SummaryCard({ label, value, icon: Icon, tone = "coral" }) {
  const tones = {
    coral: "bg-[#fff3ee] text-[#E8573D]",
    green: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700"
  };

  return (
    <div className="rounded-2xl border border-[#f0d2ca] bg-white/90 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon size={19} />
        </span>
        <div>
          <p className="text-2xl font-bold text-[#251E1F]">{Number(value || 0)}</p>
          <p className="text-xs font-semibold text-[#7b6660]">{label}</p>
        </div>
      </div>
    </div>
  );
}

function ReminderStage({ number, title, field, value, onChange, minimum }) {
  return (
    <div className="relative flex gap-4 pb-6 last:pb-0">
      <div className="flex flex-col items-center">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F38978] text-sm font-bold text-white">
          {number}
        </span>
        {number < 3 ? <span className="mt-2 h-full w-0.5 bg-[#f0d2ca]" /> : null}
      </div>
      <div className="min-w-0 flex-1 rounded-xl border border-[#f0d2ca] bg-[#fff9f7] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold text-[#251E1F]">{title}</p>
            <p className="mt-1 text-xs text-[#7b6660]">Send after the invoice becomes overdue.</p>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="number"
              min={minimum}
              value={value}
              onChange={(event) => onChange(field, event.target.value)}
              className="h-10 w-24 rounded-lg border border-[#ead3cc] bg-white px-3 text-center text-sm font-bold outline-none focus:border-[#F38978]"
            />
            <span className="whitespace-nowrap text-sm font-semibold text-[#6f4f47]">days overdue</span>
          </label>
        </div>
      </div>
    </div>
  );
}

export default function AdminReminderSettingsPage() {
  const emailBodyRef = useRef(null);
  const [form, setForm] = useState(defaultForm);
  const [summary, setSummary] = useState({
    remindersSentToday: 0,
    failedDeliveries: 0,
    missingCustomerEmails: 0
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState([]);
  const [showPreview, setShowPreview] = useState(true);

  async function loadReminderData() {
    setLoading(true);
    try {
      const data = await fetchReminderSettings();
      setSummary(data.summary || {});
      if (data.settings?.[0]) {
        setForm((current) => ({
          ...defaultForm,
          ...data.settings[0],
          enabled: true,
          whatsappEnabled: false,
          testEmail: current.testEmail
        }));
      }
    } catch (error) {
      setErrors([error.message]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReminderData();
  }, []);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors([]);
    setMessage("");
  }

  function insertEmailPlaceholder(placeholder) {
    const textarea = emailBodyRef.current;
    if (!textarea) {
      setField("emailBody", `${form.emailBody} ${placeholder}`);
      return;
    }

    const currentValue = textarea.value;
    const selectionStart = textarea.selectionStart ?? currentValue.length;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;
    const nextValue = `${currentValue.slice(0, selectionStart)}${placeholder}${currentValue.slice(selectionEnd)}`;
    const nextCaretPosition = selectionStart + placeholder.length;

    setField("emailBody", nextValue);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCaretPosition, nextCaretPosition);
    });
  }

  function validateForm(requireTestEmail = false) {
    const nextErrors = [];
    const first = Number(form.firstReminderDays);
    const second = Number(form.secondReminderDays);
    const final = Number(form.finalReminderDays);

    if (!Number.isInteger(first) || first < 1) {
      nextErrors.push("First reminder must be at least 1 day overdue.");
    }
    if (!Number.isInteger(second) || second <= first) {
      nextErrors.push("Second reminder must be after the first reminder.");
    }
    if (!Number.isInteger(final) || final <= second) {
      nextErrors.push("Final reminder must be after the second reminder.");
    }
    if (!form.emailSubject.trim()) nextErrors.push("Email subject is required.");
    if (!form.emailBody.trim()) nextErrors.push("Email message is required.");
    ["{{client_name}}", "{{invoice_number}}", "{{amount_due}}", "{{due_date}}"].forEach((placeholder) => {
      if (!form.emailBody.includes(placeholder)) {
        nextErrors.push(`Email message is missing ${placeholder}.`);
      }
    });
    if (requireTestEmail && !form.testEmail.trim()) {
      nextErrors.push("Test recipient email is required.");
    }

    return nextErrors;
  }

  function policyPayload() {
    const payload = {
      ...form,
      enabled: true,
      frequency: form.frequency || "Weekdays",
      reminderTime: form.reminderTime || "09:00",
      timezone: "Asia/Singapore",
      deliveryChannel: "Email",
      whatsappEnabled: false,
      firstReminderDays: Number(form.firstReminderDays),
      secondReminderDays: Number(form.secondReminderDays),
      finalReminderDays: Number(form.finalReminderDays)
    };
    delete payload.testEmail;
    return payload;
  }

  async function savePolicy() {
    const nextErrors = validateForm();
    setErrors(nextErrors);
    setMessage("");
    if (nextErrors.length) return;

    setSaving(true);
    try {
      const payload = policyPayload();
      if (form.id) await updateReminderSetting(form.id, payload);
      else await createReminderSetting(payload);
      await loadReminderData();
      setMessage("Automatic reminder policy saved. Finance manual reminders and the scheduler now use this policy.");
    } catch (error) {
      setErrors([error.message]);
    } finally {
      setSaving(false);
    }
  }

  async function handleTestEmail() {
    const nextErrors = validateForm(true);
    setErrors(nextErrors);
    setMessage("");
    if (nextErrors.length) return;

    setTesting(true);
    try {
      await sendTestReminder({
        to: form.testEmail.trim(),
        setting: policyPayload()
      });
      setMessage(`Test reminder email sent to ${form.testEmail.trim()}.`);
    } catch (error) {
      setErrors([error.message]);
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="app-panel flex min-h-[420px] items-center justify-center gap-2 rounded-xl text-sm font-semibold text-[#7b6660]">
        <Loader2 className="animate-spin" size={18} />
        Loading reminder policy...
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F38978]">
            Reminder Settings
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#251E1F]">
            Automatic Customer Reminder Policy
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-[#7b6660]">
            Admin controls when overdue reminders are sent and what the customer receives.
            Finance continues handling customer follow-up, completion and dismissal.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
          <CheckCircle2 size={16} /> Automatic protection enabled
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Reminders Sent Today"
          value={summary.remindersSentToday}
          icon={Send}
          tone="green"
        />
        <SummaryCard
          label="Failed Deliveries"
          value={summary.failedDeliveries}
          icon={XCircle}
          tone="rose"
        />
        <SummaryCard
          label="Customers Missing Email"
          value={summary.missingCustomerEmails}
          icon={Mail}
          tone="amber"
        />
      </div>

      {errors.length ? (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {errors.map((error) => <p key={error}>{error}</p>)}
        </div>
      ) : null}
      {message ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={17} /> {message}
        </div>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-2xl border border-[#f0d2ca] bg-white/90 p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3 border-b border-[#f0d2ca] pb-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F38978]/15 text-[#F38978]">
              <CalendarClock size={20} />
            </span>
            <div>
              <h2 className="font-bold text-[#251E1F]">Reminder Timeline</h2>
              <p className="mt-1 text-sm text-[#7b6660]">
                Set the three follow-up stages after an invoice becomes overdue.
              </p>
            </div>
          </div>

          <ReminderStage
            number={1}
            title="First Reminder"
            field="firstReminderDays"
            value={form.firstReminderDays}
            onChange={setField}
            minimum={1}
          />
          <ReminderStage
            number={2}
            title="Second Reminder"
            field="secondReminderDays"
            value={form.secondReminderDays}
            onChange={setField}
            minimum={2}
          />
          <ReminderStage
            number={3}
            title="Final Reminder"
            field="finalReminderDays"
            value={form.finalReminderDays}
            onChange={setField}
            minimum={3}
          />
        </div>

        <div className="rounded-2xl border border-[#f0d2ca] bg-white/90 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <ShieldCheck size={20} />
            </span>
            <div>
              <h2 className="font-bold text-[#251E1F]">Automatic Safeguards</h2>
              <p className="mt-1 text-sm text-[#7b6660]">Always enforced by the system.</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {[
              "Outstanding invoices only",
              "Stop reminders after payment",
              "Exclude Cancelled, Void and Refunded invoices",
              "Prevent duplicate reminders",
              "Skip customers without an email address",
              "Record failed deliveries for Admin review"
            ].map((item) => (
              <p key={item} className="flex items-start gap-2 text-sm text-[#514440]">
                <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={15} />
                {item}
              </p>
            ))}
          </div>
          <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900">
            Scheduler timing is handled automatically in Asia/Singapore. WhatsApp remains
            under Integrations and delivery history remains under monitoring.
          </div>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-2xl border border-[#f0d2ca] bg-white/90 p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-col gap-3 border-b border-[#f0d2ca] pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F38978]/15 text-[#F38978]">
                <Mail size={20} />
              </span>
              <div>
                <h2 className="font-bold text-[#251E1F]">Reminder Email</h2>
                <p className="mt-1 text-sm text-[#7b6660]">
                  Used by automatic delivery and Finance manual reminders.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowPreview((current) => !current)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-xs font-bold text-[#514440]"
            >
              <Eye size={15} /> {showPreview ? "Hide Preview" : "Show Preview"}
            </button>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-bold text-[#514440]">Email subject</span>
              <input
                value={form.emailSubject}
                onChange={(event) => setField("emailSubject", event.target.value)}
                className="mt-2 h-11 w-full rounded-lg border border-[#f0d2ca] bg-white px-3 text-sm outline-none focus:border-[#F38978]"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-[#514440]">Email message</span>
              <textarea
                ref={emailBodyRef}
                rows={10}
                value={form.emailBody}
                onChange={(event) => setField("emailBody", event.target.value)}
                className="mt-2 w-full resize-y rounded-lg border border-[#f0d2ca] bg-white px-3 py-3 text-sm outline-none focus:border-[#F38978]"
              />
            </label>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#7b6660]">
                Available placeholders
              </p>
              <div className="flex flex-wrap gap-2">
                {placeholders.map((placeholder) => (
                  <button
                    key={placeholder}
                    type="button"
                    onClick={() => insertEmailPlaceholder(placeholder)}
                    className="rounded-full border border-[#f0d2ca] bg-[#fff8f5] px-3 py-1 text-xs font-bold text-[#7b6660] hover:border-[#F38978]"
                  >
                    {placeholder}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {showPreview ? (
            <div className="rounded-2xl border border-[#f0d2ca] bg-white/90 p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Eye size={18} className="text-[#F38978]" />
                <h2 className="font-bold text-[#251E1F]">Customer Preview</h2>
              </div>
              <div className="mt-4 rounded-xl border border-[#f0d2ca] bg-[#fff9f7] p-4">
                <p className="text-sm font-bold text-[#251E1F]">
                  {renderPreview(form.emailSubject, form)}
                </p>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap font-sans text-sm leading-6 text-[#514440]">
                  {renderPreview(form.emailBody, form)}
                </pre>
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-[#f0d2ca] bg-white/90 p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Send size={18} className="text-[#F38978]" />
              <h2 className="font-bold text-[#251E1F]">Send Test Reminder</h2>
            </div>
            <p className="mt-1 text-sm text-[#7b6660]">
              Check the message before saving it for customer delivery.
            </p>
            <input
              type="email"
              value={form.testEmail}
              onChange={(event) => setField("testEmail", event.target.value)}
              placeholder="admin@example.com"
              className="mt-4 h-11 w-full rounded-lg border border-[#f0d2ca] bg-white px-3 text-sm outline-none focus:border-[#F38978]"
            />
            <button
              type="button"
              onClick={handleTestEmail}
              disabled={testing}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#F38978]/30 bg-[#F38978]/15 px-4 py-2.5 text-sm font-bold text-[#251E1F] disabled:opacity-50"
            >
              {testing ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
              {testing ? "Sending..." : "Send Test Email"}
            </button>
          </div>
        </div>
      </div>

      <div className="sticky bottom-4 flex flex-col gap-3 rounded-2xl border border-[#f0d2ca] bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 text-sm text-[#6f4f47]">
          <BellRing size={18} className="mt-0.5 shrink-0 text-[#F38978]" />
          <p>
            Saving updates the automatic scheduler and the Email template used by Finance
            when sending a manual reminder.
          </p>
        </div>
        <button
          type="button"
          onClick={savePolicy}
          disabled={saving}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#251E1F] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#4b3834] disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          {saving ? "Saving..." : "Save Reminder Policy"}
        </button>
      </div>
    </section>
  );
}
