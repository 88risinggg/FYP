const fs = require("fs/promises");
const path = require("path");

const {
  addNumberingActivity,
  buildInvoiceNumber,
  calculateDueDate,
  calculateConfigurationStatus,
  defaultSettings,
  getInvoiceSettings,
  invoiceStatusWorkflow,
  listNumberingActivity,
  optionLists,
  saveInvoiceSettings,
  updateInvoiceLogo
} = require("../models/invoiceSettingsModel");
const { getClientIp, logAuditEvent } = require("../models/auditLogModel");
const { sendInvoiceSettingsTestEmail } = require("../services/invoiceDeliveryService");
const { generateInvoicePDF } = require("../services/pdfService");

const uploadDirectory = path.join(__dirname, "..", "..", "uploads", "invoice-logos");

async function buildPayload(settings, isConfigured) {
  const effectiveSettings = settings || defaultSettings;

  return {
    settings: effectiveSettings,
    options: optionLists,
    configurationStatus: calculateConfigurationStatus(effectiveSettings),
    invoiceStatusWorkflow,
    numberingActivity: await listNumberingActivity(),
    isConfigured: Boolean(isConfigured)
  };
}

function normalizeSettings(body) {
  const general = body.general || {};
  const exportSettings = body.export || {};
  const branding = body.branding || {};
  const sequenceRules = body.sequenceRules || {};

  return {
    ...defaultSettings,
    ...body,
    invoicePrefix: String(body.invoicePrefix || defaultSettings.invoicePrefix).trim().toUpperCase(),
    invoiceYear: String(body.invoiceYear || defaultSettings.invoiceYear).replace(/\D/g, ""),
    separatorStyle: String(body.separatorStyle || defaultSettings.separatorStyle).trim(),
    invoiceFormat: String(body.invoiceFormat || defaultSettings.invoiceFormat).trim(),
    nextInvoiceNumber: Number(body.nextInvoiceNumber),
    companyName: String(body.companyName || "").trim(),
    companyRegistrationNumber: String(body.companyRegistrationNumber || "").trim(),
    companyAddress: String(body.companyAddress || "").trim(),
    registeredOfficeAddress: String(body.registeredOfficeAddress || "").trim(),
    financeEmail: String(body.financeEmail || "").trim(),
    supportEmail: String(body.supportEmail || "").trim(),
    bankAccountHolderName: String(body.bankAccountHolderName || "").trim(),
    bankName: String(body.bankName || "").trim(),
    bankAccountNumber: String(body.bankAccountNumber || "").trim(),
    bicSwift: String(body.bicSwift || "").trim(),
    paynowIdentifier: String(body.paynowIdentifier || "").trim(),
    paymentReferenceInstruction: String(body.paymentReferenceInstruction || "").trim(),
    payoutStatement: String(body.payoutStatement || "").trim(),
    computerGeneratedStatement: String(body.computerGeneratedStatement || "").trim(),
    senderName: String(body.senderName || "").trim(),
    replyToEmail: String(body.replyToEmail || "").trim(),
    emailSubjectTemplate: String(body.emailSubjectTemplate || "").trim(),
    emailBodyTemplate: String(body.emailBodyTemplate || "").trim(),
    attachPdfInvoice: body.attachPdfInvoice !== false,
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
      pdfPaperSize: "A4",
      excelFormat: String(exportSettings.excelFormat || "").trim()
    },
    branding: {
      ...defaultSettings.branding,
      ...branding,
      companyLogoUrl: String(branding.companyLogoUrl || "").trim(),
      brandColor: defaultSettings.branding.brandColor,
      showCompanyDetailsOnInvoice: true
    },
    sequenceRules: {
      ...defaultSettings.sequenceRules,
      ...sequenceRules,
      yearlyReset: Boolean(sequenceRules.yearlyReset ?? defaultSettings.sequenceRules.yearlyReset),
      allowManualOverride: Boolean(
        sequenceRules.allowManualOverride ?? defaultSettings.sequenceRules.allowManualOverride
      ),
      lockNumberingAfterSent: Boolean(
        sequenceRules.lockNumberingAfterSent ?? defaultSettings.sequenceRules.lockNumberingAfterSent
      ),
      preventDuplicateNumbers: Boolean(
        sequenceRules.preventDuplicateNumbers ?? defaultSettings.sequenceRules.preventDuplicateNumbers
      )
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
  if (!settings.invoicePrefix) {
    errors.push("Invoice prefix is required.");
  }
  if (!/^\d{4}$/.test(String(settings.invoiceYear || ""))) {
    errors.push("Enter a valid four-digit invoice year.");
  }
  if (!hasOption(optionLists.separatorStyles, settings.separatorStyle)) {
    errors.push("Separator style is invalid.");
  }
  if (!hasOption(optionLists.invoiceFormats, settings.invoiceFormat)) {
    errors.push("Invoice format is invalid.");
  }
  if (!Number.isInteger(Number(settings.nextInvoiceNumber)) || Number(settings.nextInvoiceNumber) < 1) {
    errors.push("Next invoice number must be 1 or higher.");
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  [settings.financeEmail, settings.supportEmail, settings.replyToEmail]
    .filter(Boolean)
    .forEach((email) => {
      if (!emailPattern.test(email)) errors.push(`Invalid email address: ${email}`);
    });
  const allowedPlaceholders = new Set([
    "invoice_number", "customer_name", "amount_due", "due_date",
    "company_name", "online_view_url", "payment_url"
  ]);
  [settings.emailSubjectTemplate, settings.emailBodyTemplate].forEach((template) => {
    for (const match of String(template || "").matchAll(/\{\{([^}]+)\}\}/g)) {
      if (!allowedPlaceholders.has(match[1])) errors.push(`Unsupported email placeholder: {{${match[1]}}}`);
    }
  });
  return errors;
}

const numberingActivityFields = [
  { field: "invoicePrefix", label: "Invoice Prefix" },
  { field: "invoiceYear", label: "Year" },
  { field: "separatorStyle", label: "Separator Style" },
  { field: "invoiceFormat", label: "Invoice Format" },
  { field: "nextInvoiceNumber", label: "Next Invoice Number" },
  { field: "sequenceRules.yearlyReset", label: "Yearly Reset" },
  { field: "sequenceRules.allowManualOverride", label: "Allow Manual Override" },
  { field: "sequenceRules.lockNumberingAfterSent", label: "Lock Numbering After Sent" },
  { field: "sequenceRules.preventDuplicateNumbers", label: "Prevent Duplicate Numbers" }
];

function valueAtPath(source, fieldPath) {
  return fieldPath.split(".").reduce((value, key) => value?.[key], source);
}

function displayValue(value) {
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  if (value === undefined || value === null || value === "") return "Not set";
  return String(value);
}

function buildNumberingActivityRecords(previousSettings, nextSettings, savedSettings, changedBy) {
  const previous = previousSettings || defaultSettings;

  return numberingActivityFields
    .map((config) => {
      const oldValue = valueAtPath(previous, config.field);
      const newValue = valueAtPath(nextSettings, config.field);

      if (displayValue(oldValue) === displayValue(newValue)) return null;

      return {
        settingId: savedSettings.settingId,
        action: `Updated ${config.label}`,
        oldValue: displayValue(oldValue),
        newValue: displayValue(newValue),
        changedBy,
        notes: "Saved from Invoice Settings > Numbering"
      };
    })
    .filter(Boolean);
}

function handleSettingsError(error, res, fallbackMessage) {
  res.status(error.statusCode || 500).json({
    message: error.statusCode ? error.message : fallbackMessage
  });
}

async function getSettings(req, res) {
  try {
    const settings = await getInvoiceSettings();
    res.json(await buildPayload(settings, Boolean(settings)));
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

    const previousSettings = await getInvoiceSettings();
    const saved = await saveInvoiceSettings(settings);
    const changedBy = req.user?.email || "Admin";
    const numberingActivity = buildNumberingActivityRecords(previousSettings, settings, saved, changedBy);

    if (numberingActivity.length > 0) {
      await addNumberingActivity(numberingActivity);
    }

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
      ...(await buildPayload(saved, true)),
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

async function postTestInvoiceEmail(req, res) {
  const recipient = String(req.body.recipient || req.user?.email || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    return res.status(400).json({ message: "Enter a valid test-email recipient." });
  }

  try {
    const result = await sendInvoiceSettingsTestEmail(recipient);
    res.json({ message: `Test invoice email sent to ${recipient}.`, result });
  } catch (error) {
    handleSettingsError(error, res, "Unable to send the test invoice email.");
  }
}

async function postInvoicePreview(req, res) {
  try {
    const settings = normalizeSettings(req.body);
    const errors = validateSettings(settings);
    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const issueDate = new Date();
    const invoice = {
      invoiceId: buildInvoiceNumber(settings, issueDate, settings.nextInvoiceNumber),
      status: "Draft",
      issue_date: issueDate.toISOString().slice(0, 10),
      due_date: calculateDueDate(settings, issueDate),
      total_amount: 188.5,
      amount_paid: 25,
      customer_name: "Sample Customer",
      customer_email: "customer@example.com",
      customer_address: "Sample customer address",
      items: [
        { description: "Professional service", quantity: 2, unit_price: 75, amount: 150 },
        { description: "Administrative fee", quantity: 1, unit_price: 38.5, amount: 38.5 }
      ]
    };
    const pdf = await generateInvoicePDF(invoice, { settings });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="invoice-template-preview.pdf"');
    res.send(pdf);
  } catch (error) {
    handleSettingsError(error, res, "Unable to generate the invoice preview.");
  }
}

module.exports = {
  getSettings,
  postInvoiceLogo,
  postInvoicePreview,
  postTestInvoiceEmail,
  putSettings
};
