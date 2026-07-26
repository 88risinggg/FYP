/**
 * Invoice Settings Model
 *
 * Global invoice configuration stored as a JSON blob in the invoice table
 * (special row with invoiceId = '__SETTINGS__').
 */

const { pool } = require("../config/db");
const {
  getEffectiveGstRate,
  getNextScheduledGstRate,
  gstRateToOption,
  gstRateToSettings,
  listGstRates
} = require("./invoiceGstRateModel");

const SETTINGS_ROW_ID = "__SETTINGS__";

const currencyMeta = {
  SGD: { symbol: "S$", locale: "en-SG" },
  USD: { symbol: "$", locale: "en-US" },
  MYR: { symbol: "RM", locale: "ms-MY" }
};

const missingInvoiceSettingsMessage =
  "Invoice settings row is missing from the invoice table. Run the setup script to create the __SETTINGS__ row.";

const optionLists = {
  currencies: [
    { value: "SGD", label: "SGD - Singapore Dollar" },
    { value: "USD", label: "USD - US Dollar" },
    { value: "MYR", label: "MYR - Malaysian Ringgit" }
  ],
  languages: [
    { value: "en", label: "English" }
  ],
  taxes: [
    { value: "GST_9", label: "GST (9%)", rate: 9, type: "GST" },
    { value: "NONE", label: "No Tax", rate: 0, type: "None" }
  ],
  priceDisplayOptions: [
    { value: "tax_exclusive", label: "Tax Exclusive" },
    { value: "tax_inclusive", label: "Tax Inclusive" }
  ],
  paymentTerms: [
    { value: "Net 7", label: "Net 7" },
    { value: "Net 14", label: "Net 14" },
    { value: "Net 30", label: "Net 30" },
    { value: "Due on Receipt", label: "Due on Receipt" }
  ],
  lateFeeTypes: [{ value: "percent", label: "%" }],
  separatorStyles: [
    { value: "hyphen", label: "Hyphen (-)" },
    { value: "slash", label: "Slash (/)" },
    { value: "none", label: "No separator" }
  ],
  invoiceFormats: [
    { value: "{PREFIX}-{YYYY}-{NNNN}", label: "{PREFIX}-{YYYY}-{NNNN}" },
    { value: "{PREFIX}/{YYYY}/{NNNN}", label: "{PREFIX}/{YYYY}/{NNNN}" },
    { value: "{PREFIX}{YYYY}{NNNN}", label: "{PREFIX}{YYYY}{NNNN}" },
    { value: "{PREFIX}-{YY}-{NNNN}", label: "{PREFIX}-{YY}-{NNNN}" },
    { value: "{YYYY}-{PREFIX}-{NNNN}", label: "{YYYY}-{PREFIX}-{NNNN}" }
  ]
};

const invoiceStatusWorkflow = [
  { from: "Draft", to: "Sent" },
  { from: "Draft", to: "Scheduled" },
  { from: "Scheduled", to: "Sent" },
  { from: "Sent", to: "Viewed" },
  { from: "Viewed", to: "Paid" },
  { from: "Sent", to: "Overdue" },
  { from: "Viewed", to: "Overdue" },
  { from: "Sent", to: "Pending Review" },
  { from: "Viewed", to: "Pending Review" },
  { from: "Overdue", to: "Pending Review" },
  { from: "Pending Review", to: "Paid" },
  { from: "Pending Review", to: "Sent" }
];

const defaultSettings = {
  invoicePrefix: "INV",
  invoiceYear: String(new Date().getFullYear()),
  lastSequenceYear: String(new Date().getFullYear()),
  separatorStyle: "hyphen",
  invoiceFormat: "{PREFIX}-{YYYY}-{NNNN}",
  nextInvoiceNumber: 1,
  numberingStyle: "PREFIX-DATE-NUMBER",
  dateFormat: "YYYYMM",
  defaultCurrency: "SGD",
  taxType: "GST",
  defaultTaxRate: 9,
  pricesIncludeTax: false,
  paymentTerms: "Net 30",
  dueDays: 30,
  lateFeePercent: 0,
  gracePeriodDays: 0,
  companyName: "PayNivo",
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
  paymentReferenceInstruction: "Please include your invoice number and salon name as reference for electronic payments.",
  payoutStatement: "We will payout within 10 days from Invoice Date.",
  computerGeneratedStatement: "This is a computer generated invoice and therefore no signature is required.",
  senderName: "",
  replyToEmail: "",
  emailSubjectTemplate: "Invoice {{invoice_number}} from {{company_name}}",
  emailBodyTemplate: "Dear {{customer_name}},\n\nYour invoice {{invoice_number}} for {{amount_due}} is due on {{due_date}}.\n\nThank you,\n{{company_name}}",
  attachPdfInvoice: true,
  footerNote: "Thank you for your business.",
  templateName: "Default Template",
  templateDescription: "",
  uenNumber: "",
  gstRegistrationNumber: "",
  companyPhone: "",
  companyEmail: "",
  companyWebsite: "",
  primaryColor: "#061e4b",
  secondaryColor: "#ff5a52",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSizeBase: 12,
  invoiceBorderStyle: "modern",
  headerStyle: "default",
  footerStyle: "default",
  itemTableStyle: "striped",
  currencySymbol: "S$",
  currencyFormat: "symbol_before",
  displayDateFormat: "DD MMM YYYY",
  displayTimeFormat: "HH:mm",
  decimalPrecision: 2,
  runningNumber: 1,
  resetNumberYearly: true,
  invoiceDateSource: "issue_date",
  taxEnabled: true,
  taxName: "GST",
  taxPercentage: 9,
  taxInclusive: false,
  defaultDiscount: 0,
  defaultNotes: "",
  termsAndConditions: "",
  qrCodeDisplay: true,
  bankDetailsDisplay: true,
  paynowDisplay: true,
  signatureDisplay: false,
  watermarkEnabled: true,
  statusBadgeStyle: "ribbon",
  companyStampUrl: "",
  signatureUrl: "",
  pdfPageSize: "A4",
  pdfOrientation: "portrait",
  vanidayFieldMapping: null,
  general: {
    defaultCurrency: "SGD",
    defaultLanguage: "en",
    defaultTax: "GST_9",
    priceDisplay: "tax_exclusive",
    paymentTerms: "Net 30",
    lateFeeValue: 0,
    lateFeeType: "percent",
    onlineViewLinkEnabled: true,
    whatsappNotificationsEnabled: true
  },
  export: {
    pdfExportEnabled: true,
    excelExportEnabled: true,
    pdfPaperSize: "A4",
    excelFormat: "xlsx"
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

// ─── Helper Functions ────────────────────────────────────────────────────────

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function boolValue(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  return value === true || value === 1 || value === "1";
}

function normalizeInvoiceYear(value) {
  const cleanValue = String(value || "").replace(/\D/g, "");
  return cleanValue || String(new Date().getFullYear());
}

function numberToken(value) {
  return String(numberValue(value, defaultSettings.nextInvoiceNumber)).padStart(4, "0");
}

function invoiceYearTokens(settings, date = new Date()) {
  const parsedDate = new Date(date);
  const issueYear = Number.isNaN(parsedDate.getTime())
    ? String(new Date().getFullYear())
    : String(parsedDate.getFullYear());
  const fullYear = settings.sequenceRules?.yearlyReset
    ? issueYear
    : normalizeInvoiceYear(settings.invoiceYear || issueYear);
  return { YYYY: fullYear, YY: fullYear.slice(-2) };
}

function buildInvoiceNumber(settings, date = new Date(), nextNumber = settings?.nextInvoiceNumber) {
  const prefix = settings.invoicePrefix || "INV";
  const { YYYY, YY } = invoiceYearTokens(settings, date);
  const format = settings.invoiceFormat || defaultSettings.invoiceFormat;
  const invoiceNumber = numberToken(nextNumber);

  return format
    .replaceAll("{PREFIX}", prefix)
    .replaceAll("{YYYY}", YYYY)
    .replaceAll("{YY}", YY)
    .replaceAll("{NNNN}", invoiceNumber);
}

function resolveInvoiceSequence(settings, date = new Date()) {
  const parsedDate = new Date(date);
  const issueYear = Number.isNaN(parsedDate.getTime())
    ? String(new Date().getFullYear())
    : String(parsedDate.getFullYear());
  const trackedYear = normalizeInvoiceYear(
    settings.lastSequenceYear || settings.invoiceYear || issueYear
  );
  const yearlyReset = settings.sequenceRules?.yearlyReset === true;
  const didReset = yearlyReset && Number(issueYear) > Number(trackedYear);
  const nextTrackedYear = yearlyReset
    ? String(Math.max(Number(issueYear), Number(trackedYear)))
    : trackedYear;

  return {
    didReset,
    issueYear,
    nextTrackedYear,
    previousYear: trackedYear,
    previousNextNumber: Math.max(1, Number(settings.nextInvoiceNumber) || 1),
    startNumber: didReset ? 1 : Math.max(1, Number(settings.nextInvoiceNumber) || 1),
    effectiveSettings: {
      ...settings,
      invoiceYear: yearlyReset ? issueYear : settings.invoiceYear
    }
  };
}

function calculateDueDate(settings, issueDate = new Date()) {
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + derivePaymentTermDays(settings));
  return dueDate.toISOString().slice(0, 10);
}

function derivePaymentTermDays(settings, fallbackDays = defaultSettings.dueDays) {
  const term = String(settings?.general?.paymentTerms || settings?.paymentTerms || "").trim();

  if (/^(due\s+on\s+receipt|immediate|payable\s+on\s+receipt)$/i.test(term)) {
    return 0;
  }

  const netMatch = term.match(/\bnet\s*(\d{1,4})\b/i);
  const dayMatch = term.match(/\b(\d{1,4})\s*(?:calendar\s*)?(?:business\s*)?days?\b/i);
  const parsedDays = Number(netMatch?.[1] || dayMatch?.[1]);

  if (Number.isInteger(parsedDays) && parsedDays >= 0) {
    return parsedDays;
  }

  return Number(fallbackDays) || defaultSettings.dueDays;
}

function toCurrencyNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Number(numberValue.toFixed(2)) : 0;
}

function calculateInvoiceLateFee(invoice, settings, asOf = new Date()) {
  const status = String(invoice?.status || "");
  const dueDate = invoice?.due_date || invoice?.dueDate;
  const isClosed = ["Paid", "Void", "Cancelled", "Refunded"].includes(status);
  const parsedDueDate = dueDate ? new Date(dueDate) : null;
  if (parsedDueDate) parsedDueDate.setHours(23, 59, 59, 999);
  const dueTimestamp = parsedDueDate ? parsedDueDate.getTime() : Number.NaN;

  if (isClosed || Number.isNaN(dueTimestamp) || new Date(asOf).getTime() <= dueTimestamp) {
    return { lateFeeRate: 0, lateFeeAmount: 0, amountDue: toCurrencyNumber(invoice?.total_amount) };
  }

  const rate = Number(settings?.general?.lateFeeValue ?? settings?.lateFeePercent ?? 0);
  const baseAmount = toCurrencyNumber(invoice?.total_amount);
  const lateFeeAmount = rate > 0 ? toCurrencyNumber(baseAmount * (rate / 100)) : 0;

  return {
    lateFeeRate: rate > 0 ? rate : 0,
    lateFeeAmount,
    amountDue: toCurrencyNumber(baseAmount + lateFeeAmount)
  };
}

function calculateConfigurationStatus(settings) {
  const hasValue = (value) => String(value ?? "").trim() !== "";
  const hasValidYear = /^\d{4}$/.test(String(settings?.invoiceYear || ""));
  const hasValidNextNumber = Number.isInteger(Number(settings?.nextInvoiceNumber)) && Number(settings?.nextInvoiceNumber) >= 1;
  const hasValidLateFee = settings?.general?.lateFeeValue !== "" && Number(settings?.general?.lateFeeValue) >= 0;

  const status = {
    general:
      hasValue(settings?.general?.defaultCurrency) &&
      hasValue(settings?.general?.defaultLanguage) &&
      hasValue(settings?.general?.defaultTax) &&
      hasValue(settings?.general?.priceDisplay) &&
      hasValue(settings?.general?.paymentTerms) &&
      hasValidLateFee &&
      hasValue(settings?.companyName) &&
      hasValue(settings?.financeEmail)
        ? "completed"
        : "incomplete",
    numbering:
      hasValue(settings?.invoicePrefix) &&
      hasValidYear &&
      hasValue(settings?.separatorStyle) &&
      hasValue(settings?.invoiceFormat) &&
      hasValidNextNumber
        ? "completed"
        : "incomplete",
    email:
      hasValue(settings?.senderName) &&
      hasValue(settings?.replyToEmail) &&
      hasValue(settings?.supportEmail) &&
      hasValue(settings?.emailSubjectTemplate) &&
      hasValue(settings?.emailBodyTemplate)
        ? "completed"
        : "incomplete",
    payments:
      hasValue(settings?.bankAccountHolderName) &&
      hasValue(settings?.bankName) &&
      hasValue(settings?.bankAccountNumber) &&
      hasValue(settings?.bicSwift) &&
      hasValue(settings?.paynowIdentifier) &&
      hasValue(settings?.paymentReferenceInstruction)
        ? "completed"
        : "incomplete"
  };
  const completedCount = Object.values(status).filter((v) => v === "completed").length;
  return {
    categories: status,
    completionPercentage: Math.round((completedCount / Object.keys(status).length) * 100)
  };
}

// ─── Read settings from __SETTINGS__ row ─────────────────────────────────────

function parseSettingsJson(jsonValue) {
  if (!jsonValue) return null;
  let raw;
  if (typeof jsonValue === "string") {
    try { raw = JSON.parse(jsonValue); } catch { return null; }
  } else {
    raw = jsonValue;
  }
  // The raw object may be the old DB row format or the app format
  // Map it to the app format
  return mapRawToSettings(raw);
}

function mapRawToSettings(raw) {
  if (!raw) return null;

  // If it's already in app format (has invoicePrefix key), return enriched
  if (raw.invoicePrefix !== undefined) {
    const settings = {
      ...defaultSettings,
      ...raw,
      lastSequenceYear: normalizeInvoiceYear(
        raw.lastSequenceYear || raw.invoiceYear || defaultSettings.lastSequenceYear
      ),
      defaultLanguage: "en",
      general: {
        ...defaultSettings.general,
        ...(raw.general || {}),
        defaultLanguage: "en"
      },
      export: {
        pdfExportEnabled: true,
        excelExportEnabled: true,
        pdfPaperSize: "A4",
        excelFormat: "xlsx"
      }
    };
    return {
      ...settings,
      previewInvoiceNumber: buildInvoiceNumber(settings),
      sampleDueDate: calculateDueDate(settings)
    };
  }

  // Otherwise it's in old DB column format (snake_case), map it
  const settings = {
    settingId: raw.setting_id,
    invoicePrefix: raw.invoice_prefix || defaultSettings.invoicePrefix,
    invoiceYear: normalizeInvoiceYear(raw.invoice_year || defaultSettings.invoiceYear),
    lastSequenceYear: normalizeInvoiceYear(raw.invoice_year || defaultSettings.lastSequenceYear),
    separatorStyle: raw.separator_style || defaultSettings.separatorStyle,
    invoiceFormat: raw.invoice_format || defaultSettings.invoiceFormat,
    nextInvoiceNumber: numberValue(raw.next_invoice_number, defaultSettings.nextInvoiceNumber),
    numberingStyle: raw.numbering_style || defaultSettings.numberingStyle,
    dateFormat: raw.date_format || defaultSettings.dateFormat,
    defaultCurrency: raw.default_currency || defaultSettings.defaultCurrency,
    taxType: raw.tax_type || defaultSettings.taxType,
    defaultTaxRate: numberValue(raw.default_tax_rate, defaultSettings.defaultTaxRate),
    pricesIncludeTax: boolValue(raw.prices_include_tax, defaultSettings.pricesIncludeTax),
    paymentTerms: raw.payment_terms || defaultSettings.paymentTerms,
    dueDays: numberValue(raw.due_days, defaultSettings.dueDays),
    lateFeePercent: numberValue(raw.late_fee_percent, defaultSettings.lateFeePercent),
    gracePeriodDays: numberValue(raw.grace_period_days, defaultSettings.gracePeriodDays),
    companyName: raw.company_name || "",
    companyRegistrationNumber: raw.company_registration_number || "",
    companyAddress: raw.company_address || "",
    registeredOfficeAddress: raw.registered_office_address || "",
    financeEmail: raw.finance_email || "",
    supportEmail: raw.support_email || "",
    bankAccountHolderName: raw.bank_account_holder_name || "",
    bankName: raw.bank_name || "",
    bankAccountNumber: raw.bank_account_number || "",
    bicSwift: raw.bic_swift || "",
    paynowIdentifier: raw.paynow_identifier || "",
    paymentReferenceInstruction: raw.payment_reference_instruction || defaultSettings.paymentReferenceInstruction,
    payoutStatement: raw.payout_statement || defaultSettings.payoutStatement,
    computerGeneratedStatement: raw.computer_generated_statement || defaultSettings.computerGeneratedStatement,
    senderName: raw.sender_name || "",
    replyToEmail: raw.reply_to_email || "",
    emailSubjectTemplate: raw.email_subject_template || defaultSettings.emailSubjectTemplate,
    emailBodyTemplate: raw.email_body_template || defaultSettings.emailBodyTemplate,
    attachPdfInvoice: boolValue(raw.attach_pdf_invoice, defaultSettings.attachPdfInvoice),
    footerNote: raw.footer_note || defaultSettings.footerNote,
    templateName: raw.template_name || defaultSettings.templateName,
    templateDescription: raw.template_description || defaultSettings.templateDescription,
    uenNumber: raw.uen_number || defaultSettings.uenNumber,
    gstRegistrationNumber: raw.gst_registration_number || defaultSettings.gstRegistrationNumber,
    companyPhone: raw.company_phone || defaultSettings.companyPhone,
    companyEmail: raw.company_email || defaultSettings.companyEmail,
    companyWebsite: raw.company_website || defaultSettings.companyWebsite,
    primaryColor: raw.primary_color || defaultSettings.primaryColor,
    secondaryColor: raw.secondary_color || defaultSettings.secondaryColor,
    fontFamily: raw.font_family || defaultSettings.fontFamily,
    fontSizeBase: numberValue(raw.font_size_base, defaultSettings.fontSizeBase),
    invoiceBorderStyle: raw.invoice_border_style || defaultSettings.invoiceBorderStyle,
    headerStyle: raw.header_style || defaultSettings.headerStyle,
    footerStyle: raw.footer_style || defaultSettings.footerStyle,
    itemTableStyle: raw.item_table_style || defaultSettings.itemTableStyle,
    currencySymbol: raw.currency_symbol || defaultSettings.currencySymbol,
    currencyFormat: raw.currency_format || defaultSettings.currencyFormat,
    displayDateFormat: raw.display_date_format || defaultSettings.displayDateFormat,
    displayTimeFormat: raw.display_time_format || defaultSettings.displayTimeFormat,
    decimalPrecision: numberValue(raw.decimal_precision, defaultSettings.decimalPrecision),
    runningNumber: numberValue(raw.running_number, defaultSettings.runningNumber),
    resetNumberYearly: boolValue(raw.reset_number_yearly, defaultSettings.resetNumberYearly),
    invoiceDateSource: raw.invoice_date_source || defaultSettings.invoiceDateSource,
    taxEnabled: boolValue(raw.tax_enabled, defaultSettings.taxEnabled),
    taxName: raw.tax_name || defaultSettings.taxName,
    taxPercentage: numberValue(raw.tax_percentage, defaultSettings.taxPercentage),
    taxInclusive: boolValue(raw.tax_inclusive, defaultSettings.taxInclusive),
    defaultDiscount: numberValue(raw.default_discount, defaultSettings.defaultDiscount),
    defaultNotes: raw.default_notes || defaultSettings.defaultNotes,
    termsAndConditions: raw.terms_and_conditions || defaultSettings.termsAndConditions,
    qrCodeDisplay: boolValue(raw.qr_code_display, defaultSettings.qrCodeDisplay),
    bankDetailsDisplay: boolValue(raw.bank_details_display, defaultSettings.bankDetailsDisplay),
    paynowDisplay: boolValue(raw.paynow_display, defaultSettings.paynowDisplay),
    signatureDisplay: boolValue(raw.signature_display, defaultSettings.signatureDisplay),
    watermarkEnabled: boolValue(raw.watermark_enabled, defaultSettings.watermarkEnabled),
    statusBadgeStyle: raw.status_badge_style || defaultSettings.statusBadgeStyle,
    companyStampUrl: raw.company_stamp_url || defaultSettings.companyStampUrl,
    signatureUrl: raw.signature_url || defaultSettings.signatureUrl,
    pdfPageSize: raw.pdf_page_size || raw.pdf_paper_size || defaultSettings.pdfPageSize,
    pdfOrientation: raw.pdf_orientation || defaultSettings.pdfOrientation,
    vanidayFieldMapping: raw.vaniday_field_mapping || defaultSettings.vanidayFieldMapping,
    general: {
      defaultCurrency: raw.default_currency || defaultSettings.general.defaultCurrency,
      defaultLanguage: "en",
      defaultTax: raw.default_tax || defaultSettings.general.defaultTax,
      priceDisplay: raw.price_display || defaultSettings.general.priceDisplay,
      paymentTerms: raw.payment_terms || defaultSettings.general.paymentTerms,
      lateFeeValue: numberValue(raw.late_fee_percent, defaultSettings.general.lateFeeValue),
      lateFeeType: raw.late_fee_type || defaultSettings.general.lateFeeType,
      onlineViewLinkEnabled: true,
      whatsappNotificationsEnabled: true
    },
    export: {
      pdfExportEnabled: true,
      excelExportEnabled: true,
      pdfPaperSize: "A4",
      excelFormat: "xlsx"
    },
    branding: {
      companyLogoUrl: raw.company_logo_url || "",
      brandColor: raw.brand_color || defaultSettings.branding.brandColor,
      showCompanyDetailsOnInvoice: true
    },
    sequenceRules: {
      yearlyReset: boolValue(raw.yearly_reset_enabled, defaultSettings.sequenceRules.yearlyReset),
      allowManualOverride: boolValue(raw.manual_override_enabled, defaultSettings.sequenceRules.allowManualOverride),
      lockNumberingAfterSent: boolValue(raw.lock_numbering_after_sent, defaultSettings.sequenceRules.lockNumberingAfterSent),
      preventDuplicateNumbers: boolValue(raw.prevent_duplicate_numbers, defaultSettings.sequenceRules.preventDuplicateNumbers)
    }
  };

  return {
    ...settings,
    previewInvoiceNumber: buildInvoiceNumber(settings),
    sampleDueDate: calculateDueDate(settings)
  };
}

function applyGeneralSettings(settings) {
  const general = settings.general || {};
  const defaultCurrency = general.defaultCurrency || settings.defaultCurrency || defaultSettings.defaultCurrency;
  const priceDisplay = general.priceDisplay || defaultSettings.general.priceDisplay;
  const paymentTerms = general.paymentTerms || settings.paymentTerms || defaultSettings.general.paymentTerms;
  const dueDays = derivePaymentTermDays({ ...settings, general: { ...general, paymentTerms } });
  const lateFeeValue = Number(general.lateFeeValue ?? settings.lateFeePercent ?? defaultSettings.general.lateFeeValue);
  const meta = currencyMeta[defaultCurrency] || currencyMeta.SGD;

  return {
    ...settings,
    defaultCurrency,
    defaultLanguage: "en",
    paymentTerms,
    dueDays,
    lateFeePercent: Number.isFinite(lateFeeValue) ? lateFeeValue : defaultSettings.general.lateFeeValue,
    currencySymbol: meta.symbol,
    currencyLocale: meta.locale,
    pricesIncludeTax: priceDisplay === "tax_inclusive",
    taxInclusive: priceDisplay === "tax_inclusive",
    general: {
      ...general,
      defaultCurrency,
      defaultLanguage: "en",
      paymentTerms,
      lateFeeValue: Number.isFinite(lateFeeValue) ? lateFeeValue : defaultSettings.general.lateFeeValue,
      onlineViewLinkEnabled: true,
      whatsappNotificationsEnabled: true,
      priceDisplay
    }
  };
}

async function applyEffectiveGst(settings, companyId = null, asOf = new Date()) {
  const baseSettings = applyGeneralSettings(settings);
  const [currentGstRate, nextScheduledGstRate] = await Promise.all([
    getEffectiveGstRate(companyId, asOf),
    getNextScheduledGstRate(companyId, asOf)
  ]);
  const gstSettings = gstRateToSettings(currentGstRate);

  return {
    ...baseSettings,
    ...gstSettings,
    currentGstRate,
    nextScheduledGstRate,
    general: {
      ...baseSettings.general,
      ...gstSettings.general
    }
  };
}

async function getInvoiceSettingsOptions(companyId = null) {
  const rates = await listGstRates(companyId);
  const taxOptions = rates.map(gstRateToOption);
  return {
    ...optionLists,
    taxes: taxOptions.length > 0
      ? taxOptions
      : optionLists.taxes
  };
}

// ─── DB Operations ───────────────────────────────────────────────────────────

async function getInvoiceSettings(companyId = null) {
  const companySql = companyId ? " AND company_id = ?" : "";
  const params = companyId ? [SETTINGS_ROW_ID, companyId] : [SETTINGS_ROW_ID];
  const [rows] = await pool.execute(
    `SELECT items_json, created_at FROM invoice WHERE invoiceId = ?${companySql} LIMIT 1`,
    params
  );

  if (!rows[0] || !rows[0].items_json) {
    return applyEffectiveGst(
      { ...defaultSettings, previewInvoiceNumber: buildInvoiceNumber(defaultSettings), sampleDueDate: calculateDueDate(defaultSettings) },
      companyId
    );
  }

  const storedSettings = parseSettingsJson(rows[0].items_json);
  return applyEffectiveGst({
    ...storedSettings,
    updatedAt: storedSettings.updatedAt || rows[0].created_at || null
  }, companyId);
}

async function getInvoiceSettingsForUpdate(connection, companyId = null) {
  const companySql = companyId ? " AND company_id = ?" : "";
  const params = companyId ? [SETTINGS_ROW_ID, companyId] : [SETTINGS_ROW_ID];
  const [rows] = await connection.execute(
    `SELECT invoice_id, items_json, created_at FROM invoice WHERE invoiceId = ?${companySql} LIMIT 1 FOR UPDATE`,
    params
  );

  if (rows[0] && rows[0].items_json) {
    const storedSettings = parseSettingsJson(rows[0].items_json);
    return applyEffectiveGst({
      ...storedSettings,
      updatedAt: storedSettings.updatedAt || rows[0].created_at || null
    }, companyId);
  }

  // Create the settings row if it doesn't exist
  const settingsJson = JSON.stringify(defaultSettings);
  await connection.execute(
    "INSERT INTO invoice (invoiceId, status, issue_date, due_date, total_amount, customer_id, company_id, items_json, created_at) VALUES (?, 'Draft', '1970-01-01', '1970-01-01', 0, NULL, ?, ?, NOW())",
    [SETTINGS_ROW_ID, companyId, settingsJson]
  );
  return applyEffectiveGst(
    { ...defaultSettings, previewInvoiceNumber: buildInvoiceNumber(defaultSettings), sampleDueDate: calculateDueDate(defaultSettings) },
    companyId
  );
}

async function saveInvoiceSettings(settings, companyId = null) {
  const effectiveGst = await getEffectiveGstRate(companyId);
  const gstSettings = gstRateToSettings(effectiveGst);
  const toSave = {
    ...defaultSettings,
    ...applyGeneralSettings(settings),
    ...gstSettings,
    updatedAt: new Date().toISOString(),
    general: {
      ...defaultSettings.general,
      ...(applyGeneralSettings(settings).general || {}),
      ...gstSettings.general
    }
  };
  // Remove computed fields before saving
  delete toSave.previewInvoiceNumber;
  delete toSave.sampleDueDate;
  delete toSave.currentGstRate;
  delete toSave.nextScheduledGstRate;

  const settingsJson = JSON.stringify(toSave);

  const companySql = companyId ? " AND company_id = ?" : "";
  const params = companyId ? [SETTINGS_ROW_ID, companyId] : [SETTINGS_ROW_ID];
  const [existing] = await pool.execute(
    `SELECT invoice_id FROM invoice WHERE invoiceId = ?${companySql} LIMIT 1`,
    params
  );

  if (existing.length > 0) {
    await pool.execute(
      `UPDATE invoice SET items_json = ? WHERE invoiceId = ?${companySql}`,
      companyId ? [settingsJson, SETTINGS_ROW_ID, companyId] : [settingsJson, SETTINGS_ROW_ID]
    );
  } else {
    await pool.execute(
      "INSERT INTO invoice (invoiceId, status, issue_date, due_date, total_amount, customer_id, company_id, items_json, created_at) VALUES (?, 'Draft', '1970-01-01', '1970-01-01', 0, NULL, ?, ?, NOW())",
      [SETTINGS_ROW_ID, companyId, settingsJson]
    );
  }

  return getInvoiceSettings(companyId);
}

async function nextAvailableInvoiceNumber(connection, settings, date = new Date(), companyId = null) {
  const sequenceState = resolveInvoiceSequence(settings, date);
  let sequence = sequenceState.startNumber;

  for (let attempt = 0; attempt < 10000; attempt += 1) {
    const invoiceId = buildInvoiceNumber(sequenceState.effectiveSettings, date, sequence);
    const companySql = companyId ? " AND company_id = ?" : "";
    const params = companyId ? [invoiceId, companyId] : [invoiceId];
    const [rows] = await connection.execute(
      `SELECT invoice_id FROM invoice WHERE invoiceId = ?${companySql} LIMIT 1`,
      params
    );
    if (!rows.length) return { invoiceId, sequence, ...sequenceState };
    sequence += 1;
  }

  throw new Error("Unable to find an available invoice number.");
}

async function previewNextInvoiceNumber(date = new Date(), companyId = null) {
  const settings = (await getInvoiceSettings(companyId)) || defaultSettings;
  const result = await nextAvailableInvoiceNumber(pool, settings, date, companyId);
  return { ...result, settings };
}

async function reserveNextInvoiceNumber(connection, date = new Date(), companyId = null) {
  const settings = await getInvoiceSettingsForUpdate(connection, companyId);
  const result = await nextAvailableInvoiceNumber(connection, settings, date, companyId);

  // Update nextInvoiceNumber in the settings JSON
  const updatedSettings = {
    ...settings,
    invoiceYear: result.nextTrackedYear,
    lastSequenceYear: result.nextTrackedYear,
    nextInvoiceNumber: result.sequence + 1
  };
  delete updatedSettings.previewInvoiceNumber;
  delete updatedSettings.sampleDueDate;
  delete updatedSettings.currentGstRate;
  delete updatedSettings.nextScheduledGstRate;

  await connection.execute(
    `UPDATE invoice SET items_json = ? WHERE invoiceId = ?${companyId ? " AND company_id = ?" : ""}`,
    companyId ? [JSON.stringify(updatedSettings), SETTINGS_ROW_ID, companyId] : [JSON.stringify(updatedSettings), SETTINGS_ROW_ID]
  );

  if (result.didReset) {
    await addNumberingActivity([{
      action: "Automatic Yearly Reset",
      oldValue: `${result.previousYear} / next ${result.previousNextNumber}`,
      newValue: `${result.issueYear} / started at ${result.sequence}`,
      changedBy: "System"
    }], companyId, connection);
  }

  return { ...result, settings: updatedSettings };
}

async function updateInvoiceLogo(companyLogoUrl, companyId = null) {
  const current = await getInvoiceSettings(companyId);
  const settings = current || defaultSettings;

  return saveInvoiceSettings({
    ...settings,
    branding: {
      ...settings.branding,
      companyLogoUrl
    }
  }, companyId);
}

async function addNumberingActivity(records = [], companyId = null, connection = null) {
  if (!records.length) return [];
  const db = connection && typeof connection.query === "function" ? connection : pool;

  // Store numbering activity in audit_logs
  for (const record of records) {
    await db.query(
      `INSERT INTO audit_logs
        (company_id, module, activity_type, action_description, affected_record, status,
         previous_value, new_value, user_name, entity_type, created_at)
       VALUES (?, 'Invoice', 'invoice_numbering', ?, ?, 'Success', ?, ?, ?, 'invoice_settings', NOW())`,
      [
        companyId || null,
        record.action,
        record.settingId ? String(record.settingId) : null,
        record.oldValue ?? "",
        record.newValue ?? "",
        record.changedBy || "Admin"
      ]
    );
  }

  return records;
}

async function listNumberingActivity(limit = 20, companyId = null) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const companyFilter = companyId ? "AND company_id = ?" : "AND company_id IS NULL";
  const params = companyId ? [companyId] : [];

  const [rows] = await pool.execute(
    `SELECT
      audit_log_id AS id,
      NULL AS settingId,
      action_description AS action,
      previous_value AS oldValue,
      new_value AS newValue,
      user_name AS changedBy,
       created_at AS createdAt
     FROM audit_logs
     WHERE activity_type = 'invoice_numbering'
       ${companyFilter}
     ORDER BY created_at DESC, audit_log_id DESC
     LIMIT ${safeLimit}`,
    params
  );

  return rows;
}

async function listNumberingActivityPage(options = {}, companyId = null) {
  const page = Math.max(1, Number.parseInt(options.page, 10) || 1);
  const pageSize = Math.max(5, Math.min(Number.parseInt(options.pageSize, 10) || 20, 100));
  const offset = (page - 1) * pageSize;
  const companyFilter = companyId ? "AND company_id = ?" : "AND company_id IS NULL";
  const params = companyId ? [companyId] : [];

  const [countResult, rowsResult] = await Promise.all([
    pool.execute(
      `SELECT COUNT(*) AS total
       FROM audit_logs
       WHERE activity_type = 'invoice_numbering'
         ${companyFilter}`,
      params
    ),
    pool.execute(
      `SELECT
        audit_log_id AS id,
        NULL AS settingId,
        action_description AS action,
        previous_value AS oldValue,
        new_value AS newValue,
        user_name AS changedBy,
        created_at AS createdAt
       FROM audit_logs
       WHERE activity_type = 'invoice_numbering'
         ${companyFilter}
       ORDER BY created_at DESC, audit_log_id DESC
       LIMIT ${pageSize} OFFSET ${offset}`,
      params
    )
  ]);

  const countRow = countResult[0]?.[0];
  const rows = rowsResult[0] || [];
  const total = Number(countRow?.total || 0);
  return {
    records: rows,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    }
  };
}

module.exports = {
  addNumberingActivity,
  buildInvoiceNumber,
  calculateConfigurationStatus,
  calculateDueDate,
  calculateInvoiceLateFee,
  defaultSettings,
  derivePaymentTermDays,
  getInvoiceSettingsOptions,
  getInvoiceSettings,
  getInvoiceSettingsForUpdate,
  invoiceStatusWorkflow,
  listNumberingActivity,
  listNumberingActivityPage,
  missingInvoiceSettingsMessage,
  optionLists,
  previewNextInvoiceNumber,
  resolveInvoiceSequence,
  reserveNextInvoiceNumber,
  saveInvoiceSettings,
  SETTINGS_ROW_ID,
  updateInvoiceLogo
};
