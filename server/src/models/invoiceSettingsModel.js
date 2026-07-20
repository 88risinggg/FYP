/**
 * Invoice Settings Model
 *
 * Global invoice configuration stored as a JSON blob in the invoice table
 * (special row with invoiceId = '__SETTINGS__').
 */

const { pool } = require("../config/db");

const SETTINGS_ROW_ID = "__SETTINGS__";

const missingInvoiceSettingsMessage =
  "Invoice settings row is missing from the invoice table. Run the setup script to create the __SETTINGS__ row.";

const optionLists = {
  currencies: [
    { value: "SGD", label: "SGD - Singapore Dollar" },
    { value: "USD", label: "USD - US Dollar" },
    { value: "MYR", label: "MYR - Malaysian Ringgit" }
  ],
  languages: [
    { value: "en", label: "English" },
    { value: "ms", label: "Malay" },
    { value: "zh", label: "Chinese" }
  ],
  taxes: [
    { value: "GST_9", label: "GST (9%)", rate: 9, type: "GST" },
    { value: "VAT_12", label: "VAT (12%)", rate: 12, type: "VAT" },
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
  pdfPaperSizes: [{ value: "A4", label: "A4 (fixed approved layout)" }],
  excelFormats: [{ value: "xlsx", label: ".xlsx" }],
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
    whatsappNotificationsEnabled: false
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
  const fullYear = normalizeInvoiceYear(settings.invoiceYear || date.getFullYear());
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

function calculateDueDate(settings, issueDate = new Date()) {
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + Number(settings.dueDays || 30));
  return dueDate.toISOString().slice(0, 10);
}

function calculateConfigurationStatus(settings) {
  const status = {
    general: settings?.general?.defaultCurrency && settings?.general?.defaultLanguage ? "completed" : "incomplete",
    numbering: settings?.invoicePrefix && settings?.nextInvoiceNumber ? "completed" : "incomplete",
    template: typeof settings?.branding?.showCompanyDetailsOnInvoice === "boolean" ? "completed" : "warning",
    email: settings?.general?.onlineViewLinkEnabled ? "completed" : "warning",
    reminders: settings?.general?.whatsappNotificationsEnabled ? "completed" : "warning",
    payments: "warning",
    automation: settings?.export?.pdfExportEnabled || settings?.export?.excelExportEnabled ? "completed" : "warning",
    bulkUpload: "incomplete"
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
    const settings = { ...defaultSettings, ...raw };
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
      defaultLanguage: raw.default_language || defaultSettings.general.defaultLanguage,
      defaultTax: raw.default_tax || defaultSettings.general.defaultTax,
      priceDisplay: raw.price_display || defaultSettings.general.priceDisplay,
      paymentTerms: raw.payment_terms || defaultSettings.general.paymentTerms,
      lateFeeValue: numberValue(raw.late_fee_percent, defaultSettings.general.lateFeeValue),
      lateFeeType: raw.late_fee_type || defaultSettings.general.lateFeeType,
      onlineViewLinkEnabled: boolValue(raw.online_view_link_enabled, defaultSettings.general.onlineViewLinkEnabled),
      whatsappNotificationsEnabled: boolValue(raw.whatsapp_notifications_enabled, defaultSettings.general.whatsappNotificationsEnabled)
    },
    export: {
      pdfExportEnabled: boolValue(raw.pdf_export_enabled, defaultSettings.export.pdfExportEnabled),
      excelExportEnabled: boolValue(raw.excel_export_enabled, defaultSettings.export.excelExportEnabled),
      pdfPaperSize: "A4",
      excelFormat: raw.excel_format || defaultSettings.export.excelFormat
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

// ─── DB Operations ───────────────────────────────────────────────────────────

async function getInvoiceSettings() {
  const [rows] = await pool.execute(
    "SELECT items_json FROM invoice WHERE invoiceId = ? LIMIT 1",
    [SETTINGS_ROW_ID]
  );

  if (!rows[0] || !rows[0].items_json) return { ...defaultSettings, previewInvoiceNumber: buildInvoiceNumber(defaultSettings), sampleDueDate: calculateDueDate(defaultSettings) };

  return parseSettingsJson(rows[0].items_json);
}

async function getInvoiceSettingsForUpdate(connection) {
  const [rows] = await connection.execute(
    "SELECT invoice_id, items_json FROM invoice WHERE invoiceId = ? LIMIT 1 FOR UPDATE",
    [SETTINGS_ROW_ID]
  );

  if (rows[0] && rows[0].items_json) {
    return parseSettingsJson(rows[0].items_json);
  }

  // Create the settings row if it doesn't exist
  const settingsJson = JSON.stringify(defaultSettings);
  await connection.execute(
    "INSERT INTO invoice (invoiceId, status, issue_date, due_date, total_amount, customer_id, items_json, created_at) VALUES (?, 'Draft', '1970-01-01', '1970-01-01', 0, NULL, ?, NOW())",
    [SETTINGS_ROW_ID, settingsJson]
  );
  return { ...defaultSettings, previewInvoiceNumber: buildInvoiceNumber(defaultSettings), sampleDueDate: calculateDueDate(defaultSettings) };
}

async function saveInvoiceSettings(settings) {
  const toSave = { ...defaultSettings, ...settings };
  // Remove computed fields before saving
  delete toSave.previewInvoiceNumber;
  delete toSave.sampleDueDate;

  const settingsJson = JSON.stringify(toSave);

  const [existing] = await pool.execute(
    "SELECT invoice_id FROM invoice WHERE invoiceId = ? LIMIT 1",
    [SETTINGS_ROW_ID]
  );

  if (existing.length > 0) {
    await pool.execute(
      "UPDATE invoice SET items_json = ? WHERE invoiceId = ?",
      [settingsJson, SETTINGS_ROW_ID]
    );
  } else {
    await pool.execute(
      "INSERT INTO invoice (invoiceId, status, issue_date, due_date, total_amount, customer_id, items_json, created_at) VALUES (?, 'Draft', '1970-01-01', '1970-01-01', 0, NULL, ?, NOW())",
      [SETTINGS_ROW_ID, settingsJson]
    );
  }

  return getInvoiceSettings();
}

async function nextAvailableInvoiceNumber(connection, settings, date = new Date()) {
  let sequence = Math.max(1, Number(settings.nextInvoiceNumber) || 1);

  for (let attempt = 0; attempt < 10000; attempt += 1) {
    const invoiceId = buildInvoiceNumber(settings, date, sequence);
    const [rows] = await connection.execute(
      "SELECT invoice_id FROM invoice WHERE invoiceId = ? LIMIT 1",
      [invoiceId]
    );
    if (!rows.length) return { invoiceId, sequence };
    sequence += 1;
  }

  throw new Error("Unable to find an available invoice number.");
}

async function previewNextInvoiceNumber(date = new Date()) {
  const settings = (await getInvoiceSettings()) || defaultSettings;
  const result = await nextAvailableInvoiceNumber(pool, settings, date);
  return { ...result, settings };
}

async function reserveNextInvoiceNumber(connection, date = new Date()) {
  const settings = await getInvoiceSettingsForUpdate(connection);
  const result = await nextAvailableInvoiceNumber(connection, settings, date);

  // Update nextInvoiceNumber in the settings JSON
  const updatedSettings = { ...settings, nextInvoiceNumber: result.sequence + 1 };
  delete updatedSettings.previewInvoiceNumber;
  delete updatedSettings.sampleDueDate;

  await connection.execute(
    "UPDATE invoice SET items_json = ? WHERE invoiceId = ?",
    [JSON.stringify(updatedSettings), SETTINGS_ROW_ID]
  );

  return { ...result, settings };
}

async function updateInvoiceLogo(companyLogoUrl) {
  const current = await getInvoiceSettings();
  const settings = current || defaultSettings;

  return saveInvoiceSettings({
    ...settings,
    branding: {
      ...settings.branding,
      companyLogoUrl
    }
  });
}

async function addNumberingActivity(records = []) {
  if (!records.length) return [];

  // Store numbering activity in audit_logs
  for (const record of records) {
    await pool.query(
      `INSERT INTO audit_logs (activity_type, action_description, affected_record, status, previous_value, new_value, user_name, created_at)
       VALUES ('invoice_numbering', ?, NULL, 'success', ?, ?, ?, NOW())`,
      [record.action, record.oldValue ?? "", record.newValue ?? "", record.changedBy || "Admin"]
    );
  }

  return listNumberingActivity();
}

async function listNumberingActivity(limit = 20) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));

  const [rows] = await pool.execute(
    `SELECT
      audit_log_id AS id,
      NULL AS settingId,
      action_description AS action,
      previous_value AS oldValue,
      new_value AS newValue,
      user_name AS changedBy,
      NULL AS notes,
      created_at AS createdAt
     FROM audit_logs
     WHERE activity_type = 'invoice_numbering'
     ORDER BY created_at DESC, audit_log_id DESC
     LIMIT ${safeLimit}`
  );

  return rows;
}

module.exports = {
  addNumberingActivity,
  buildInvoiceNumber,
  calculateConfigurationStatus,
  calculateDueDate,
  defaultSettings,
  getInvoiceSettings,
  getInvoiceSettingsForUpdate,
  invoiceStatusWorkflow,
  listNumberingActivity,
  missingInvoiceSettingsMessage,
  optionLists,
  previewNextInvoiceNumber,
  reserveNextInvoiceNumber,
  saveInvoiceSettings,
  SETTINGS_ROW_ID,
  updateInvoiceLogo
};
