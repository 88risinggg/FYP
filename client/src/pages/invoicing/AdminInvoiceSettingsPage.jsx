/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - ADMIN
 * PURPOSE: Implements the Admin Invoice Settings Page screen and its page-level interactions.
 * LAYER: Frontend page - renders a complete screen and coordinates its user interactions.
 * FIND RELATED CODE: Trace its imports for UI components and frontend services used by this screen.
 */
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
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
import { useEffect, useMemo, useRef, useState } from "react";
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
  separatorStyles: [],
  invoiceFormats: []
};

const emptyConfigurationStatus = {
  categories: {
    general: "incomplete",
    numbering: "incomplete",
    email: "incomplete",
    payments: "incomplete"
  },
  completionPercentage: 0
};

const emailPlaceholders = [
  { label: "Customer Name", token: "{{customer_name}}" },
  { label: "Invoice Number", token: "{{invoice_number}}" },
  { label: "Amount Due", token: "{{amount_due}}" },
  { label: "Due Date", token: "{{due_date}}" },
  { label: "Company Name", token: "{{company_name}}" },
  { label: "Online Invoice", token: "{{online_view_url}}" },
  { label: "Payment Link", token: "{{payment_url}}" }
];

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

function validateEmailTemplatePlaceholders(subjectTemplate, bodyTemplate) {
  const allowedPlaceholders = new Map(emailPlaceholders.map(({ label, token }) => [
    token.slice(2, -2),
    label
  ]));
  const placeholderNames = [...allowedPlaceholders.keys()].join("|");
  const errors = [];

  for (const { location, value } of [
    { location: "Subject Template", value: subjectTemplate },
    { location: "Email Body", value: bodyTemplate }
  ]) {
    const template = String(value || "");

    for (const match of template.matchAll(/\{\{([^{}]+)\}\}/g)) {
      const key = match[1];
      if (!allowedPlaceholders.has(key)) {
        errors.push(`Unsupported email placeholder "{{${key}}}" in ${location}.`);
      }
    }
    for (const match of template.matchAll(/\{+([a-z_]+)\}+/g)) {
      if (!allowedPlaceholders.has(match[1])) {
        errors.push(`Unsupported email placeholder "${match[0]}" in ${location}.`);
      }
    }

    const knownPlaceholderPattern = new RegExp(`\\b(${placeholderNames})\\b`, "g");
    for (const match of template.matchAll(knownPlaceholderPattern)) {
      const key = match[1];
      const placeholderLabel = allowedPlaceholders.get(key);
      let openingBraces = 0;
      let closingBraces = 0;

      for (let index = match.index - 1; index >= 0 && template[index] === "{"; index -= 1) {
        openingBraces += 1;
      }
      for (
        let index = match.index + key.length;
        index < template.length && template[index] === "}";
        index += 1
      ) {
        closingBraces += 1;
      }

      if (openingBraces < 2) {
        const missingCount = 2 - openingBraces;
        errors.push(
          `The ${placeholderLabel} placeholder "{{${key}}}" in ${location} is missing ${
            missingCount === 1 ? 'an opening "{" symbol' : 'two opening "{" symbols'
          }.`
        );
      } else if (openingBraces > 2) {
        errors.push(`The ${placeholderLabel} placeholder "{{${key}}}" in ${location} has an extra opening "{" symbol.`);
      }

      if (closingBraces < 2) {
        const missingCount = 2 - closingBraces;
        errors.push(
          `The ${placeholderLabel} placeholder "{{${key}}}" in ${location} is missing ${
            missingCount === 1 ? 'a closing "}" symbol' : 'two closing "}" symbols'
          }.`
        );
      } else if (closingBraces > 2) {
        errors.push(`The ${placeholderLabel} placeholder "{{${key}}}" in ${location} has an extra closing "}" symbol.`);
      }
    }
  }

  return [...new Set(errors)];
}

function validateInvoiceSection(section, form) {
  if (section === "general") {
    const required = [
      form.general.defaultCurrency,
      form.general.defaultLanguage,
      form.general.defaultTax,
      form.general.priceDisplay,
      form.general.paymentTerms
    ];
    const valid = required.every(hasText)
      && paymentTermsHasDueLength(form.general.paymentTerms)
      && form.general.lateFeeValue !== ""
      && Number(form.general.lateFeeValue) >= 0
      && (!hasText(form.financeEmail) || validEmail(form.financeEmail));
    const configured = valid && hasText(form.companyName) && validEmail(form.financeEmail);
    return {
      valid,
      configured,
      note: configured
        ? "Invoice defaults and company details are ready."
        : valid
          ? "Add the company name and a valid finance email."
          : "Complete the required defaults and export fields."
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
    const replyToIsValid = !hasText(form.replyToEmail) || validEmail(form.replyToEmail);
    const supportIsValid = !hasText(form.supportEmail) || validEmail(form.supportEmail);
    const templatesArePresent = hasText(form.emailSubjectTemplate)
      && hasText(form.emailBodyTemplate);
    const placeholdersAreValid = validateEmailTemplatePlaceholders(
      form.emailSubjectTemplate,
      form.emailBodyTemplate
    ).length === 0;
    const valid = replyToIsValid && supportIsValid && templatesArePresent;
    const configured = valid
      && placeholdersAreValid
      && hasText(form.senderName)
      && validEmail(form.replyToEmail);
    return {
      valid,
      configured,
      note: configured
        ? "Invoice email delivery is ready."
        : valid
          ? "Add the sender and a valid reply-to email. Support email is optional."
          : "Correct the email addresses or template placeholders."
    };
  }

  const hasBankDetails = hasText(form.bankName) || hasText(form.bankAccountNumber);
  const hasPayNow = hasText(form.paynowIdentifier);
  const validBankDetails = !hasBankDetails || (hasText(form.bankName) && hasText(form.bankAccountNumber));
  const configured = hasText(form.bankAccountHolderName)
    && hasText(form.bankName)
    && hasText(form.bankAccountNumber)
    && hasText(form.bicSwift)
    && hasPayNow
    && hasText(form.paymentReferenceInstruction);
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
    defaultLanguage: "en",
    defaultTax: "",
    priceDisplay: "",
    paymentTerms: "",
    lateFeeValue: "",
    lateFeeType: "percent",
    onlineViewLinkEnabled: true,
    whatsappNotificationsEnabled: true
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

const sequenceRuleFields = [
  {
    label: "Yearly Reset",
    note: "Start the first invoice of each new year at 0001. The full invoice number still includes the year.",
    field: "yearlyReset"
  },
  {
    label: "Allow Manual Override",
    note: "Allow Admin to adjust the next number that will be generated. Existing invoice numbers remain unchanged.",
    field: "allowManualOverride"
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

function formatEmailPreviewDate(value) {
  const source = String(value || "").trim();
  const dateOnly = source.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = dateOnly
    ? new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])))
    : new Date(source);

  if (Number.isNaN(date.getTime())) return "19 Aug 2026";
  return new Intl.DateTimeFormat("en-SG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function renderEmailPreview(template, values) {
  return String(template || "").replace(/\{\{([a-z_]+)\}\}/g, (match, key) => (
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match
  ));
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

function PlaceholderValidationDialog({ errors, onClose }) {
  if (errors.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#251E1F]/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="placeholder-validation-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-[#f0d2ca] bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <AlertTriangle size={21} />
          </span>
          <div>
            <h3 id="placeholder-validation-title" className="text-lg font-bold text-[#251E1F]">
              Check Email Placeholder
            </h3>
            <p className="mt-1 text-sm text-[#6f5b55]">
              Correct the placeholder symbol before saving the invoice email settings.
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-4">
          {errors.map((error) => (
            <p key={error} className="text-sm font-semibold text-rose-700">{error}</p>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-[#F38978] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#e87562]"
        >
          Return to Email Settings
        </button>
      </div>
    </div>
  );
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
  if (config.field === "defaultLanguage") {
    return (
      <Field label={config.label} note="Invoices are issued in English.">
        <input
          type="text"
          readOnly
          value="English"
          className="h-11 w-full rounded-lg border border-[#ead3cc] bg-[#fff8f5] px-3 text-sm font-semibold text-[#251E1F] outline-none"
        />
      </Field>
    );
  }

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
      setData(await getInvoiceGstRates({ limit: 5, order: "latest" }));
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
        ratePercentage: form.ratePercentage,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null
      }, { limit: 5, order: "latest" });
      setData(nextData);
      setMessage(`GST ${form.ratePercentage}% scheduled to start on ${shortDate(form.effectiveFrom)}.`);
      setForm({ ratePercentage: "", effectiveFrom: "", effectiveTo: "" });
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
        <div className="-mt-2 mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[#7b6660]">Latest 5 GST rate changes, newest first.</p>
          <button
            type="button"
            onClick={() => navigate("/dashboard/invoicing/admin/gst-management/history")}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[#F38978]/30 bg-white px-4 text-sm font-bold text-[#F38978] transition hover:bg-[#FDD9CD]/30"
          >
            View All
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

function ConfigurationStatusPanel({ sections, currentTab, routePrefix, configurationStatus }) {
  const completedCount = sections.filter(
    (section) => configurationStatus?.categories?.[section.slug] === "completed"
  ).length;
  const percentage = Number.isFinite(Number(configurationStatus?.completionPercentage))
    ? Number(configurationStatus.completionPercentage)
    : Math.round((completedCount / sections.length) * 100);

  return (
    <SettingsCard title="Configuration Status" icon={Settings2}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-bold text-[#251E1F]">{completedCount} of {sections.length}</p>
          <p className="text-xs font-semibold text-[#7b6660]">saved steps completed</p>
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
  const recentActivity = activity.slice(0, 5);

  return (
    <SettingsCard title="Numbering Settings History" icon={Clock3}>
      <div className="-mt-2 mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[#7b6660]">Latest 5 numbering setting changes, newest first.</p>
        <Link
          to="/dashboard/invoicing/admin/invoice-settings/numbering/history"
          className="text-xs font-bold text-[#F38978] hover:text-[#d86150]"
        >
          View All
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[680px] w-full text-left text-sm">
          <thead className="border-b border-[#f0d2ca] text-xs font-bold uppercase text-[#7b6660]">
            <tr>
              <th className="px-3 py-3">Date &amp; Time</th>
              <th className="px-3 py-3">Action</th>
              <th className="px-3 py-3">Old Value</th>
              <th className="px-3 py-3">New Value</th>
              <th className="px-3 py-3">Changed By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f5e2dc]">
            {recentActivity.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-3 py-8 text-center text-sm font-semibold text-[#7b6660]">
                  No numbering activity yet.
                </td>
              </tr>
            ) : (
              recentActivity.map((item) => (
                <tr key={item.id} className="align-top transition hover:bg-[#fff8f5]">
                  <td className="whitespace-nowrap px-3 py-3 font-semibold text-[#251E1F]">
                    {formatDateTime(item.createdAt)}
                  </td>
                  <td className="px-3 py-3 font-semibold text-[#251E1F]">{item.action}</td>
                  <td className="px-3 py-3 text-[#7b6660]">{item.oldValue}</td>
                  <td className="px-3 py-3 font-semibold text-[#251E1F]">{item.newValue}</td>
                  <td className="px-3 py-3 text-[#7b6660]">{item.changedBy}</td>
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
          <Field label="Next Invoice Number" note="The server advances this automatically. Enable Manual Override only for an approved correction.">
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
              checked={rule.locked ? true : form.sequenceRules[rule.field]}
              disabled={rule.locked}
              onChange={(value) => {
                if (!rule.locked) onSequenceRuleChange(rule.field, value);
              }}
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
  const [placeholderTarget, setPlaceholderTarget] = useState("emailBodyTemplate");
  const subjectTemplateRef = useRef(null);
  const bodyTemplateRef = useRef(null);
  const previewValues = {
    invoice_number: "TEST-INVOICE",
    customer_name: "Test Recipient",
    amount_due: `${form.general?.defaultCurrency || form.defaultCurrency || "SGD"} 100.00`,
    due_date: formatEmailPreviewDate(form.sampleDueDate || "2026-08-19"),
    company_name: form.companyName || "Your Company",
    online_view_url: "https://secure.paynivo.com/invoice/TEST-INVOICE",
    payment_url: "https://secure.paynivo.com/pay/TEST-INVOICE"
  };
  const previewSubject = renderEmailPreview(form.emailSubjectTemplate, previewValues);
  const previewBody = renderEmailPreview(form.emailBodyTemplate, previewValues);

  function selectPlaceholderTarget(field) {
    setPlaceholderTarget(field);
    const fieldRef = field === "emailSubjectTemplate" ? subjectTemplateRef : bodyTemplateRef;
    window.requestAnimationFrame(() => fieldRef.current?.focus());
  }

  function insertPlaceholder(token) {
    const fieldRef = placeholderTarget === "emailSubjectTemplate" ? subjectTemplateRef : bodyTemplateRef;
    const element = fieldRef.current;
    const currentValue = String(form[placeholderTarget] || "");
    const selectionStart = element?.selectionStart ?? currentValue.length;
    const selectionEnd = element?.selectionEnd ?? selectionStart;
    const nextValue = `${currentValue.slice(0, selectionStart)}${token}${currentValue.slice(selectionEnd)}`;
    const nextCursorPosition = selectionStart + token.length;

    onChange(placeholderTarget, nextValue);
    window.requestAnimationFrame(() => {
      fieldRef.current?.focus();
      fieldRef.current?.setSelectionRange(nextCursorPosition, nextCursorPosition);
    });
  }

  async function sendTest() {
    setTesting(true);
    setTestMessage("");
    try {
      const response = await sendInvoiceSettingsTestEmail(recipient, form);
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
          <TextSetting label="Sender Name" field="senderName" form={form} onChange={onChange} note="This changes the display name. The sending address comes from the secured email connection." />
          <TextSetting label="Reply-to Email" field="replyToEmail" form={form} onChange={onChange} type="email" />
          <TextSetting label="Support Email (Optional)" field="supportEmail" form={form} onChange={onChange} type="email" note="If empty, the Finance Email appears in the email footer." />
          <Field label="Subject Template">
            <input
              ref={subjectTemplateRef}
              type="text"
              value={form.emailSubjectTemplate || ""}
              onChange={(event) => onChange("emailSubjectTemplate", event.target.value)}
              onFocus={() => setPlaceholderTarget("emailSubjectTemplate")}
              className="w-full rounded-lg border border-[#ead3cc] bg-white px-3 py-2.5 text-sm font-semibold text-[#251E1F] outline-none focus:border-[#F38978] focus:ring-2 focus:ring-[#F38978]/20"
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
                  { label: "Subject", field: "emailSubjectTemplate" },
                  { label: "Email body", field: "emailBodyTemplate" }
                ].map((target) => {
                  const selected = placeholderTarget === target.field;
                  return (
                    <button
                      key={target.field}
                      type="button"
                      onClick={() => selectPlaceholderTarget(target.field)}
                      className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                        selected ? "bg-[#F38978] text-white" : "text-[#6f5b55] hover:bg-[#fff1ec]"
                      }`}
                      aria-pressed={selected}
                    >
                      {target.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {emailPlaceholders.map((placeholder) => (
                <button
                  key={placeholder.token}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insertPlaceholder(placeholder.token)}
                  title={`Insert ${placeholder.token}`}
                  className="rounded-full border border-[#efb8aa] bg-white px-3 py-1.5 text-xs font-bold text-[#b44f3e] transition hover:border-[#F38978] hover:bg-[#fff1ec] focus:outline-none focus:ring-2 focus:ring-[#F38978]/30"
                >
                  + {placeholder.label}
                </button>
              ))}
            </div>
          </div>
          <div className="lg:col-span-2">
            <Field label="Email Body" note="Click a placeholder above to insert customer and invoice information automatically.">
              <textarea
                ref={bodyTemplateRef}
                rows={6}
                value={form.emailBodyTemplate || ""}
                onChange={(event) => onChange("emailBodyTemplate", event.target.value)}
                onFocus={() => setPlaceholderTarget("emailBodyTemplate")}
                className="w-full rounded-lg border border-[#ead3cc] bg-white px-3 py-2.5 text-sm font-semibold text-[#251E1F] outline-none focus:border-[#F38978] focus:ring-2 focus:ring-[#F38978]/20"
              />
            </Field>
          </div>
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
      <SettingsCard title="Email Preview" icon={Mail}>
        <p className="mb-4 text-xs text-[#7b6660]">
          Live preview using sample customer and invoice information. Nothing is sent from this preview.
        </p>
        <div className="overflow-hidden rounded-xl border border-[#ead3cc] bg-white">
          <div className="border-b border-[#ead3cc] bg-[#fff8f5] px-5 py-4">
            <div className="grid gap-2 text-xs sm:grid-cols-[90px_minmax(0,1fr)]">
              <span className="font-bold uppercase tracking-wide text-[#7b6660]">From</span>
              <span className="font-semibold text-[#251E1F]">{form.senderName || "Sender name not set"}</span>
              <span className="font-bold uppercase tracking-wide text-[#7b6660]">Reply-to</span>
              <span className="font-semibold text-[#251E1F]">{form.replyToEmail || "Reply-to email not set"}</span>
              <span className="font-bold uppercase tracking-wide text-[#7b6660]">Subject</span>
              <span className="font-bold text-[#251E1F]">{previewSubject || "Subject template is empty"}</span>
            </div>
          </div>
          <div className="px-5 py-6">
            <h4 className="text-xl font-bold text-[#251E1F]">{previewValues.company_name}</h4>
            <div className="mt-2 h-1 w-10 rounded-full bg-[#F38978]" />
            <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-[#514440]">
              {previewBody || "Email body template is empty"}
            </p>
            <div className="mt-6 inline-flex rounded-lg bg-[#F38978] px-4 py-2.5 text-sm font-bold text-white">
              View &amp; Pay Invoice
            </div>
            <div className="mt-6 border-t border-[#ead3cc] pt-4 text-xs text-[#7b6660]">
              {form.supportEmail || form.financeEmail || "Support contact not set"}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-[#6f5b55]">
          <span className="rounded-full bg-[#fff1ec] px-3 py-1.5">
            PDF attachment: {form.attachPdfInvoice !== false ? "Included" : "Not included"}
          </span>
          <span className="rounded-full bg-[#fff1ec] px-3 py-1.5">
            Sample due date: {previewValues.due_date}
          </span>
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
  configurationStatus,
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
        <ConfigurationStatusPanel
          sections={sectionStates}
          currentTab={currentTab}
          routePrefix={routePrefix}
          configurationStatus={configurationStatus}
        />
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
  const [configurationStatus, setConfigurationStatus] = useState(emptyConfigurationStatus);
  const [numberingActivity, setNumberingActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState([]);
  const [placeholderAlertErrors, setPlaceholderAlertErrors] = useState([]);

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
    const savedStatus = configurationStatus.categories?.[tab.slug];
    const status = !validation.valid
      ? "needs-attention"
      : dirty
        ? "unsaved"
        : savedStatus === "completed"
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
    configurationStatus,
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
      setConfigurationStatus(data.configurationStatus || emptyConfigurationStatus);
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
    if (!form.invoicePrefix) nextErrors.push("Invoice prefix is required.");
    if (!/^\d{4}$/.test(String(form.invoiceYear || ""))) nextErrors.push("Enter a valid four-digit invoice year.");
    if (!form.separatorStyle) nextErrors.push("Separator style is required.");
    if (!form.invoiceFormat) nextErrors.push("Invoice format is required.");
    if (!Number.isInteger(Number(form.nextInvoiceNumber)) || Number(form.nextInvoiceNumber) < 1) {
      nextErrors.push("Next invoice number must be 1 or higher.");
    }
    nextErrors.push(...validateEmailTemplatePlaceholders(
      form.emailSubjectTemplate,
      form.emailBodyTemplate
    ));
    for (const section of sectionStates.filter((item) => !item.valid)) {
      if (!nextErrors.includes(section.note)) nextErrors.push(section.note);
    }
    return nextErrors;
  }

  async function handleSave(event) {
    event.preventDefault();
    setMessage("");
    const nextErrors = validateForm();
    const nextPlaceholderErrors = validateEmailTemplatePlaceholders(
      form.emailSubjectTemplate,
      form.emailBodyTemplate
    );
    setErrors(nextErrors.filter((error) => !nextPlaceholderErrors.includes(error)));
    setPlaceholderAlertErrors(nextPlaceholderErrors);
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
      setConfigurationStatus(data.configurationStatus || emptyConfigurationStatus);
      setPlaceholderAlertErrors([]);
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
    setPlaceholderAlertErrors([]);
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
        <PlaceholderValidationDialog
          errors={placeholderAlertErrors}
          onClose={() => setPlaceholderAlertErrors([])}
        />
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
