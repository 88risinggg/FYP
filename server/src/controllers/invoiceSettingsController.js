const {
  getInvoiceSettings,
  saveInvoiceSettings
} = require("../models/invoiceSettingsModel");
const { getClientIp, logAuditEvent } = require("../models/auditLogModel");

const defaultSettings = {
  invoicePrefix: "INV",
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
  footerNote: "Thank you for your business."
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeSettings(body) {
  return {
    invoicePrefix: String(body.invoicePrefix || "").trim().toUpperCase(),
    nextInvoiceNumber: Number(body.nextInvoiceNumber),
    numberingStyle: String(body.numberingStyle || "").trim(),
    dateFormat: String(body.dateFormat || "").trim(),
    defaultCurrency: String(body.defaultCurrency || "").trim().toUpperCase(),
    taxType: String(body.taxType || "").trim(),
    defaultTaxRate: Number(body.defaultTaxRate),
    pricesIncludeTax: body.pricesIncludeTax === true || body.pricesIncludeTax === 1 || body.pricesIncludeTax === "1",
    paymentTerms: String(body.paymentTerms || "").trim(),
    dueDays: Number(body.dueDays),
    lateFeePercent: Number(body.lateFeePercent),
    gracePeriodDays: Number(body.gracePeriodDays),
    companyName: String(body.companyName || "").trim(),
    companyAddress: String(body.companyAddress || "").trim(),
    supportEmail: String(body.supportEmail || "").trim().toLowerCase(),
    footerNote: String(body.footerNote || "").trim()
  };
}

function validateSettings(settings) {
  const errors = [];
  const numberingStyles = ["PREFIX-DATE-NUMBER", "PREFIX-NUMBER", "DATE-PREFIX-NUMBER"];
  const dateFormats = ["YYYYMM", "YYMM", "YYYYMMDD"];

  if (!settings.invoicePrefix) errors.push("Invoice prefix is required.");
  if (!Number.isInteger(settings.nextInvoiceNumber) || settings.nextInvoiceNumber < 1) {
    errors.push("Next invoice number must be at least 1.");
  }
  if (!numberingStyles.includes(settings.numberingStyle)) errors.push("Numbering style is invalid.");
  if (!dateFormats.includes(settings.dateFormat)) errors.push("Date format is invalid.");
  if (!settings.defaultCurrency) errors.push("Default currency is required.");
  if (!settings.taxType) errors.push("Tax type is required.");
  if (Number.isNaN(settings.defaultTaxRate) || settings.defaultTaxRate < 0) {
    errors.push("Default tax rate must be 0 or higher.");
  }
  if (!settings.paymentTerms) errors.push("Payment terms are required.");
  if (!Number.isInteger(settings.dueDays) || settings.dueDays < 1) {
    errors.push("Invoice due period must be at least 1 day.");
  }
  if (Number.isNaN(settings.lateFeePercent) || settings.lateFeePercent < 0) {
    errors.push("Late fee percent must be 0 or higher.");
  }
  if (!Number.isInteger(settings.gracePeriodDays) || settings.gracePeriodDays < 0) {
    errors.push("Grace period days must be 0 or higher.");
  }
  if (!settings.companyName) errors.push("Company name is required.");
  if (!settings.companyAddress) errors.push("Company address is required.");
  if (!settings.supportEmail) errors.push("Support email is required.");
  if (settings.supportEmail && !emailPattern.test(settings.supportEmail)) {
    errors.push("Support email must be valid.");
  }

  return errors;
}

function handleSettingsError(error, res, fallbackMessage) {
  res.status(error.statusCode || 500).json({
    message: error.statusCode ? error.message : fallbackMessage
  });
}

async function getSettings(req, res) {
  try {
    const settings = await getInvoiceSettings();
    res.json({
      settings: settings || defaultSettings,
      isConfigured: Boolean(settings)
    });
  } catch (error) {
    handleSettingsError(error, res, "Unable to load invoice settings.");
  }
}

async function putSettings(req, res) {
  try {
    const settings = normalizeSettings(req.body);
    const errors = validateSettings(settings);

    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const saved = await saveInvoiceSettings(settings);

    await logAuditEvent({
      userId: req.user?.userId,
      userName: req.user?.email || "Admin",
      activityType: "Invoice Settings",
      actionDescription: "Updated invoice settings",
      affectedRecord: String(saved.settingId),
      status: "Success",
      ipAddress: getClientIp(req)
    });

    res.json({ settings: saved, message: "Invoice settings saved." });
  } catch (error) {
    handleSettingsError(error, res, "Unable to save invoice settings.");
  }
}

module.exports = {
  getSettings,
  putSettings
};
