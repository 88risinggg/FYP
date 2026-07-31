/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - ADMIN
 * PURPOSE: Implements the Admin Receipt Settings Page screen and its page-level interactions.
 * LAYER: Frontend page - renders a complete screen and coordinates its user interactions.
 * FIND RELATED CODE: Trace its imports for UI components and frontend services used by this screen.
 */
import { Loader2, Mail, RotateCcw, Save, Send, TextCursorInput } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  getReceiptSettings,
  sendReceiptSettingsTestEmail,
  updateReceiptSettings
} from "../../services/adminInvoiceSettingsService.js";

const defaultTemplate = {
  subject: "Payment received for invoice {{invoice_number}}",
  body: "Dear {{customer_name}},\n\nWe have received your payment of {{amount_paid}} for invoice {{invoice_number}} on {{payment_date}}.\n\nThank you for your payment.\n\n{{company_name}}"
};

const placeholders = [
  { label: "Customer Name", token: "{{customer_name}}" },
  { label: "Invoice Number", token: "{{invoice_number}}" },
  { label: "Amount Paid", token: "{{amount_paid}}" },
  { label: "Payment Date", token: "{{payment_date}}" },
  { label: "Payment Method", token: "{{payment_method}}" },
  { label: "Company Name", token: "{{company_name}}" },
  { label: "Receipt Number", token: "{{receipt_number}}" },
  { label: "Online Invoice", token: "{{online_invoice_url}}" }
];

const previewValues = {
  customer_name: "Sample Customer",
  invoice_number: "INV-2026-0001",
  amount_paid: "SGD 109.00",
  payment_date: "31 Jul 2026",
  payment_method: "Online payment",
  company_name: "PayNivo",
  receipt_number: "RCPT-2026-0001",
  online_invoice_url: "https://example.com/invoice/view/INV-2026-0001"
};

function renderTemplate(template) {
  return String(template || "").replace(/\{\{([a-z_]+)\}\}/g, (match, key) => (
    Object.prototype.hasOwnProperty.call(previewValues, key) ? previewValues[key] : match
  ));
}

function templatesMatch(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function SettingsCard({ title, icon: Icon, children }) {
  return (
    <section className="rounded-xl border border-[#f0d2ca] bg-white/95 p-5 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F38978]/12 text-[#F38978] ring-1 ring-[#F38978]/20">
          <Icon size={20} />
        </div>
        <h3 className="text-base font-bold text-[#251E1F]">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children, note, error }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-[#251E1F]">{label}</span>
      <div className="mt-1">{children}</div>
      {error ? <span className="mt-1 block text-xs font-semibold leading-5 text-rose-600">{error}</span> : null}
      {note ? <span className="mt-1 block text-xs leading-5 text-[#7b6660]">{note}</span> : null}
    </label>
  );
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

export default function AdminReceiptSettingsPage({ activeView = "settings" }) {
  const subjectRef = useRef(null);
  const bodyRef = useRef(null);
  const [template, setTemplate] = useState(defaultTemplate);
  const [savedTemplate, setSavedTemplate] = useState(defaultTemplate);
  const [target, setTarget] = useState("body");
  const [recipient, setRecipient] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [recipientError, setRecipientError] = useState("");

  const dirty = !templatesMatch(template, savedTemplate);
  const previewSubject = useMemo(() => renderTemplate(template.subject), [template.subject]);
  const previewBody = useMemo(() => renderTemplate(template.body), [template.body]);

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      setError("");
      try {
        const data = await getReceiptSettings();
        const nextTemplate = { ...defaultTemplate, ...(data.receiptTemplate || {}) };
        setTemplate(nextTemplate);
        setSavedTemplate(nextTemplate);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  function updateField(field, value) {
    setTemplate((current) => ({ ...current, [field]: value }));
  }

  function insertPlaceholder(token) {
    const field = target === "subject" ? "subject" : "body";
    const ref = field === "subject" ? subjectRef.current : bodyRef.current;
    const value = template[field] || "";
    const start = ref?.selectionStart ?? value.length;
    const end = ref?.selectionEnd ?? value.length;
    const nextValue = `${value.slice(0, start)}${token}${value.slice(end)}`;
    updateField(field, nextValue);
    window.requestAnimationFrame(() => {
      ref?.focus();
      const caret = start + token.length;
      ref?.setSelectionRange(caret, caret);
    });
  }

  async function saveTemplate() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const data = await updateReceiptSettings({ receiptTemplate: template });
      const nextTemplate = { ...defaultTemplate, ...(data.receiptTemplate || template) };
      setTemplate(nextTemplate);
      setSavedTemplate(nextTemplate);
      setMessage(data.message || "Receipt settings saved.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    if (!recipient.trim()) {
      setRecipientError("Enter a recipient email address before sending a test receipt.");
      setError("Enter a recipient email address before sending a test receipt.");
      return;
    }
    if (!validEmail(recipient)) {
      setRecipientError("Enter a valid email address, for example finance@example.com.");
      setError("Enter a valid email address, for example finance@example.com.");
      return;
    }
    setTesting(true);
    setMessage("");
    setError("");
    setRecipientError("");
    try {
      const data = await sendReceiptSettingsTestEmail({ recipient, receiptTemplate: template });
      setMessage(data.message || "Test receipt sent.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setTesting(false);
    }
  }

  function resetChanges() {
    setTemplate(savedTemplate);
    setMessage("Unsaved changes have been reset.");
    setError("");
  }

  function handleRecipientChange(value) {
    setRecipient(value);
    if (!value.trim()) {
      setRecipientError("");
    } else if (!validEmail(value)) {
      setRecipientError("Enter a valid email address, for example finance@example.com.");
    } else {
      setRecipientError("");
    }
  }

  if (loading) {
    return (
      <section className="-m-4 min-h-[calc(100vh-5rem)] bg-[#fff6f2] p-6 text-[#251E1F] sm:-m-6">
        <div className="rounded-xl border border-[#f0d2ca] bg-white/95 p-8 text-center text-sm font-semibold text-[#7b6660]">
          Loading receipt settings...
        </div>
      </section>
    );
  }

  return (
    <section
      className="-m-4 min-h-[calc(100vh-5rem)] p-4 text-[#251E1F] sm:-m-6 sm:p-6"
      style={{ backgroundImage: "linear-gradient(90deg, #FDD9CD 0%, #fff8f5 15%, #fffaf8 58%, #FDD9CD 100%)" }}
    >
      <div className="mx-auto max-w-[1200px] space-y-5">
        <header>
          <h2 className="text-2xl font-bold tracking-tight text-[#251E1F]">
            {activeView === "preview" ? "Receipt Preview" : "Receipt Settings"}
          </h2>
          <p className="mt-2 text-sm font-medium text-[#6f5b55]">
            {activeView === "preview"
              ? "Preview the saved payment receipt template with sample payment information."
              : "Configure the payment receipt message sent after an invoice payment is received."}
          </p>
        </header>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
        {message ? <div className="rounded-xl border border-[#F38978]/30 bg-white px-4 py-3 text-sm font-semibold text-[#b64d3b]">{message}</div> : null}

        {activeView === "settings" ? (
        <SettingsCard title="Receipt Template Editor" icon={TextCursorInput}>
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Receipt Email Subject">
              <input
                ref={subjectRef}
                type="text"
                value={template.subject}
                onFocus={() => setTarget("subject")}
                onChange={(event) => updateField("subject", event.target.value)}
                className="h-11 w-full rounded-lg border border-[#ead3cc] bg-white px-3 text-sm font-semibold text-[#251E1F] outline-none focus:border-[#F38978] focus:ring-2 focus:ring-[#F38978]/20"
              />
            </Field>
            <Field label="Test Recipient" error={recipientError}>
              <input
                type="email"
                value={recipient}
                onChange={(event) => handleRecipientChange(event.target.value)}
                placeholder="recipient@example.com"
                className={`h-11 w-full rounded-lg border bg-white px-3 text-sm font-semibold text-[#251E1F] outline-none focus:ring-2 ${
                  recipientError ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100" : "border-[#ead3cc] focus:border-[#F38978] focus:ring-[#F38978]/20"
                }`}
              />
            </Field>
            <div className="lg:col-span-2 rounded-xl border border-[#ead3cc] bg-[#fff8f5] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-[#251E1F]">Insert Placeholder</p>
                  <p className="mt-1 text-xs text-[#806b64]">Choose where to insert, then click a field below.</p>
                </div>
                <div className="inline-flex w-fit rounded-lg border border-[#ead3cc] bg-white p-1">
                  {[
                    { label: "Subject", field: "subject" },
                    { label: "Message body", field: "body" }
                  ].map((item) => (
                    <button
                      key={item.field}
                      type="button"
                      onClick={() => setTarget(item.field)}
                      className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                        target === item.field ? "bg-[#F38978] text-white" : "text-[#6f5b55] hover:bg-[#fff1ec]"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {placeholders.map((placeholder) => (
                  <button
                    key={placeholder.token}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => insertPlaceholder(placeholder.token)}
                    className="rounded-full border border-[#efb8aa] bg-white px-3 py-1.5 text-xs font-bold text-[#b44f3e] transition hover:border-[#F38978] hover:bg-[#fff1ec] focus:outline-none focus:ring-2 focus:ring-[#F38978]/30"
                  >
                    + {placeholder.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="lg:col-span-2">
              <Field label="Receipt Message Body" note="Email and WhatsApp receipt messages use the same saved body template.">
                <textarea
                  ref={bodyRef}
                  rows={8}
                  value={template.body}
                  onFocus={() => setTarget("body")}
                  onChange={(event) => updateField("body", event.target.value)}
                  className="w-full rounded-lg border border-[#ead3cc] bg-white px-3 py-2.5 text-sm font-semibold text-[#251E1F] outline-none focus:border-[#F38978] focus:ring-2 focus:ring-[#F38978]/20"
                />
              </Field>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
            {dirty ? (
              <button type="button" onClick={resetChanges} disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#ead3cc] bg-white px-4 text-sm font-bold text-[#6f4f47] transition hover:border-[#F38978] hover:text-[#F38978]">
                <RotateCcw size={16} />
                Reset Changes
              </button>
            ) : null}
            <button type="button" onClick={sendTest} disabled={testing} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#F38978] bg-white px-4 text-sm font-bold text-[#F38978] disabled:opacity-50">
              {testing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Test Receipt
            </button>
            <button type="button" onClick={saveTemplate} disabled={saving || !dirty} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#F38978] px-4 text-sm font-bold text-white shadow-[0_12px_25px_rgba(243,137,120,0.35)] disabled:opacity-60">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Settings
            </button>
          </div>
        </SettingsCard>
        ) : null}

        {activeView === "preview" ? (
        <SettingsCard title="Receipt Preview" icon={Mail}>
          <div className="overflow-hidden rounded-xl border border-[#ead3cc] bg-white">
            <div className="border-b border-[#ead3cc] bg-[#fff8f5] px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[#7b6660]">Subject</p>
              <p className="mt-1 text-sm font-bold text-[#251E1F]">{previewSubject || "Subject template is empty"}</p>
            </div>
            <div className="px-5 py-6">
              <p className="whitespace-pre-wrap text-sm leading-7 text-[#514440]">
                {previewBody || "Receipt message body is empty"}
              </p>
            </div>
          </div>
        </SettingsCard>
        ) : null}
      </div>
    </section>
  );
}
