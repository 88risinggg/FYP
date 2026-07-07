const fs = require("fs/promises");
const path = require("path");

const {
  calculateConfigurationStatus,
  defaultSettings,
  getInvoiceSettings,
  invoiceStatusWorkflow,
  optionLists,
  saveInvoiceSettings,
  updateInvoiceLogo
} = require("../models/invoiceSettingsModel");
const { getClientIp, logAuditEvent } = require("../models/auditLogModel");

const uploadDirectory = path.join(__dirname, "..", "..", "public", "uploads", "invoice-logos");

function buildPayload(settings, isConfigured) {
  const effectiveSettings = settings || defaultSettings;

  return {
    settings: effectiveSettings,
    options: optionLists,
    configurationStatus: calculateConfigurationStatus(effectiveSettings),
    invoiceStatusWorkflow,
    isConfigured: Boolean(isConfigured)
  };
}

function normalizeSettings(body) {
  const general = body.general || {};
  const exportSettings = body.export || {};
  const branding = body.branding || {};

  return {
    ...defaultSettings,
    ...body,
    general: {
      ...defaultSettings.general,
      ...general,
      defaultCurrency: String(general.defaultCurrency || "").trim().toUpperCase(),
      defaultLanguage: String(general.defaultLanguage || "").trim(),
      defaultTax: String(general.defaultTax || "").trim(),
      priceDisplay: String(general.priceDisplay || "").trim(),
      paymentTerms: String(general.paymentTerms || "").trim(),
      lateFeeValue: Number(general.lateFeeValue),
      lateFeeType: String(general.lateFeeType || "percent").trim(),
      onlineViewLinkEnabled: Boolean(general.onlineViewLinkEnabled),
      whatsappNotificationsEnabled: Boolean(general.whatsappNotificationsEnabled)
    },
    export: {
      ...defaultSettings.export,
      ...exportSettings,
      pdfExportEnabled: Boolean(exportSettings.pdfExportEnabled),
      excelExportEnabled: Boolean(exportSettings.excelExportEnabled),
      pdfPaperSize: String(exportSettings.pdfPaperSize || "").trim(),
      excelFormat: String(exportSettings.excelFormat || "").trim()
    },
    branding: {
      ...defaultSettings.branding,
      ...branding,
      companyLogoUrl: String(branding.companyLogoUrl || "").trim(),
      brandColor: String(branding.brandColor || defaultSettings.branding.brandColor).trim(),
      showCompanyDetailsOnInvoice: Boolean(branding.showCompanyDetailsOnInvoice)
    }
  };
}

function hasOption(list, value) {
  return list.some((item) => item.value === value);
}

function validateSettings(settings) {
  const errors = [];
  const general = settings.general;
  const exportSettings = settings.export;
  const branding = settings.branding;

  if (!hasOption(optionLists.currencies, general.defaultCurrency)) {
    errors.push("Default currency is required.");
  }
  if (!hasOption(optionLists.languages, general.defaultLanguage)) {
    errors.push("Default language is required.");
  }
  if (!hasOption(optionLists.taxes, general.defaultTax)) {
    errors.push("Default tax is required.");
  }
  if (!hasOption(optionLists.priceDisplayOptions, general.priceDisplay)) {
    errors.push("Price display is required.");
  }
  if (!hasOption(optionLists.paymentTerms, general.paymentTerms)) {
    errors.push("Payment terms are required.");
  }
  if (Number.isNaN(general.lateFeeValue) || general.lateFeeValue < 0) {
    errors.push("Late fee must be 0 or higher.");
  }
  if (!hasOption(optionLists.lateFeeTypes, general.lateFeeType)) {
    errors.push("Late fee type is invalid.");
  }
  if (!hasOption(optionLists.pdfPaperSizes, exportSettings.pdfPaperSize)) {
    errors.push("PDF paper size is required.");
  }
  if (!hasOption(optionLists.excelFormats, exportSettings.excelFormat)) {
    errors.push("Excel format is required.");
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
    res.json(buildPayload(settings, Boolean(settings)));
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
      actionDescription: "Updated invoice general settings",
      affectedRecord: String(saved.settingId),
      status: "Success",
      ipAddress: getClientIp(req)
    });

    res.json({
      ...buildPayload(saved, true),
      message: "Invoice settings saved."
    });
  } catch (error) {
    handleSettingsError(error, res, "Unable to save invoice settings.");
  }
}

function parseLogoPayload(body) {
  const dataUrl = String(body.dataUrl || "");
  const matches = dataUrl.match(/^data:(image\/(?:png|jpe?g));base64,(.+)$/i);

  if (!matches) {
    return null;
  }

  const extension = matches[1].includes("png") ? "png" : "jpg";
  return {
    extension,
    buffer: Buffer.from(matches[2], "base64")
  };
}

async function postInvoiceLogo(req, res) {
  try {
    const parsedLogo = parseLogoPayload(req.body);

    if (!parsedLogo) {
      return res.status(400).json({ message: "Logo must be a PNG, JPG, or JPEG image." });
    }

    if (parsedLogo.buffer.length > 2 * 1024 * 1024) {
      return res.status(400).json({ message: "Logo file must be 2MB or smaller." });
    }

    await fs.mkdir(uploadDirectory, { recursive: true });
    const fileName = `invoice-logo-${Date.now()}.${parsedLogo.extension}`;
    const filePath = path.join(uploadDirectory, fileName);
    await fs.writeFile(filePath, parsedLogo.buffer);

    const companyLogoUrl = `/uploads/invoice-logos/${fileName}`;
    const saved = await updateInvoiceLogo(companyLogoUrl);

    await logAuditEvent({
      userId: req.user?.userId,
      userName: req.user?.email || "Admin",
      activityType: "Invoice Settings",
      actionDescription: "Uploaded invoice company logo",
      affectedRecord: String(saved.settingId),
      status: "Success",
      ipAddress: getClientIp(req)
    });

    res.json({
      companyLogoUrl,
      settings: saved,
      message: "Invoice logo uploaded."
    });
  } catch (error) {
    handleSettingsError(error, res, "Unable to upload invoice logo.");
  }
}

module.exports = {
  getSettings,
  postInvoiceLogo,
  putSettings
};
