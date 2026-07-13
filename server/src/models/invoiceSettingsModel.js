const { pool } = require("../config/db");

const missingInvoiceSettingsMessage =
  "Invoice settings table is missing or cannot be updated. Check the invoice_settings schema in MySQL before using this feature.";

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
  pdfPaperSizes: [
    { value: "A4", label: "A4" },
    { value: "A5", label: "A5" }
  ],
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
  { from: "Sent", to: "Viewed" },
  { from: "Viewed", to: "Paid" },
  { from: "Sent", to: "Overdue" },
  { from: "Viewed", to: "Overdue" }
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
  companyAddress: "",
  supportEmail: "",
  footerNote: "Thank you for your business.",
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

const schemaColumns = {
  setting_id: "INT AUTO_INCREMENT PRIMARY KEY",
  invoice_prefix: "VARCHAR(20) NOT NULL DEFAULT 'INV'",
  invoice_year: "VARCHAR(4) NOT NULL DEFAULT ''",
  separator_style: "VARCHAR(20) NOT NULL DEFAULT 'hyphen'",
  invoice_format: "VARCHAR(60) NOT NULL DEFAULT '{PREFIX}-{YYYY}-{NNNN}'",
  next_invoice_number: "INT NOT NULL DEFAULT 1",
  numbering_style: "VARCHAR(40) NOT NULL DEFAULT 'PREFIX-DATE-NUMBER'",
  date_format: "VARCHAR(20) NOT NULL DEFAULT 'YYYYMM'",
  default_currency: "VARCHAR(12) NOT NULL DEFAULT 'SGD'",
  default_language: "VARCHAR(12) NOT NULL DEFAULT 'en'",
  tax_type: "VARCHAR(30) NOT NULL DEFAULT 'GST'",
  default_tax: "VARCHAR(30) NOT NULL DEFAULT 'GST_9'",
  default_tax_rate: "DECIMAL(8,2) NOT NULL DEFAULT 9.00",
  prices_include_tax: "TINYINT(1) NOT NULL DEFAULT 0",
  price_display: "VARCHAR(30) NOT NULL DEFAULT 'tax_exclusive'",
  payment_terms: "VARCHAR(60) NOT NULL DEFAULT 'Net 30'",
  due_days: "INT NOT NULL DEFAULT 30",
  late_fee_percent: "DECIMAL(8,2) NOT NULL DEFAULT 0.00",
  late_fee_type: "VARCHAR(20) NOT NULL DEFAULT 'percent'",
  grace_period_days: "INT NOT NULL DEFAULT 0",
  online_view_link_enabled: "TINYINT(1) NOT NULL DEFAULT 1",
  whatsapp_notifications_enabled: "TINYINT(1) NOT NULL DEFAULT 0",
  pdf_export_enabled: "TINYINT(1) NOT NULL DEFAULT 1",
  excel_export_enabled: "TINYINT(1) NOT NULL DEFAULT 1",
  pdf_paper_size: "VARCHAR(10) NOT NULL DEFAULT 'A4'",
  excel_format: "VARCHAR(10) NOT NULL DEFAULT 'xlsx'",
  company_logo_url: "VARCHAR(500) NULL",
  brand_color: "VARCHAR(20) NOT NULL DEFAULT '#F38978'",
  show_company_details_on_invoice: "TINYINT(1) NOT NULL DEFAULT 1",
  yearly_reset_enabled: "TINYINT(1) NOT NULL DEFAULT 1",
  manual_override_enabled: "TINYINT(1) NOT NULL DEFAULT 0",
  lock_numbering_after_sent: "TINYINT(1) NOT NULL DEFAULT 1",
  prevent_duplicate_numbers: "TINYINT(1) NOT NULL DEFAULT 1",
  company_name: "VARCHAR(255) NOT NULL DEFAULT ''",
  company_address: "TEXT NULL",
  support_email: "VARCHAR(255) NOT NULL DEFAULT ''",
  footer_note: "TEXT NULL",
  created_at: "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP",
  updated_at: "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
};

function isMissingTableError(error) {
  return error?.code === "ER_NO_SUCH_TABLE" || error?.code === "ER_BAD_FIELD_ERROR";
}

function handleDatabaseShapeError(error) {
  if (isMissingTableError(error)) {
    const wrapped = new Error(missingInvoiceSettingsMessage);
    wrapped.statusCode = 501;
    wrapped.cause = error;
    throw wrapped;
  }

  throw error;
}

async function ensureInvoiceSettingsSchema() {
  try {
    await pool.execute(
      `CREATE TABLE IF NOT EXISTS invoice_settings (
        setting_id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_prefix VARCHAR(20) NOT NULL DEFAULT 'INV',
        invoice_year VARCHAR(4) NOT NULL DEFAULT '',
        separator_style VARCHAR(20) NOT NULL DEFAULT 'hyphen',
        invoice_format VARCHAR(60) NOT NULL DEFAULT '{PREFIX}-{YYYY}-{NNNN}',
        next_invoice_number INT NOT NULL DEFAULT 1,
        numbering_style VARCHAR(40) NOT NULL DEFAULT 'PREFIX-DATE-NUMBER',
        date_format VARCHAR(20) NOT NULL DEFAULT 'YYYYMM',
        default_currency VARCHAR(12) NOT NULL DEFAULT 'SGD',
        default_language VARCHAR(12) NOT NULL DEFAULT 'en',
        tax_type VARCHAR(30) NOT NULL DEFAULT 'GST',
        default_tax VARCHAR(30) NOT NULL DEFAULT 'GST_9',
        default_tax_rate DECIMAL(8,2) NOT NULL DEFAULT 9.00,
        prices_include_tax TINYINT(1) NOT NULL DEFAULT 0,
        price_display VARCHAR(30) NOT NULL DEFAULT 'tax_exclusive',
        payment_terms VARCHAR(60) NOT NULL DEFAULT 'Net 30',
        due_days INT NOT NULL DEFAULT 30,
        late_fee_percent DECIMAL(8,2) NOT NULL DEFAULT 0.00,
        late_fee_type VARCHAR(20) NOT NULL DEFAULT 'percent',
        grace_period_days INT NOT NULL DEFAULT 0,
        online_view_link_enabled TINYINT(1) NOT NULL DEFAULT 1,
        whatsapp_notifications_enabled TINYINT(1) NOT NULL DEFAULT 0,
        pdf_export_enabled TINYINT(1) NOT NULL DEFAULT 1,
        excel_export_enabled TINYINT(1) NOT NULL DEFAULT 1,
        pdf_paper_size VARCHAR(10) NOT NULL DEFAULT 'A4',
        excel_format VARCHAR(10) NOT NULL DEFAULT 'xlsx',
        company_logo_url VARCHAR(500) NULL,
        brand_color VARCHAR(20) NOT NULL DEFAULT '#F38978',
        show_company_details_on_invoice TINYINT(1) NOT NULL DEFAULT 1,
        yearly_reset_enabled TINYINT(1) NOT NULL DEFAULT 1,
        manual_override_enabled TINYINT(1) NOT NULL DEFAULT 0,
        lock_numbering_after_sent TINYINT(1) NOT NULL DEFAULT 1,
        prevent_duplicate_numbers TINYINT(1) NOT NULL DEFAULT 1,
        company_name VARCHAR(255) NOT NULL DEFAULT '',
        company_address TEXT NULL,
        support_email VARCHAR(255) NOT NULL DEFAULT '',
        footer_note TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`
    );

    const [columns] = await pool.execute("SHOW COLUMNS FROM invoice_settings");
    const existingColumns = new Set(columns.map((column) => column.Field));

    for (const [columnName, definition] of Object.entries(schemaColumns)) {
      if (!existingColumns.has(columnName)) {
        await pool.execute(`ALTER TABLE invoice_settings ADD COLUMN ${columnName} ${definition}`);
      }
    }

    await pool.execute(
      `CREATE TABLE IF NOT EXISTS invoice_numbering_activity (
        activity_id INT AUTO_INCREMENT PRIMARY KEY,
        setting_id INT NULL,
        action VARCHAR(120) NOT NULL,
        old_value VARCHAR(500) NULL,
        new_value VARCHAR(500) NULL,
        changed_by VARCHAR(255) NOT NULL DEFAULT 'Admin',
        notes VARCHAR(500) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    );
  } catch (error) {
    handleDatabaseShapeError(error);
  }
}

function boolValue(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  return value === true || value === 1 || value === "1";
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function formatDatePart(date, dateFormat) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  if (dateFormat === "YYMM") return `${year.slice(-2)}${month}`;
  if (dateFormat === "YYYYMMDD") return `${year}${month}${day}`;
  return `${year}${month}`;
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
  return {
    YYYY: fullYear,
    YY: fullYear.slice(-2)
  };
}

function legacyInvoiceFormat(settings) {
  const numberingStyle = settings?.numberingStyle || settings?.numbering_style;
  const dateFormat = settings?.dateFormat || settings?.date_format;

  if (numberingStyle === "PREFIX-NUMBER") return "{PREFIX}-{NNNN}";
  if (numberingStyle === "DATE-PREFIX-NUMBER") return "{YYYY}-{PREFIX}-{NNNN}";
  return dateFormat === "YYMM" ? "{PREFIX}-{YY}-{NNNN}" : defaultSettings.invoiceFormat;
}

function buildInvoiceNumber(settings, date = new Date(), nextNumber = settings?.nextInvoiceNumber) {
  const prefix = settings.invoicePrefix || "INV";
  const { YYYY, YY } = invoiceYearTokens(settings, date);
  const format = settings.invoiceFormat || legacyInvoiceFormat(settings);
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

function mapSettings(row) {
  const flatSettings = {
    settingId: row.setting_id,
    invoicePrefix: row.invoice_prefix || defaultSettings.invoicePrefix,
    invoiceYear: normalizeInvoiceYear(row.invoice_year || defaultSettings.invoiceYear),
    separatorStyle: row.separator_style || defaultSettings.separatorStyle,
    invoiceFormat: row.invoice_format || legacyInvoiceFormat(row),
    nextInvoiceNumber: numberValue(row.next_invoice_number, defaultSettings.nextInvoiceNumber),
    numberingStyle: row.numbering_style || defaultSettings.numberingStyle,
    dateFormat: row.date_format || defaultSettings.dateFormat,
    defaultCurrency: row.default_currency || defaultSettings.defaultCurrency,
    taxType: row.tax_type || defaultSettings.taxType,
    defaultTaxRate: numberValue(row.default_tax_rate, defaultSettings.defaultTaxRate),
    pricesIncludeTax: boolValue(row.prices_include_tax, defaultSettings.pricesIncludeTax),
    paymentTerms: row.payment_terms || defaultSettings.paymentTerms,
    dueDays: numberValue(row.due_days, defaultSettings.dueDays),
    lateFeePercent: numberValue(row.late_fee_percent, defaultSettings.lateFeePercent),
    gracePeriodDays: numberValue(row.grace_period_days, defaultSettings.gracePeriodDays),
    companyName: row.company_name || "",
    companyAddress: row.company_address || "",
    supportEmail: row.support_email || "",
    footerNote: row.footer_note || defaultSettings.footerNote,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };

  const settings = {
    ...flatSettings,
    general: {
      defaultCurrency: row.default_currency || defaultSettings.general.defaultCurrency,
      defaultLanguage: row.default_language || defaultSettings.general.defaultLanguage,
      defaultTax: row.default_tax || defaultSettings.general.defaultTax,
      priceDisplay: row.price_display || defaultSettings.general.priceDisplay,
      paymentTerms: row.payment_terms || defaultSettings.general.paymentTerms,
      lateFeeValue: numberValue(row.late_fee_percent, defaultSettings.general.lateFeeValue),
      lateFeeType: row.late_fee_type || defaultSettings.general.lateFeeType,
      onlineViewLinkEnabled: boolValue(
        row.online_view_link_enabled,
        defaultSettings.general.onlineViewLinkEnabled
      ),
      whatsappNotificationsEnabled: boolValue(
        row.whatsapp_notifications_enabled,
        defaultSettings.general.whatsappNotificationsEnabled
      )
    },
    export: {
      pdfExportEnabled: boolValue(row.pdf_export_enabled, defaultSettings.export.pdfExportEnabled),
      excelExportEnabled: boolValue(row.excel_export_enabled, defaultSettings.export.excelExportEnabled),
      pdfPaperSize: row.pdf_paper_size || defaultSettings.export.pdfPaperSize,
      excelFormat: row.excel_format || defaultSettings.export.excelFormat
    },
    branding: {
      companyLogoUrl: row.company_logo_url || "",
      brandColor: row.brand_color || defaultSettings.branding.brandColor,
      showCompanyDetailsOnInvoice: boolValue(
        row.show_company_details_on_invoice,
        defaultSettings.branding.showCompanyDetailsOnInvoice
      )
    },
    sequenceRules: {
      yearlyReset: boolValue(row.yearly_reset_enabled, defaultSettings.sequenceRules.yearlyReset),
      allowManualOverride: boolValue(row.manual_override_enabled, defaultSettings.sequenceRules.allowManualOverride),
      lockNumberingAfterSent: boolValue(
        row.lock_numbering_after_sent,
        defaultSettings.sequenceRules.lockNumberingAfterSent
      ),
      preventDuplicateNumbers: boolValue(
        row.prevent_duplicate_numbers,
        defaultSettings.sequenceRules.preventDuplicateNumbers
      )
    }
  };

  return {
    ...settings,
    previewInvoiceNumber: buildInvoiceNumber(settings),
    sampleDueDate: calculateDueDate(settings)
  };
}

function toDbRow(settings) {
  const general = { ...defaultSettings.general, ...(settings.general || {}) };
  const exportSettings = { ...defaultSettings.export, ...(settings.export || {}) };
  const branding = { ...defaultSettings.branding, ...(settings.branding || {}) };
  const sequenceRules = { ...defaultSettings.sequenceRules, ...(settings.sequenceRules || {}) };
  const taxOption = optionLists.taxes.find((tax) => tax.value === general.defaultTax);
  const paymentTerm = general.paymentTerms || settings.paymentTerms || defaultSettings.paymentTerms;
  const lateFeeValue = numberValue(general.lateFeeValue, defaultSettings.general.lateFeeValue);

  return {
    invoice_prefix: settings.invoicePrefix || defaultSettings.invoicePrefix,
    invoice_year: normalizeInvoiceYear(settings.invoiceYear || defaultSettings.invoiceYear),
    separator_style: settings.separatorStyle || defaultSettings.separatorStyle,
    invoice_format: settings.invoiceFormat || defaultSettings.invoiceFormat,
    next_invoice_number: numberValue(settings.nextInvoiceNumber, defaultSettings.nextInvoiceNumber),
    numbering_style: settings.numberingStyle || defaultSettings.numberingStyle,
    date_format: settings.dateFormat || defaultSettings.dateFormat,
    default_currency: general.defaultCurrency || defaultSettings.general.defaultCurrency,
    default_language: general.defaultLanguage || defaultSettings.general.defaultLanguage,
    tax_type: taxOption?.type || settings.taxType || defaultSettings.taxType,
    default_tax: general.defaultTax || defaultSettings.general.defaultTax,
    default_tax_rate: numberValue(taxOption?.rate ?? settings.defaultTaxRate, defaultSettings.defaultTaxRate),
    prices_include_tax: general.priceDisplay === "tax_inclusive" ? 1 : 0,
    price_display: general.priceDisplay || defaultSettings.general.priceDisplay,
    payment_terms: paymentTerm,
    due_days: paymentTerm.match(/\d+/) ? Number(paymentTerm.match(/\d+/)[0]) : defaultSettings.dueDays,
    late_fee_percent: lateFeeValue,
    late_fee_type: general.lateFeeType || defaultSettings.general.lateFeeType,
    grace_period_days: numberValue(settings.gracePeriodDays, defaultSettings.gracePeriodDays),
    online_view_link_enabled: general.onlineViewLinkEnabled ? 1 : 0,
    whatsapp_notifications_enabled: general.whatsappNotificationsEnabled ? 1 : 0,
    pdf_export_enabled: exportSettings.pdfExportEnabled ? 1 : 0,
    excel_export_enabled: exportSettings.excelExportEnabled ? 1 : 0,
    pdf_paper_size: exportSettings.pdfPaperSize || defaultSettings.export.pdfPaperSize,
    excel_format: exportSettings.excelFormat || defaultSettings.export.excelFormat,
    company_logo_url: branding.companyLogoUrl || "",
    brand_color: branding.brandColor || defaultSettings.branding.brandColor,
    show_company_details_on_invoice: branding.showCompanyDetailsOnInvoice ? 1 : 0,
    yearly_reset_enabled: sequenceRules.yearlyReset ? 1 : 0,
    manual_override_enabled: sequenceRules.allowManualOverride ? 1 : 0,
    lock_numbering_after_sent: sequenceRules.lockNumberingAfterSent ? 1 : 0,
    prevent_duplicate_numbers: sequenceRules.preventDuplicateNumbers ? 1 : 0,
    company_name: settings.companyName || defaultSettings.companyName,
    company_address: settings.companyAddress || defaultSettings.companyAddress,
    support_email: settings.supportEmail || defaultSettings.supportEmail,
    footer_note: settings.footerNote || defaultSettings.footerNote
  };
}

function calculateConfigurationStatus(settings) {
  const status = {
    general: settings?.general?.defaultCurrency &&
      settings?.general?.defaultLanguage &&
      settings?.general?.defaultTax &&
      settings?.general?.priceDisplay &&
      settings?.general?.paymentTerms
      ? "completed"
      : "incomplete",
    numbering: settings?.invoicePrefix && settings?.nextInvoiceNumber ? "completed" : "incomplete",
    template: typeof settings?.branding?.showCompanyDetailsOnInvoice === "boolean" ? "completed" : "warning",
    email: settings?.general?.onlineViewLinkEnabled ? "completed" : "warning",
    reminders: settings?.general?.whatsappNotificationsEnabled ? "completed" : "warning",
    payments: "warning",
    automation: settings?.export?.pdfExportEnabled || settings?.export?.excelExportEnabled ? "completed" : "warning",
    bulkUpload: "incomplete"
  };

  const completedCount = Object.values(status).filter((value) => value === "completed").length;

  return {
    categories: status,
    completionPercentage: Math.round((completedCount / Object.keys(status).length) * 100)
  };
}

async function getInvoiceSettings() {
  try {
    await ensureInvoiceSettingsSchema();
    const [rows] = await pool.execute(
      `SELECT *
       FROM invoice_settings
       ORDER BY setting_id ASC
       LIMIT 1`
    );

    return rows[0] ? mapSettings(rows[0]) : null;
  } catch (error) {
    handleDatabaseShapeError(error);
  }
}

async function saveInvoiceSettings(settings) {
  try {
    await ensureInvoiceSettingsSchema();
    const current = await getInvoiceSettings();
    const dbRow = toDbRow(settings);
    const columns = Object.keys(dbRow);

    if (!current) {
      const placeholders = columns.map(() => "?").join(", ");
      const [result] = await pool.execute(
        `INSERT INTO invoice_settings (${columns.join(", ")}) VALUES (${placeholders})`,
        columns.map((column) => dbRow[column])
      );
      const [rows] = await pool.execute("SELECT * FROM invoice_settings WHERE setting_id = ?", [
        result.insertId
      ]);
      return mapSettings(rows[0]);
    }

    await pool.execute(
      `UPDATE invoice_settings
       SET ${columns.map((column) => `${column} = ?`).join(", ")}
       WHERE setting_id = ?`,
      [...columns.map((column) => dbRow[column]), current.settingId]
    );

    return getInvoiceSettings();
  } catch (error) {
    handleDatabaseShapeError(error);
  }
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

  await ensureInvoiceSettingsSchema();

  const values = records.map((record) => [
    record.settingId || null,
    record.action,
    record.oldValue ?? "",
    record.newValue ?? "",
    record.changedBy || "Admin",
    record.notes || ""
  ]);

  await pool.query(
    `INSERT INTO invoice_numbering_activity (
      setting_id, action, old_value, new_value, changed_by, notes
    ) VALUES ?`,
    [values]
  );

  return listNumberingActivity();
}

async function listNumberingActivity(limit = 20) {
  await ensureInvoiceSettingsSchema();
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));

  const [rows] = await pool.execute(
    `SELECT
      activity_id AS id,
      setting_id AS settingId,
      action,
      old_value AS oldValue,
      new_value AS newValue,
      changed_by AS changedBy,
      notes,
      created_at AS createdAt
     FROM invoice_numbering_activity
     ORDER BY created_at DESC, activity_id DESC
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
  invoiceStatusWorkflow,
  listNumberingActivity,
  missingInvoiceSettingsMessage,
  optionLists,
  saveInvoiceSettings,
  updateInvoiceLogo
};
