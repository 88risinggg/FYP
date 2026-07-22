import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileSpreadsheet,
  FileText,
  Hash,
  Info,
  ListChecks,
  Loader2,
  Mail,
  Landmark,
  RotateCcw,
  Save,
  Send,
  Settings2,
  XCircle
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import {
  getInvoiceSettings,
  sendInvoiceSettingsTestEmail,
  updateInvoiceSettings
} from "../../services/adminInvoiceSettingsService.js";

const tabs = [
  { label: "General", slug: "general" },
  { label: "Numbering", slug: "numbering" },
  { label: "Email", slug: "email" },
  { label: "Payments", slug: "payments" }
];

const emptyOptions = {
  currencies: [],
  languages: [],
  taxes: [],
  priceDisplayOptions: [],
  paymentTerms: [],
  lateFeeTypes: [],
  pdfPaperSizes: [],
  excelFormats: [],
  separatorStyles: [],
  invoiceFormats: []
};

const defaultForm = {
  invoicePrefix: "",
  invoiceYear: "",
  separatorStyle: "",
  invoiceFormat: "",
  nextInvoiceNumber: 1,
  companyName: "",
  companyRegistrationNumber: "",
  companyAddress: "",
  registeredOfficeAddress: "",
  financeEmail: "",
  supportEmail: "",
  bankAccountHolderName: "",
  bankName: "",
  bankAccountNumber: "",
  bicSwift: "",
  paynowIdentifier: "",
  paymentReferenceInstruction: "",
  payoutStatement: "",
  computerGeneratedStatement: "",
  senderName: "",
  replyToEmail: "",
  emailSubjectTemplate: "",
  emailBodyTemplate: "",
  attachPdfInvoice: true,
  general: {
    defaultCurrency: "",
    defaultLanguage: "",
    defaultTax: "",
    priceDisplay: "",
    paymentTerms: "",
    lateFeeValue: "",
    lateFeeType: "percent",
    onlineViewLinkEnabled: false,
    whatsappNotificationsEnabled: false
  },
  export: {
    pdfExportEnabled: false,
    excelExportEnabled: false,
    pdfPaperSize: "",
    excelFormat: ""
  },
  branding: {
    companyLogoUrl: "",
    brandColor: "#F38978",
    showCompanyDetailsOnInvoice: true
  },
  sequenceRules: {
    yearlyReset: true,
    allowManualOverride: false,
    lockNumberingAfterSent: true,
    preventDuplicateNumbers: true
  }
};

const generalSelectFields = [
  { label: "Default Currency", section: "general", field: "defaultCurrency", optionsKey: "currencies" },
  { label: "Default Language", section: "general", field: "defaultLanguage", optionsKey: "languages" },
  { label: "Default Tax", section: "general", field: "defaultTax", optionsKey: "taxes" },
  { label: "Price Display", section: "general", field: "priceDisplay", optionsKey: "priceDisplayOptions" },
  { label: "Payment Terms", section: "general", field: "paymentTerms", optionsKey: "paymentTerms" }
];

const generalToggles = [
  {
    label: "Online View Link",
    note: "Include secure online invoice view link in emails",
    section: "general",
    field: "onlineViewLinkEnabled"
  },
  {
    label: "Enable WhatsApp Notifications",
    note: "Send invoice and reminder notifications via WhatsApp",
    section: "general",
    field: "whatsappNotificationsEnabled"
  }
];

const exportToggles = [
  {
    label: "PDF Export",
    note: "Allow invoices to be exported as PDF",
    section: "export",
    field: "pdfExportEnabled"
  },
  {
    label: "Excel Export",
    note: "Allow invoices to be exported as Excel",
    section: "export",
    field: "excelExportEnabled"
  }
];

const exportSelectFields = [
  { label: "PDF Paper Size", section: "export", field: "pdfPaperSize", optionsKey: "pdfPaperSizes" },
  { label: "Excel Format", section: "export", field: "excelFormat", optionsKey: "excelFormats" }
];

const sequenceRuleFields = [
  {
    label: "Yearly Reset",
    note: "Restart the invoice sequence when the saved invoice year changes.",
    field: "yearlyReset"
  },
  {
    label: "Allow Manual Override",
    note: "Permit approved admins to adjust generated numbers before sending.",
    field: "allowManualOverride"
  },
  {
    label: "Lock Numbering After Sent",
    note: "Prevent number edits once an invoice has been sent.",
    field: "lockNumberingAfterSent"
  },
  {
    label: "Prevent Duplicate Numbers",
    note: "Block saving when another invoice already has the same number.",
    field: "preventDuplicateNumbers"
  }
];

const buttonClasses = {
  primary:
    "flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#F38978] px-4 py-3 text-sm font-bold text-white shadow-[0_12px_25px_rgba(243,137,120,0.35)] transition hover:bg-[#e87562] disabled:cursor-not-allowed disabled:opacity-70",
  secondary:
    "mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#ead3cc] bg-white px-4 py-2 text-sm font-bold text-[#251E1F] transition hover:border-[#F38978] hover:text-[#F38978] disabled:cursor-not-allowed disabled:opacity-70"
};

const bannerClasses = {
  error: "rounded-xl border border-[#F38978]/35 bg-white px-4 py-3 text-sm font-semibold text-[#b64d3b]",
  success: "rounded-xl border border-[#F38978]/30 bg-white px-4 py-3 text-sm font-semibold text-[#b64d3b]"
};

function cloneSettings(settings) {
  return JSON.parse(JSON.stringify(settings || defaultForm));
}

function normalizeSettings(settings) {
  return {
    ...defaultForm,
    ...(settings || {}),
    general: { ...defaultForm.general, ...(settings?.general || {}) },
    export: { ...defaultForm.export, ...(settings?.export || {}) },
    branding: { ...defaultForm.branding, ...(settings?.branding || {}) },
    sequenceRules: { ...defaultForm.sequenceRules, ...(settings?.sequenceRules || {}) }
  };
}

function padInvoiceNumber(value) {
  const parsed = Number(value);
  const safeValue = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
  return String(safeValue).padStart(4, "0");
}

function buildInvoiceNumber(settings, nextNumber = settings.nextInvoiceNumber) {
  const prefix = settings.invoicePrefix || "";
  const year = String(settings.invoiceYear || "");
  const format = settings.invoiceFormat || "";

  return format
    .replaceAll("{PREFIX}", prefix)
    .replaceAll("{YYYY}", year)
    .replaceAll("{YY}", year.slice(-2))
    .replaceAll("{NNNN}", padInvoiceNumber(nextNumber));
}

function separatorFromFormat(format) {
  if (format?.includes("/")) return "slash";
  if (format?.includes("-")) return "hyphen";
  return "none";
}

function formatForSeparator(currentFormat, separatorStyle) {
  if (separatorStyle === "none") return "{PREFIX}{YYYY}{NNNN}";

  const separator = separatorStyle === "slash" ? "/" : "-";
  const usesShortYear = currentFormat?.includes("{YY}") && !currentFormat?.includes("{YYYY}");
  const startsWithYear = separatorStyle === "hyphen" && currentFormat?.startsWith("{YYYY}");

  if (startsWithYear) return `{YYYY}${separator}{PREFIX}${separator}{NNNN}`;
  return `{PREFIX}${separator}${usesShortYear ? "{YY}" : "{YYYY}"}${separator}{NNNN}`;
}

function formatDateTime(value) {
  if (!value) return "Not saved yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not saved yet";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function titleFromKey(key) {
  return String(key)
    .replace(/([A-Z])/g, " $1")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function Field({ label, children, note }) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold text-[#251E1F]">{label}</span>
      <div className="mt-1">{children}</div>
      {note ? <span className="mt-1 block text-xs leading-5 text-[#7b6660]">{note}</span> : null}
    </label>
  );
}

function MessageBanner({ type, children }) {
  return <div className={bannerClasses[type]}>{children}</div>;
}

function SelectField({ value, onChange, options, placeholder = "Select option" }) {
  return (
    <span className="relative block">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full appearance-none rounded-lg border border-[#ead3cc] bg-white px-3 pr-10 text-sm font-semibold text-[#251E1F] outline-none transition focus:border-[#F38978] focus:ring-2 focus:ring-[#F38978]/20"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8d7b76]" />
    </span>
  );
}

function SettingsSelect({ config, options, value, onChange }) {
  return (
    <Field label={config.label}>
      <SelectField
        value={value}
        onChange={(nextValue) => onChange(config.section, config.field, nextValue)}
        options={options[config.optionsKey]}
      />
    </Field>
  );
}

function Toggle({ checked, onChange, label, note }) {
  return (
    <label className="flex min-h-[70px] items-center justify-between gap-4 rounded-lg border border-[#ead3cc] bg-[#fff8f5] px-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-bold text-[#251E1F]">{label}</span>
        {note ? <span className="mt-1 block text-xs leading-5 text-[#7b6660]">{note}</span> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-[#F38978]" : "bg-[#dcc8c1]"}`}>
        <span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition ${checked ? "translate-x-5" : ""}`} />
      </span>
    </label>
  );
}

function SettingsToggle({ config, checked, onChange }) {
  return (
    <Toggle
      label={config.label}
      note={config.note}
      checked={checked}
      onChange={(nextValue) => onChange(config.section, config.field, nextValue)}
    />
  );
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

function StatusIcon({ status }) {
  if (status === "completed") return <CheckCircle2 size={15} className="text-[#F38978]" />;
  if (status === "warning") return <AlertTriangle size={15} className="text-[#FFB65C]" />;
  return <XCircle size={15} className="text-[#F38978]" />;
}

function ConfigurationStatusPanel({ status }) {
  const categories = status?.categories || {};
  const percentage = Number(status?.completionPercentage || 0);
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <SettingsCard title="Configuration Status" icon={Settings2}>
      <div className="grid gap-5 sm:grid-cols-[160px_minmax(0,1fr)] xl:grid-cols-1 2xl:grid-cols-[160px_minmax(0,1fr)]">
        <div className="relative mx-auto h-36 w-36">
          <svg viewBox="0 0 108 108" className="h-full w-full">
            <circle cx="54" cy="54" r="42" fill="none" stroke="#f7e2db" strokeWidth="12" />
            <circle
              cx="54"
              cy="54"
              r="42"
              fill="none"
              stroke="#F38978"
              strokeLinecap="round"
              strokeWidth="12"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 54 54)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-bold text-[#251E1F]">{percentage}%</span>
            <span className="text-xs font-semibold text-[#7b6660]">Configured</span>
          </div>
        </div>
        <div className="space-y-2">
          {Object.entries(categories).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-[#251E1F]">{titleFromKey(key)}</span>
              <StatusIcon status={value} />
            </div>
          ))}
        </div>
      </div>
    </SettingsCard>
  );
}

function NumberingPreviewPanel({ form, previewNumbers }) {
  return (
    <SettingsCard title="Numbering Preview" icon={Hash}>
      <div className="space-y-3">
        {previewNumbers.map((invoiceNumber) => (
          <div
            key={invoiceNumber}
            className="rounded-lg border border-[#ead3cc] bg-[#fff8f5] px-3 py-2 text-sm font-bold text-[#251E1F]"
          >
            {invoiceNumber}
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-lg border border-[#ead3cc] bg-white px-3 py-3">
        <p className="text-xs font-bold text-[#7b6660]">Format</p>
        <p className="mt-1 break-all text-sm font-bold text-[#251E1F]">{form.invoiceFormat || "Not selected"}</p>
      </div>
    </SettingsCard>
  );
}

function RecentNumberingActivity({ activity }) {
  return (
    <SettingsCard title="Recent Numbering Activity" icon={Clock3}>
      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead className="border-b border-[#f0d2ca] text-xs font-bold uppercase text-[#7b6660]">
            <tr>
              <th className="px-3 py-3">Date &amp; Time</th>
              <th className="px-3 py-3">Action</th>
              <th className="px-3 py-3">Old Value</th>
              <th className="px-3 py-3">New Value</th>
              <th className="px-3 py-3">Changed By</th>
              <th className="px-3 py-3">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f5e2dc]">
            {activity.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-3 py-8 text-center text-sm font-semibold text-[#7b6660]">
                  No numbering activity yet.
                </td>
              </tr>
            ) : (
              activity.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="whitespace-nowrap px-3 py-3 font-semibold text-[#251E1F]">
                    {formatDateTime(item.createdAt)}
                  </td>
                  <td className="px-3 py-3 font-semibold text-[#251E1F]">{item.action}</td>
                  <td className="px-3 py-3 text-[#7b6660]">{item.oldValue}</td>
                  <td className="px-3 py-3 font-semibold text-[#251E1F]">{item.newValue}</td>
                  <td className="px-3 py-3 text-[#7b6660]">{item.changedBy}</td>
                  <td className="px-3 py-3 text-[#7b6660]">{item.notes || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </SettingsCard>
  );
}

function NumberingTab({
  form,
  options,
  configurationStatus,
  previewNumbers,
  activity,
  lastSavedAt,
  saving,
  onCancel,
  onRootFieldChange,
  onSeparatorChange,
  onFormatChange,
  onSequenceRuleChange
}) {
  const examplePreview = buildInvoiceNumber(form);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-5">
        <SettingsCard title="Numbering Format" icon={Hash}>
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Invoice Prefix">
              <input
                type="text"
                value={form.invoicePrefix}
                onChange={(event) => onRootFieldChange("invoicePrefix", event.target.value.toUpperCase())}
                className="h-11 w-full rounded-lg border border-[#ead3cc] bg-white px-3 text-sm font-semibold text-[#251E1F] outline-none transition focus:border-[#F38978] focus:ring-2 focus:ring-[#F38978]/20"
              />
            </Field>
            <Field label="Year">
              <input
                type="number"
                min="1900"
                max="9999"
                value={form.invoiceYear}
                onChange={(event) => onRootFieldChange("invoiceYear", event.target.value)}
                className="h-11 w-full rounded-lg border border-[#ead3cc] bg-white px-3 text-sm font-semibold text-[#251E1F] outline-none transition focus:border-[#F38978] focus:ring-2 focus:ring-[#F38978]/20"
              />
            </Field>
            <Field label="Separator Style">
              <SelectField
                value={form.separatorStyle}
                onChange={onSeparatorChange}
                options={options.separatorStyles}
              />
            </Field>
            <Field label="Invoice Format">
              <SelectField
                value={form.invoiceFormat}
                onChange={onFormatChange}
                options={options.invoiceFormats}
              />
            </Field>
            <Field label="Next Invoice Number" note="Usually read-only because the system calculates the next available number automatically.">
              <input
                type="number"
                min="1"
                readOnly={!form.sequenceRules.allowManualOverride}
                value={form.nextInvoiceNumber}
                onChange={(event) => onRootFieldChange("nextInvoiceNumber", event.target.value)}
                className={`h-11 w-full rounded-lg border border-[#ead3cc] px-3 text-sm font-semibold text-[#251E1F] outline-none transition focus:border-[#F38978] focus:ring-2 focus:ring-[#F38978]/20 ${
                  form.sequenceRules.allowManualOverride ? "bg-white" : "bg-[#fff8f5]"
                }`}
              />
            </Field>
            <Field label="Example Preview">
              <div className="flex h-11 items-center rounded-lg border border-[#ead3cc] bg-[#fff8f5] px-3 text-sm font-bold text-[#251E1F]">
                {examplePreview}
              </div>
            </Field>
          </div>
        </SettingsCard>

        <SettingsCard title="Sequence Rules" icon={ListChecks}>
          <div className="grid gap-4 lg:grid-cols-2">
            {sequenceRuleFields.map((rule) => (
              <Toggle
                key={rule.field}
                label={rule.label}
                note={rule.note}
                checked={form.sequenceRules[rule.field]}
                onChange={(value) => onSequenceRuleChange(rule.field, value)}
              />
            ))}
          </div>
        </SettingsCard>

        <RecentNumberingActivity activity={activity} />
      </div>

      <aside className="space-y-5">
        <ConfigurationStatusPanel status={configurationStatus} />
        <NumberingPreviewPanel form={form} previewNumbers={previewNumbers} />
        <div className="rounded-xl border border-[#f0d2ca] bg-white/95 p-4 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
          <p className="mb-3 text-xs font-bold text-[#7b6660]">Last saved</p>
          <p className="mb-4 text-sm font-bold text-[#251E1F]">{formatDateTime(lastSavedAt)}</p>
          <button type="submit" disabled={saving} className={buttonClasses.primary}>
            {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
            {saving ? "Saving..." : "Save & Publish Settings"}
          </button>
          <button type="button" onClick={onCancel} disabled={saving} className={buttonClasses.secondary}>
            <RotateCcw size={16} />
            Cancel
          </button>
        </div>
      </aside>
    </div>
  );
}

function TextSetting({ label, field, form, onChange, note, multiline = false, type = "text" }) {
  const className = "w-full rounded-lg border border-[#ead3cc] bg-white px-3 py-2.5 text-sm font-semibold text-[#251E1F] outline-none focus:border-[#F38978] focus:ring-2 focus:ring-[#F38978]/20";
  return (
    <Field label={label} note={note}>
      {multiline ? (
        <textarea rows={4} value={form[field] || ""} onChange={(event) => onChange(field, event.target.value)} className={className} />
      ) : (
        <input type={type} value={form[field] || ""} onChange={(event) => onChange(field, event.target.value)} className={className} />
      )}
    </Field>
  );
}

function TabSaveButton({ saving }) {
  return (
    <div className="flex justify-end">
      <button type="submit" disabled={saving} className="primary-button inline-flex items-center gap-2 px-5 py-3 text-sm font-bold disabled:opacity-60">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        {saving ? "Saving..." : "Save Settings"}
      </button>
    </div>
  );
}

function PaymentSettingsTab({ form, onChange, saving }) {
  return (
    <div className="space-y-5">
      <SettingsCard title="Bank Transfer & PayNow" icon={Landmark}>
        <div className="grid gap-4 lg:grid-cols-2">
          <TextSetting label="Bank Account Holder" field="bankAccountHolderName" form={form} onChange={onChange} />
          <TextSetting label="Bank Name" field="bankName" form={form} onChange={onChange} />
          <TextSetting label="Bank Account Number" field="bankAccountNumber" form={form} onChange={onChange} />
          <TextSetting label="BIC / SWIFT" field="bicSwift" form={form} onChange={onChange} />
          <TextSetting label="PayNow Identifier" field="paynowIdentifier" form={form} onChange={onChange} />
          <TextSetting label="Payment Reference Instruction" field="paymentReferenceInstruction" form={form} onChange={onChange} multiline />
          <TextSetting label="Payout Statement" field="payoutStatement" form={form} onChange={onChange} multiline />
          <TextSetting label="Computer-generated Statement" field="computerGeneratedStatement" form={form} onChange={onChange} multiline />
        </div>
      </SettingsCard>
      <TabSaveButton saving={saving} />
    </div>
  );
}

function EmailSettingsTab({ form, onChange, saving }) {
  const [recipient, setRecipient] = useState(form.replyToEmail || form.financeEmail || "");
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState("");

  async function sendTest() {
    setTesting(true);
    setTestMessage("");
    try {
      const response = await sendInvoiceSettingsTestEmail(recipient);
      setTestMessage(response.message || "Test email sent.");
    } catch (error) {
      setTestMessage(error.message);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-5">
      <SettingsCard title="Invoice Email" icon={Mail}>
        <div className="grid gap-4 lg:grid-cols-2">
          <TextSetting label="Sender Name" field="senderName" form={form} onChange={onChange} />
          <TextSetting label="Reply-to Email" field="replyToEmail" form={form} onChange={onChange} type="email" />
          <TextSetting label="Support Email" field="supportEmail" form={form} onChange={onChange} type="email" />
          <TextSetting label="Subject Template" field="emailSubjectTemplate" form={form} onChange={onChange} />
          <div className="lg:col-span-2"><TextSetting label="Email Body" field="emailBodyTemplate" form={form} onChange={onChange} multiline note="Supported placeholders: {{invoice_number}}, {{customer_name}}, {{amount_due}}, {{due_date}}, {{company_name}}, {{online_view_url}}, {{payment_url}}" /></div>
          <Toggle label="Attach PDF Invoice" note="Attach the fixed approved invoice PDF to outgoing invoice emails." checked={form.attachPdfInvoice !== false} onChange={(value) => onChange("attachPdfInvoice", value)} />
        </div>
        <div className="mt-5 rounded-xl border border-[#ead3cc] bg-[#fff8f5] p-4">
          <p className="text-xs font-bold text-[#251E1F]">Send Test Email</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input type="email" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="recipient@example.com" className="min-w-0 flex-1 rounded-lg border border-[#ead3cc] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#F38978]" />
            <button type="button" onClick={sendTest} disabled={testing || !recipient} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#F38978] px-4 py-2.5 text-sm font-bold text-[#F38978] disabled:opacity-50">
              {testing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Test Email
            </button>
          </div>
          {testMessage ? <p className="mt-2 text-xs text-[#6f5b55]">{testMessage}</p> : null}
        </div>
      </SettingsCard>
      <TabSaveButton saving={saving} />
    </div>
  );
}

function TabPlaceholder({ label }) {
  return (
    <section className="rounded-xl border border-dashed border-[#f0c9bf] bg-white/90 p-8 text-center text-sm font-semibold text-[#7b6660]">
      {label} settings are routed and ready for the next tab implementation.
    </section>
  );
}

function ActionPanel({ saving, onCancel }) {
  return (
    <div className="rounded-xl border border-[#f0d2ca] bg-white/95 p-4 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
      <button type="submit" disabled={saving} className={buttonClasses.primary}>
        {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
        {saving ? "Saving..." : "Save & Publish Settings"}
      </button>
      <button type="button" onClick={onCancel} disabled={saving} className={buttonClasses.secondary}>
        <RotateCcw size={16} />
        Cancel
      </button>
    </div>
  );
}

export default function AdminInvoiceSettingsPage({ activeTab = "general" }) {
  const location = useLocation();
  const [form, setForm] = useState(defaultForm);
  const [savedForm, setSavedForm] = useState(defaultForm);
  const [options, setOptions] = useState(emptyOptions);
  const [configurationStatus, setConfigurationStatus] = useState(null);
  const [numberingActivity, setNumberingActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState([]);

  const currentTab = tabs.some((tab) => tab.slug === activeTab) ? activeTab : "general";
  const currentTabConfig = tabs.find((tab) => tab.slug === currentTab) || tabs[0];
  const routePrefix = location.pathname.startsWith("/admin")
    ? "/admin/invoice-settings"
    : "/dashboard/invoicing/admin/invoice-settings";

  const numberingPreview = useMemo(() => {
    const startNumber = Number(form.nextInvoiceNumber) || 1;
    return Array.from({ length: 5 }, (_, index) => buildInvoiceNumber(form, startNumber + index));
  }, [form]);
  const numberingOptions = useMemo(() => ({
    ...options,
    invoiceFormats: options.invoiceFormats.map((option) => ({
      ...option,
      label: `${option.value} -> ${buildInvoiceNumber({ ...form, invoiceFormat: option.value })}`
    }))
  }), [form, options]);

  async function loadSettings() {
    setLoading(true);
    setErrors([]);

    try {
      const data = await getInvoiceSettings();
      const nextSettings = normalizeSettings(data.settings);

      setForm(cloneSettings(nextSettings));
      setSavedForm(cloneSettings(nextSettings));
      setOptions({ ...emptyOptions, ...(data.options || {}) });
      setConfigurationStatus(data.configurationStatus || null);
      setNumberingActivity(data.numberingActivity || []);
    } catch (error) {
      setErrors([error.message]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  function setSectionField(section, field, value) {
    setForm((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: value
      }
    }));
  }

  function setRootField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function setSequenceRule(field, value) {
    setForm((current) => ({
      ...current,
      sequenceRules: {
        ...current.sequenceRules,
        [field]: value
      }
    }));
  }

  function handleSeparatorChange(value) {
    setForm((current) => ({
      ...current,
      separatorStyle: value,
      invoiceFormat: formatForSeparator(current.invoiceFormat, value)
    }));
  }

  function handleFormatChange(value) {
    setForm((current) => ({
      ...current,
      invoiceFormat: value,
      separatorStyle: separatorFromFormat(value)
    }));
  }

  function validateForm() {
    const nextErrors = [];
    if (!form.general.defaultCurrency) nextErrors.push("Default currency is required.");
    if (!form.general.defaultLanguage) nextErrors.push("Default language is required.");
    if (!form.general.defaultTax) nextErrors.push("Default tax is required.");
    if (!form.general.priceDisplay) nextErrors.push("Price display is required.");
    if (!form.general.paymentTerms) nextErrors.push("Payment terms are required.");
    if (form.general.lateFeeValue === "" || Number(form.general.lateFeeValue) < 0) {
      nextErrors.push("Late fee must be 0 or higher.");
    }
    if (!form.export.pdfPaperSize) nextErrors.push("PDF paper size is required.");
    if (!form.export.excelFormat) nextErrors.push("Excel format is required.");
    if (!form.invoicePrefix) nextErrors.push("Invoice prefix is required.");
    if (!/^\d{4}$/.test(String(form.invoiceYear || ""))) nextErrors.push("Enter a valid four-digit invoice year.");
    if (!form.separatorStyle) nextErrors.push("Separator style is required.");
    if (!form.invoiceFormat) nextErrors.push("Invoice format is required.");
    if (!Number.isInteger(Number(form.nextInvoiceNumber)) || Number(form.nextInvoiceNumber) < 1) {
      nextErrors.push("Next invoice number must be 1 or higher.");
    }
    return nextErrors;
  }

  async function handleSave(event) {
    event.preventDefault();
    setMessage("");
    const nextErrors = validateForm();
    setErrors(nextErrors);
    if (nextErrors.length > 0) return;

    setSaving(true);
    try {
      const data = await updateInvoiceSettings({
        ...form,
        general: {
          ...form.general,
          lateFeeValue: Number(form.general.lateFeeValue)
        }
      });
      const savedSettings = normalizeSettings(data.settings);
      setForm(cloneSettings(savedSettings));
      setSavedForm(cloneSettings(savedSettings));
      setConfigurationStatus(data.configurationStatus || null);
      setNumberingActivity(data.numberingActivity || []);
      setMessage(data.message || "Invoice settings saved.");
    } catch (error) {
      setErrors([error.message]);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setForm(cloneSettings(savedForm));
    setErrors([]);
    setMessage("Unsaved changes have been reset.");
  }

  if (loading) {
    return (
      <section className="-m-4 min-h-[calc(100vh-5rem)] bg-[#fff6f2] p-6 text-[#251E1F] sm:-m-6">
        <div className="rounded-xl border border-[#f0d2ca] bg-white/95 p-8 text-center shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
          Loading invoice settings...
        </div>
      </section>
    );
  }

  return (
    <section
      className="-m-4 min-h-[calc(100vh-5rem)] p-4 text-[#251E1F] sm:-m-6 sm:p-6"
      style={{
        backgroundImage:
          "linear-gradient(90deg, #FDD9CD 0%, #fff8f5 15%, #fffaf8 58%, #FDD9CD 100%)"
      }}
    >
      <form onSubmit={handleSave} className="mx-auto max-w-[1600px] space-y-5">
        <header>
          <h2 className="text-2xl font-bold tracking-tight text-[#251E1F]">Invoice Settings</h2>
          <p className="mt-2 text-sm font-medium text-[#6f5b55]">
            Configure how invoices are created, delivered, and paid.
          </p>
        </header>

        <nav className="overflow-x-auto rounded-xl border border-[#f0d2ca] bg-white/90 p-1 shadow-[0_10px_28px_rgba(37,30,31,0.05)]">
          <div className="flex min-w-max gap-1">
            {tabs.map((tab) => {
              const isActive = tab.slug === currentTab;
              return (
                <Link
                  key={tab.slug}
                  to={`${routePrefix}/${tab.slug}`}
                  className={`rounded-lg px-4 py-2.5 text-sm font-bold transition ${
                    isActive
                      ? "bg-[#FDD9CD] text-[#F38978]"
                      : "text-[#6f5b55] hover:bg-[#fff0eb] hover:text-[#F38978]"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {errors.length > 0 ? (
          <MessageBanner type="error">
            {errors.map((error) => <p key={error}>{error}</p>)}
          </MessageBanner>
        ) : null}

        {message ? (
          <MessageBanner type="success">{message}</MessageBanner>
        ) : null}

        {currentTab === "numbering" ? (
          <NumberingTab
            form={form}
            options={numberingOptions}
            configurationStatus={configurationStatus}
            previewNumbers={numberingPreview}
            activity={numberingActivity}
            lastSavedAt={savedForm.updatedAt}
            saving={saving}
            onCancel={handleCancel}
            onRootFieldChange={setRootField}
            onSeparatorChange={handleSeparatorChange}
            onFormatChange={handleFormatChange}
            onSequenceRuleChange={setSequenceRule}
          />
        ) : currentTab === "email" ? (
          <EmailSettingsTab form={form} onChange={setRootField} saving={saving} />
        ) : currentTab === "payments" ? (
          <PaymentSettingsTab form={form} onChange={setRootField} saving={saving} />
        ) : currentTab !== "general" ? (
          <TabPlaceholder label={currentTabConfig.label} />
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-5">
              <SettingsCard title="General & Defaults" icon={FileText}>
                <div className="grid gap-4 lg:grid-cols-2">
                  {generalSelectFields.map((config) => (
                    <SettingsSelect
                      key={config.field}
                      config={config}
                      options={options}
                      value={form[config.section][config.field]}
                      onChange={setSectionField}
                    />
                  ))}
                  <Field label="Late Fee" note="Applied after due date">
                    <div className="grid grid-cols-[minmax(0,1fr)_96px] overflow-hidden rounded-lg border border-[#ead3cc] bg-white focus-within:border-[#F38978] focus-within:ring-2 focus-within:ring-[#F38978]/20">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.general.lateFeeValue}
                        onChange={(event) => setSectionField("general", "lateFeeValue", event.target.value)}
                        className="h-11 min-w-0 border-0 bg-transparent px-3 text-sm font-semibold text-[#251E1F] outline-none"
                      />
                      <select
                        value={form.general.lateFeeType}
                        onChange={(event) => setSectionField("general", "lateFeeType", event.target.value)}
                        className="h-11 border-l border-[#ead3cc] bg-[#fff8f5] px-3 text-sm font-bold text-[#251E1F] outline-none"
                      >
                        {options.lateFeeTypes.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </Field>
                  {generalToggles.map((config) => (
                    <SettingsToggle
                      key={config.field}
                      config={config}
                      checked={form[config.section][config.field]}
                      onChange={setSectionField}
                    />
                  ))}
                </div>
              </SettingsCard>

              <SettingsCard title="Company Information" icon={Settings2}>
                <div className="grid gap-4 lg:grid-cols-2">
                  <TextSetting label="Company Name" field="companyName" form={form} onChange={setRootField} />
                  <TextSetting label="Company Registration Number" field="companyRegistrationNumber" form={form} onChange={setRootField} />
                  <TextSetting label="Finance Email" field="financeEmail" form={form} onChange={setRootField} type="email" />
                  <TextSetting label="Support Email" field="supportEmail" form={form} onChange={setRootField} type="email" />
                  <TextSetting label="Company Address" field="companyAddress" form={form} onChange={setRootField} multiline />
                  <TextSetting label="Registered-office Address" field="registeredOfficeAddress" form={form} onChange={setRootField} multiline />
                </div>
              </SettingsCard>

              <SettingsCard title="Export Settings" icon={FileSpreadsheet}>
                <div className="grid gap-4 lg:grid-cols-2">
                  {exportToggles.map((config) => (
                    <SettingsToggle
                      key={config.field}
                      config={config}
                      checked={form[config.section][config.field]}
                      onChange={setSectionField}
                    />
                  ))}
                  {exportSelectFields.map((config) => (
                    <SettingsSelect
                      key={config.field}
                      config={config}
                      options={options}
                      value={form[config.section][config.field]}
                      onChange={setSectionField}
                    />
                  ))}
                </div>
              </SettingsCard>

              <div className="flex items-start gap-3 rounded-xl border border-[#cfe8d9] bg-white/95 p-4 text-sm text-[#527260] shadow-[0_10px_28px_rgba(37,30,31,0.04)]">
                <Info size={18} className="mt-0.5 shrink-0 text-[#F38978]" />
                <p>
                  These settings apply to new invoices. Individual invoice flows can override them when a future invoice creation page provides that control.
                </p>
              </div>
            </div>

            <aside className="space-y-5">
              <ConfigurationStatusPanel status={configurationStatus} />
              <ActionPanel saving={saving} onCancel={handleCancel} />
            </aside>
          </div>
        )}
      </form>
    </section>
  );
}
