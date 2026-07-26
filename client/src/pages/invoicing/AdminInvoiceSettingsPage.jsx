import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Circle,
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
  Settings2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import {
  createInvoiceGstRate,
  getInvoiceGstRates,
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

const invoiceSectionRootFields = {
  general: [
    "companyName",
    "companyRegistrationNumber",
    "financeEmail",
    "companyAddress",
    "registeredOfficeAddress"
  ],
  numbering: [
    "invoicePrefix",
    "invoiceYear",
    "separatorStyle",
    "invoiceFormat",
    "nextInvoiceNumber"
  ],
  email: [
    "senderName",
    "replyToEmail",
    "supportEmail",
    "emailSubjectTemplate",
    "emailBodyTemplate",
    "attachPdfInvoice"
  ],
  payments: [
    "bankAccountHolderName",
    "bankName",
    "bankAccountNumber",
    "bicSwift",
    "paynowIdentifier",
    "paymentReferenceInstruction",
    "payoutStatement",
    "computerGeneratedStatement"
  ]
};

function settingsValuesMatch(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function invoiceSectionSnapshot(settings, section) {
  const snapshot = {};
  for (const field of invoiceSectionRootFields[section] || []) {
    snapshot[field] = settings?.[field];
  }
  if (section === "general") {
    snapshot.general = settings?.general;
    snapshot.export = settings?.export;
  }
  if (section === "numbering") {
    snapshot.sequenceRules = settings?.sequenceRules;
  }
  return snapshot;
}

function hasText(value) {
  return Boolean(String(value || "").trim());
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function validateInvoiceSection(section, form) {
  if (section === "general") {
    const required = [
      form.general.defaultCurrency,
      form.general.defaultLanguage,
      form.general.defaultTax,
      form.general.priceDisplay,
      form.general.paymentTerms,
      form.export.pdfPaperSize,
      form.export.excelFormat
    ];
    const valid = required.every(hasText)
      && paymentTermsHasDueLength(form.general.paymentTerms)
      && form.general.lateFeeValue !== ""
      && Number(form.general.lateFeeValue) >= 0;
    return {
      valid,
      configured: valid,
      note: valid ? "Invoice defaults and exports are ready." : "Complete the required defaults and export fields."
    };
  }

  if (section === "numbering") {
    const valid = hasText(form.invoicePrefix)
      && /^\d{4}$/.test(String(form.invoiceYear || ""))
      && hasText(form.separatorStyle)
      && hasText(form.invoiceFormat)
      && Number.isInteger(Number(form.nextInvoiceNumber))
      && Number(form.nextInvoiceNumber) >= 1;
    return {
      valid,
      configured: valid,
      note: valid ? "Invoice numbering rules are ready." : "Complete the prefix, year, format and next number."
    };
  }

  if (section === "email") {
    const hasAny = hasText(form.senderName) || hasText(form.replyToEmail) || hasText(form.supportEmail);
    if (!hasAny) return { valid: true, configured: false, note: "Configure invoice delivery when needed." };
    const valid = hasText(form.senderName)
      && validEmail(form.replyToEmail)
      && hasText(form.emailSubjectTemplate)
      && hasText(form.emailBodyTemplate);
    return {
      valid,
      configured: valid,
      note: valid ? "Invoice email delivery is ready." : "Complete sender, reply-to, subject and email body."
    };
  }

  const hasBankDetails = hasText(form.bankName) || hasText(form.bankAccountNumber);
  const hasPayNow = hasText(form.paynowIdentifier);
  const validBankDetails = !hasBankDetails || (hasText(form.bankName) && hasText(form.bankAccountNumber));
  const configured = (hasBankDetails && validBankDetails) || hasPayNow;
  return {
    valid: validBankDetails,
    configured,
    note: configured
      ? "Customer payment instructions are ready."
      : validBankDetails
        ? "Add bank or PayNow details when needed."
        : "Complete both bank name and account number."
  };
}

function invoiceStatusMeta(status) {
  if (status === "complete") return { label: "Complete", icon: CheckCircle2, color: "text-emerald-600", badge: "bg-emerald-100 text-emerald-700" };
  if (status === "unsaved") return { label: "Unsaved changes", icon: AlertTriangle, color: "text-amber-600", badge: "bg-amber-100 text-amber-800" };
  if (status === "needs-attention") return { label: "Needs attention", icon: AlertTriangle, color: "text-rose-600", badge: "bg-rose-100 text-rose-700" };
  return { label: "Not started", icon: Circle, color: "text-slate-400", badge: "bg-slate-100 text-slate-600" };
}

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
    onlineViewLinkEnabled: true,
    whatsappNotificationsEnabled: true
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
  { label: "Price Display", section: "general", field: "priceDisplay", optionsKey: "priceDisplayOptions" }
];

const generalToggles = [
  {
    label: "Online View Link",
    note: "Always included when Finance sends invoices.",
    section: "general",
    field: "onlineViewLinkEnabled",
    locked: true
  },
  {
    label: "Enable WhatsApp Notifications",
    note: "Always enabled for invoice notification settings.",
    section: "general",
    field: "whatsappNotificationsEnabled",
    locked: true
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

function paymentTermsHasDueLength(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (/^(due\s+on\s+receipt|immediate|payable\s+on\s+receipt)$/i.test(text)) return true;
  return /\bnet\s*\d+\b/i.test(text) || /\b\d+\s*(?:calendar\s*)?(?:business\s*)?days?\b/i.test(text);
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
  if (config.field === "defaultTax") {
    const selected = options[config.optionsKey].find((option) => option.value === value);
    return (
      <Field label={config.label} note="Managed from GST Management. This field is locked for invoice consistency.">
        <input
          type="text"
          readOnly
          value={selected?.label || "No GST rate configured"}
          className="h-11 w-full rounded-lg border border-[#ead3cc] bg-[#fff8f5] px-3 text-sm font-semibold text-[#251E1F] outline-none"
        />
      </Field>
    );
  }

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

function PaymentTermsSetting({ options, value, onChange }) {
  const fixedOptions = options.paymentTerms || [];
  const fixedValues = new Set(fixedOptions.map((option) => option.value));
  const isCustom = value && !fixedValues.has(value);
  const selectValue = isCustom ? "__custom__" : value;
  const customDays = isCustom ? String(value).match(/\d+/)?.[0] || "" : "";

  function handleSelect(nextValue) {
    if (nextValue === "__custom__") {
      onChange("general", "paymentTerms", isCustom ? value : "Net ");
      return;
    }
    onChange("general", "paymentTerms", nextValue);
  }

  return (
    <Field label="Payment Terms" note="Choose a saved term or enter a custom number of days.">
      <div className="space-y-2">
        <SelectField
          value={selectValue}
          onChange={handleSelect}
          options={[...fixedOptions, { value: "__custom__", label: "Custom term" }]}
        />
        {selectValue === "__custom__" ? (
          <input
            type="number"
            min="0"
            step="1"
            value={customDays}
            onChange={(event) => onChange("general", "paymentTerms", event.target.value === "" ? "Net " : `Net ${event.target.value}`)}
            placeholder="Number of days"
            className="h-11 w-full rounded-lg border border-[#ead3cc] bg-white px-3 text-sm font-semibold text-[#251E1F] outline-none transition focus:border-[#F38978] focus:ring-2 focus:ring-[#F38978]/20"
          />
        ) : null}
      </div>
    </Field>
  );
}

function shortDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-SG", {
    year: "numeric",
    month: "short",
    day: "2-digit"
  }).format(date);
}

function GstManagementTab() {
  const navigate = useNavigate();
  const [data, setData] = useState({ rates: [], currentRate: null, nextRate: null });
  const [form, setForm] = useState({
    ratePercentage: "",
    effectiveFrom: "",
    effectiveTo: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadGstRates() {
    setLoading(true);
    setError("");
    try {
      setData(await getInvoiceGstRates());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGstRates();
  }, []);

  async function submitGstRate() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const nextData = await createInvoiceGstRate({
        taxName: "GST",
        ratePercentage: Number(form.ratePercentage),
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null
      });
      setData(nextData);
      setForm({ ratePercentage: "", effectiveFrom: "", effectiveTo: "" });
      setMessage("GST rate scheduled.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function clearScheduleForm() {
    setForm({ ratePercentage: "", effectiveFrom: "", effectiveTo: "" });
    setMessage("");
    setError("");
  }

  const previewRates = data.rates.slice(0, 5);

  if (loading) {
    return (
      <section className="rounded-xl border border-[#f0d2ca] bg-white/95 p-8 text-center text-sm font-semibold text-[#7b6660]">
        Loading GST management...
      </section>
    );
  }

  return (
    <div className="space-y-5">
      {error ? <MessageBanner type="error">{error}</MessageBanner> : null}
      {message ? <MessageBanner type="success">{message}</MessageBanner> : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[#f0d2ca] bg-white/95 p-5 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#F38978]">Current Active GST</p>
              <p className="mt-3 text-4xl font-bold leading-none text-[#251E1F]">
                {data.currentRate ? `${Number(data.currentRate.ratePercentage)}%` : "-"}
              </p>
            </div>
            <span className="rounded-full border border-[#f0d2ca] bg-[#fff8f5] px-3 py-1 text-xs font-bold text-[#6f4f47]">
              {data.currentRate?.taxName || "GST"}
            </span>
          </div>
          <div className="mt-5 border-t border-[#f0d2ca] pt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[#7b6660]">Effective From</p>
            <p className="mt-1 text-sm font-semibold text-[#251E1F]">{shortDate(data.currentRate?.effectiveFrom)}</p>
          </div>
        </div>

        <div className="rounded-xl border border-[#f0d2ca] bg-white/95 p-5 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#F38978]">Upcoming Scheduled GST</p>
              <p className="mt-3 text-4xl font-bold leading-none text-[#251E1F]">
                {data.nextRate ? `${Number(data.nextRate.ratePercentage)}%` : "None"}
              </p>
            </div>
            <span className="rounded-full border border-[#f0d2ca] bg-[#fff8f5] px-3 py-1 text-xs font-bold text-[#6f4f47]">
              {data.nextRate?.taxName || "Pending"}
            </span>
          </div>
          <div className="mt-5 border-t border-[#f0d2ca] pt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[#7b6660]">Starts On</p>
            <p className="mt-1 text-sm font-semibold text-[#251E1F]">
              {data.nextRate ? shortDate(data.nextRate.effectiveFrom) : "No scheduled change"}
            </p>
          </div>
        </div>
      </section>

      <SettingsCard title="Schedule GST Rate" icon={FileText}>
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr_auto] xl:items-start">
          <Field label="GST Rate (%)">
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              required
              value={form.ratePercentage}
              onChange={(event) => setForm((current) => ({ ...current, ratePercentage: event.target.value }))}
              className="h-11 w-full rounded-lg border border-[#ead3cc] bg-white px-3 text-sm font-semibold text-[#251E1F] outline-none focus:border-[#F38978]"
            />
          </Field>
          <Field label="Effective From">
            <input
              type="date"
              required
              value={form.effectiveFrom}
              onChange={(event) => setForm((current) => ({ ...current, effectiveFrom: event.target.value }))}
              className="h-11 w-full rounded-lg border border-[#ead3cc] bg-white px-3 text-sm font-semibold text-[#251E1F] outline-none focus:border-[#F38978]"
            />
          </Field>
          <Field label="Effective To" note="Leave empty for ongoing.">
            <input
              type="date"
              value={form.effectiveTo}
              onChange={(event) => setForm((current) => ({ ...current, effectiveTo: event.target.value }))}
              className="h-11 w-full rounded-lg border border-[#ead3cc] bg-white px-3 text-sm font-semibold text-[#251E1F] outline-none focus:border-[#F38978]"
            />
          </Field>
          <button
            type="button"
            onClick={submitGstRate}
            disabled={saving || !form.ratePercentage || !form.effectiveFrom}
            className="primary-button mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold disabled:opacity-60 xl:mt-5"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Saving..." : "Schedule"}
          </button>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={clearScheduleForm}
            disabled={saving || (!form.ratePercentage && !form.effectiveFrom && !form.effectiveTo)}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[#ead3cc] bg-white px-4 text-sm font-bold text-[#6f4f47] transition hover:border-[#F38978] hover:text-[#F38978] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </SettingsCard>

      <SettingsCard title="GST Rate History" icon={Clock3}>
        <div className="-mt-2 mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => navigate("/dashboard/invoicing/admin/gst-management/history")}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[#F38978]/30 bg-white px-4 text-sm font-bold text-[#F38978] transition hover:bg-[#FDD9CD]/30"
          >
            View Full History
          </button>
        </div>
        <div className="overflow-hidden rounded-lg border border-[#f0d2ca]">
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="bg-[#fff8f5] text-xs font-bold uppercase text-[#7b6660]">
                <tr>
                  <th className="px-4 py-3">Tax Code</th>
                  <th className="px-4 py-3">Tax Name</th>
                  <th className="px-4 py-3">Rate</th>
                  <th className="px-4 py-3">Effective From</th>
                  <th className="px-4 py-3">Effective To</th>
                  <th className="px-4 py-3">Created By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f5e2dc] bg-white">
                {previewRates.length === 0 ? (
                  <tr><td colSpan="6" className="px-4 py-10 text-center font-semibold text-[#7b6660]">No GST rates configured.</td></tr>
                ) : previewRates.map((rate) => (
                  <tr key={rate.id} className="align-middle">
                    <td className="px-4 py-3 font-bold text-[#251E1F]">{rate.taxCode}</td>
                    <td className="px-4 py-3 text-[#7b6660]">{rate.taxName}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-[#FDD9CD]/55 px-2.5 py-1 text-xs font-bold text-[#251E1F]">
                        {Number(rate.ratePercentage)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#7b6660]">{shortDate(rate.effectiveFrom)}</td>
                    <td className="px-4 py-3 text-[#7b6660]">{rate.effectiveTo ? shortDate(rate.effectiveTo) : "Ongoing"}</td>
                    <td className="px-4 py-3 text-[#7b6660]">{rate.createdBy || "System"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {data.rates.length > 5 ? (
          <p className="mt-3 text-right text-xs font-semibold text-[#7b6660]">
            Showing 5 of {data.rates.length} records
          </p>
        ) : null}
      </SettingsCard>
    </div>
  );
}

export function AdminGstHistoryPage() {
  const [data, setData] = useState({ rates: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadGstRates() {
      setLoading(true);
      setError("");
      try {
        const response = await getInvoiceGstRates();
        if (active) setData(response);
      } catch (requestError) {
        if (active) setError(requestError.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadGstRates();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section
      className="min-h-screen p-6 text-[#251E1F]"
      style={{
        backgroundImage:
          "linear-gradient(90deg, #FDD9CD 0%, #fff8f5 15%, #fffaf8 58%, #FDD9CD 100%)"
      }}
    >
      <div className="mx-auto max-w-[1400px] space-y-5">
        <header className="space-y-4">
          <Link
            to="/dashboard/invoicing/admin/gst-management"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[#ead3cc] bg-white px-4 text-sm font-bold text-[#6f4f47] transition hover:border-[#F38978] hover:text-[#F38978]"
          >
            Back to GST Management
          </Link>
          <div>
            <p className="text-sm font-bold text-[#F38978]">GST Management</p>
            <h1 className="mt-1 text-2xl font-bold text-[#251E1F]">GST Rate History</h1>
          </div>
        </header>

        {error ? <MessageBanner type="error">{error}</MessageBanner> : null}

        <section className="rounded-xl border border-[#f0d2ca] bg-white/95 p-5 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
          {loading ? (
            <div className="flex min-h-40 items-center justify-center gap-2 text-sm font-semibold text-[#7b6660]">
              <Loader2 size={18} className="animate-spin" />
              Loading GST rate history...
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-[#f0d2ca]">
              <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full text-left text-sm">
                  <thead className="bg-[#fff8f5] text-xs font-bold uppercase text-[#7b6660]">
                    <tr>
                      <th className="px-4 py-3">Tax Code</th>
                      <th className="px-4 py-3">Tax Name</th>
                      <th className="px-4 py-3">Rate</th>
                      <th className="px-4 py-3">Effective From</th>
                      <th className="px-4 py-3">Effective To</th>
                      <th className="px-4 py-3">Created By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f5e2dc] bg-white">
                    {data.rates.length === 0 ? (
                      <tr><td colSpan="6" className="px-4 py-10 text-center font-semibold text-[#7b6660]">No GST rates configured.</td></tr>
                    ) : data.rates.map((rate) => (
                      <tr key={rate.id} className="align-middle">
                        <td className="px-4 py-3 font-bold text-[#251E1F]">{rate.taxCode}</td>
                        <td className="px-4 py-3 text-[#7b6660]">{rate.taxName}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-[#FDD9CD]/55 px-2.5 py-1 text-xs font-bold text-[#251E1F]">
                            {Number(rate.ratePercentage)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#7b6660]">{shortDate(rate.effectiveFrom)}</td>
                        <td className="px-4 py-3 text-[#7b6660]">{rate.effectiveTo ? shortDate(rate.effectiveTo) : "Ongoing"}</td>
                        <td className="px-4 py-3 text-[#7b6660]">{rate.createdBy || "System"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

export function AdminGstManagementPage() {
  return (
    <section
      className="-m-4 min-h-[calc(100vh-5rem)] p-4 text-[#251E1F] sm:-m-6 sm:p-6"
      style={{
        backgroundImage:
          "linear-gradient(90deg, #FDD9CD 0%, #fff8f5 15%, #fffaf8 58%, #FDD9CD 100%)"
      }}
    >
      <div className="mx-auto max-w-[1600px] space-y-5">
        <header>
          <h2 className="text-2xl font-bold tracking-tight text-[#251E1F]">GST Management</h2>
          <p className="mt-2 text-sm font-medium text-[#6f5b55]">
            Schedule invoice GST rates by effective date.
          </p>
        </header>
        <GstManagementTab />
      </div>
    </section>
  );
}

function Toggle({ checked, onChange, label, note, disabled = false }) {
  return (
    <label className={`flex min-h-[70px] items-center justify-between gap-4 rounded-lg border border-[#ead3cc] bg-[#fff8f5] px-4 py-3 ${disabled ? "cursor-not-allowed" : ""}`}>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-[#251E1F]">{label}</span>
        {note ? <span className="mt-1 block text-xs leading-5 text-[#7b6660]">{note}</span> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
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
      checked={config.locked ? true : checked}
      disabled={config.locked}
      onChange={(nextValue) => {
        if (!config.locked) onChange(config.section, config.field, nextValue);
      }}
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

function ConfigurationStatusPanel({ sections, currentTab, routePrefix, savedAt }) {
  const completedCount = sections.filter((section) => section.status === "complete").length;
  const percentage = Math.round((completedCount / sections.length) * 100);

  return (
    <SettingsCard title="Configuration Status" icon={Settings2}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-bold text-[#251E1F]">{completedCount} of {sections.length}</p>
          <p className="text-xs font-semibold text-[#7b6660]">steps completed</p>
        </div>
        <span className="text-sm font-bold text-[#F38978]">{percentage}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#f7e2db]">
        <div className="h-full rounded-full bg-[#F38978] transition-all" style={{ width: `${percentage}%` }} />
      </div>

      <div className="mt-5 space-y-3">
        {sections.map((section) => {
          const meta = invoiceStatusMeta(section.status);
          const StatusIcon = meta.icon;
          const isCurrent = currentTab === section.slug;
          return (
            <Link
              key={section.slug}
              to={`${routePrefix}/${section.slug}`}
              className={`block rounded-xl border p-3 transition ${
                isCurrent
                  ? "border-[#F38978] bg-[#fff3ee]"
                  : "border-[#f0d2ca] bg-white hover:border-[#e8b8ac]"
              }`}
            >
              <div className="flex items-start gap-3">
                <StatusIcon size={18} className={`mt-0.5 shrink-0 ${meta.color}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-[#251E1F]">{section.label}</p>
                    {isCurrent ? <span className="rounded-full bg-[#FDD9CD] px-2 py-0.5 text-[10px] font-bold uppercase text-[#E8573D]">Current</span> : null}
                  </div>
                  <span className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.badge}`}>
                    {meta.label}
                  </span>
                  <p className="mt-2 text-xs leading-5 text-[#7b6660]">{section.note}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-5 border-t border-[#f0d2ca] pt-4">
        <p className="text-xs font-bold text-[#7b6660]">Last saved</p>
        <p className="mt-1 text-sm font-bold text-[#251E1F]">{formatDateTime(savedAt)}</p>
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
  activity,
  onRootFieldChange,
  onSeparatorChange,
  onFormatChange,
  onSequenceRuleChange
}) {
  const examplePreview = buildInvoiceNumber(form);

  return (
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

function PaymentSettingsTab({ form, onChange }) {
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
    </div>
  );
}

function EmailSettingsTab({ form, onChange }) {
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
    </div>
  );
}

function ActionPanel({ saving, dirty, invalid, canSave, onDiscard }) {
  return (
    <div className="rounded-xl border border-[#f0d2ca] bg-white/95 p-4 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
      <button type="submit" disabled={saving || !canSave || invalid} className={buttonClasses.primary}>
        {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
        {saving ? "Saving..." : "Save Settings"}
      </button>
      {dirty ? (
        <button type="button" onClick={onDiscard} disabled={saving} className={buttonClasses.secondary}>
          <RotateCcw size={16} />
          Discard Changes
        </button>
      ) : null}
    </div>
  );
}

function SettingsTabLayout({
  children,
  sectionStates,
  currentTab,
  routePrefix,
  savedAt,
  saving,
  dirty,
  invalid,
  canSave,
  onDiscard,
  asideExtra = null
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-5">
        {children}
      </div>
      <aside className="space-y-5">
        <ConfigurationStatusPanel sections={sectionStates} currentTab={currentTab} routePrefix={routePrefix} savedAt={savedAt} />
        <ActionPanel saving={saving} dirty={dirty} invalid={invalid} canSave={canSave} onDiscard={onDiscard} />
        {asideExtra}
      </aside>
    </div>
  );
}

export default function AdminInvoiceSettingsPage({ activeTab = "general" }) {
  const location = useLocation();
  const [form, setForm] = useState(defaultForm);
  const [savedForm, setSavedForm] = useState(defaultForm);
  const [options, setOptions] = useState(emptyOptions);
  const [numberingActivity, setNumberingActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState([]);

  const currentTab = tabs.some((tab) => tab.slug === activeTab) ? activeTab : "general";
  const routePrefix = location.pathname.startsWith("/admin")
    ? "/admin/invoice-settings"
    : "/dashboard/invoicing/admin/invoice-settings";
  const sectionStates = tabs.map((tab) => {
    const validation = validateInvoiceSection(tab.slug, form);
    const dirty = !settingsValuesMatch(
      invoiceSectionSnapshot(form, tab.slug),
      invoiceSectionSnapshot(savedForm, tab.slug)
    );
    const status = !validation.valid
      ? "needs-attention"
      : dirty
        ? "unsaved"
        : savedForm.updatedAt && validation.configured
          ? "complete"
          : "not-started";
    return { ...tab, ...validation, dirty, status };
  });
  const hasUnsavedChanges = sectionStates.some((section) => section.dirty);
  const hasInvalidChanges = sectionStates.some((section) => !section.valid);
  const canSave = !savedForm.updatedAt || hasUnsavedChanges;
  const settingsLayoutProps = {
    sectionStates,
    currentTab,
    routePrefix,
    savedAt: savedForm.updatedAt,
    saving,
    dirty: hasUnsavedChanges,
    invalid: hasInvalidChanges,
    canSave,
    onDiscard: handleCancel
  };

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

  useEffect(() => {
    function warnBeforeLeaving(event) {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [hasUnsavedChanges]);

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
    if (form.general.paymentTerms && !paymentTermsHasDueLength(form.general.paymentTerms)) {
      nextErrors.push("Payment terms must include a number of days, for example Net 45, or be Due on Receipt.");
    }
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
    for (const section of sectionStates.filter((item) => !item.valid)) {
      if (!nextErrors.includes(section.note)) nextErrors.push(section.note);
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
              const tabState = sectionStates.find((section) => section.slug === tab.slug);
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
                  {tabState?.dirty ? <span className="ml-2 inline-block h-2 w-2 rounded-full bg-amber-500" aria-label="Unsaved changes" /> : null}
                </Link>
              );
            })}
          </div>
        </nav>

        {hasUnsavedChanges ? (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>You have unsaved invoice configuration changes.</span>
          </div>
        ) : null}

        {errors.length > 0 ? (
          <MessageBanner type="error">
            {errors.map((error) => <p key={error}>{error}</p>)}
          </MessageBanner>
        ) : null}

        {message ? (
          <MessageBanner type="success">{message}</MessageBanner>
        ) : null}

        {currentTab === "numbering" ? (
          <SettingsTabLayout
            {...settingsLayoutProps}
            asideExtra={<NumberingPreviewPanel form={form} previewNumbers={numberingPreview} />}
          >
            <NumberingTab
              form={form}
              options={numberingOptions}
              activity={numberingActivity}
              onRootFieldChange={setRootField}
              onSeparatorChange={handleSeparatorChange}
              onFormatChange={handleFormatChange}
              onSequenceRuleChange={setSequenceRule}
            />
          </SettingsTabLayout>
        ) : currentTab === "email" ? (
          <SettingsTabLayout {...settingsLayoutProps}>
            <EmailSettingsTab form={form} onChange={setRootField} />
          </SettingsTabLayout>
        ) : currentTab === "payments" ? (
          <SettingsTabLayout {...settingsLayoutProps}>
            <PaymentSettingsTab form={form} onChange={setRootField} />
          </SettingsTabLayout>
        ) : (
          <SettingsTabLayout {...settingsLayoutProps}>
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
                  <PaymentTermsSetting
                    options={options}
                    value={form.general.paymentTerms}
                    onChange={setSectionField}
                  />
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
          </SettingsTabLayout>
        )}
      </form>
    </section>
  );
}
