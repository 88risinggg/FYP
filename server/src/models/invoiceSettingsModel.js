const { pool } = require("../config/db");

const missingInvoiceSettingsMessage =
  "Invoice settings table is missing. Add invoice_settings manually in MySQL before using this feature.";

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

function formatDatePart(date, dateFormat) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  if (dateFormat === "YYMM") {
    return `${year.slice(-2)}${month}`;
  }

  if (dateFormat === "YYYYMMDD") {
    return `${year}${month}${day}`;
  }

  return `${year}${month}`;
}

function buildInvoiceNumber(settings, date = new Date()) {
  const prefix = settings.invoicePrefix || "INV";
  const nextNumber = String(settings.nextInvoiceNumber || 1).padStart(4, "0");
  const datePart = formatDatePart(date, settings.dateFormat);

  if (settings.numberingStyle === "PREFIX-NUMBER") {
    return `${prefix}-${nextNumber}`;
  }

  if (settings.numberingStyle === "PREFIX-DATE-NUMBER") {
    return `${prefix}-${datePart}-${nextNumber}`;
  }

  if (settings.numberingStyle === "DATE-PREFIX-NUMBER") {
    return `${datePart}-${prefix}-${nextNumber}`;
  }

  return `${prefix}-${datePart}-${nextNumber}`;
}

function calculateDueDate(settings, issueDate = new Date()) {
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + Number(settings.dueDays || 30));
  return dueDate.toISOString().slice(0, 10);
}

function mapSettings(row) {
  const settings = {
    settingId: row.setting_id,
    invoicePrefix: row.invoice_prefix,
    nextInvoiceNumber: Number(row.next_invoice_number),
    numberingStyle: row.numbering_style,
    dateFormat: row.date_format,
    defaultCurrency: row.default_currency,
    taxType: row.tax_type,
    defaultTaxRate: Number(row.default_tax_rate || 0),
    pricesIncludeTax: Boolean(row.prices_include_tax),
    paymentTerms: row.payment_terms,
    dueDays: Number(row.due_days),
    lateFeePercent: Number(row.late_fee_percent || 0),
    gracePeriodDays: Number(row.grace_period_days || 0),
    companyName: row.company_name,
    companyAddress: row.company_address,
    supportEmail: row.support_email,
    footerNote: row.footer_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };

  return {
    ...settings,
    previewInvoiceNumber: buildInvoiceNumber(settings),
    sampleDueDate: calculateDueDate(settings)
  };
}

async function getInvoiceSettings() {
  try {
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
    const current = await getInvoiceSettings();

    if (!current) {
      const [result] = await pool.execute(
        `INSERT INTO invoice_settings (
          invoice_prefix, next_invoice_number, numbering_style, date_format,
          default_currency, tax_type, default_tax_rate, prices_include_tax,
          payment_terms, due_days, late_fee_percent, grace_period_days,
          company_name, company_address, support_email, footer_note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          settings.invoicePrefix,
          settings.nextInvoiceNumber,
          settings.numberingStyle,
          settings.dateFormat,
          settings.defaultCurrency,
          settings.taxType,
          settings.defaultTaxRate,
          settings.pricesIncludeTax ? 1 : 0,
          settings.paymentTerms,
          settings.dueDays,
          settings.lateFeePercent,
          settings.gracePeriodDays,
          settings.companyName,
          settings.companyAddress,
          settings.supportEmail,
          settings.footerNote
        ]
      );

      const [rows] = await pool.execute("SELECT * FROM invoice_settings WHERE setting_id = ?", [
        result.insertId
      ]);
      return mapSettings(rows[0]);
    }

    await pool.execute(
      `UPDATE invoice_settings
       SET invoice_prefix = ?,
           next_invoice_number = ?,
           numbering_style = ?,
           date_format = ?,
           default_currency = ?,
           tax_type = ?,
           default_tax_rate = ?,
           prices_include_tax = ?,
           payment_terms = ?,
           due_days = ?,
           late_fee_percent = ?,
           grace_period_days = ?,
           company_name = ?,
           company_address = ?,
           support_email = ?,
           footer_note = ?
       WHERE setting_id = ?`,
      [
        settings.invoicePrefix,
        settings.nextInvoiceNumber,
        settings.numberingStyle,
        settings.dateFormat,
        settings.defaultCurrency,
        settings.taxType,
        settings.defaultTaxRate,
        settings.pricesIncludeTax ? 1 : 0,
        settings.paymentTerms,
        settings.dueDays,
        settings.lateFeePercent,
        settings.gracePeriodDays,
        settings.companyName,
        settings.companyAddress,
        settings.supportEmail,
        settings.footerNote,
        current.settingId
      ]
    );

    return getInvoiceSettings();
  } catch (error) {
    handleDatabaseShapeError(error);
  }
}

module.exports = {
  buildInvoiceNumber,
  calculateDueDate,
  getInvoiceSettings,
  missingInvoiceSettingsMessage,
  saveInvoiceSettings
};
