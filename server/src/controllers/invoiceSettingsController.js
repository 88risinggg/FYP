/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - SHARED
 * PURPOSE: Handles invoice Settings Controller API requests, validation, status codes, and responses.
 * LAYER: Backend controller - validates HTTP input and returns the API response.
 * FIND RELATED CODE: Follow service/model calls to find business rules and database work.
 */
const fs = require("fs/promises");
const path = require("path");

const {
  addNumberingActivity,
  buildInvoiceNumber,
  calculateDueDate,
  calculateConfigurationStatus,
  defaultSettings,
  derivePaymentTermDays,
  getInvoiceSettings,
  getInvoiceSettingsOptions,
  invoiceStatusWorkflow,
  listNumberingActivity,
  listNumberingActivityPage,
  saveInvoiceSettings,
  updateInvoiceLogo
} = require("../models/invoiceSettingsModel");
const {
  createGstRate,
  getEffectiveGstRate,
  getNextScheduledGstRate,
  listGstRates
} = require("../models/invoiceGstRateModel");
const { getClientIp, logAuditEvent } = require("../models/auditLogModel");
const {
  sendInvoiceSettingsTestEmail,
  validateInvoiceEmailTemplates
} = require("../services/invoiceDeliveryService");
const { generateInvoicePDF } = require("../services/pdfService");
const { getCompanyId } = require("../utils/companyScope");

const uploadDirectory = path.join(__dirname, "..", "..", "uploads", "invoice-logos");

async function buildPayload(settings, isConfigured, companyId = null) {
  const effectiveSettings = settings || defaultSettings;

  return {
    settings: effectiveSettings,
    options: await getInvoiceSettingsOptions(companyId),
    configurationStatus: calculateConfigurationStatus(effectiveSettings),
    invoiceStatusWorkflow,
    numberingActivity: await listNumberingActivity(5, companyId),
    isConfigured: Boolean(isConfigured)
  };
}

function normalizeSettings(body) {
  const general = body.general || {};
  const branding = body.branding || {};
  const sequenceRules = body.sequenceRules || {};

  const paymentTerms = String(general.paymentTerms || "").trim();
  const dueDays = derivePaymentTermDays({ general: { paymentTerms } });

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
    paymentTerms,
    dueDays,
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
      defaultLanguage: "en",
      defaultTax: String(general.defaultTax || "").trim(),
      priceDisplay: String(general.priceDisplay || "").trim(),
      paymentTerms,
      lateFeeValue: Number(general.lateFeeValue),
      lateFeeType: String(general.lateFeeType || "percent").trim(),
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
      lockNumberingAfterSent: true,
      preventDuplicateNumbers: true
    }
  };
}

function hasOption(list, value) {
  return list.some((item) => item.value === value);
}

function isRecognizedPaymentTerm(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (/^(due\s+on\s+receipt|immediate|payable\s+on\s+receipt)$/i.test(text)) return true;
  return /\bnet\s*\d{1,4}\b/i.test(text) || /\b\d{1,4}\s*(?:calendar\s*)?(?:business\s*)?days?\b/i.test(text);
}

function validateSettings(settings, options) {
  const errors = [];
  const general = settings.general;
  const branding = settings.branding;

  if (!hasOption(options.currencies, general.defaultCurrency)) {
    errors.push("Default currency is required.");
  }
  if (!hasOption(options.languages, general.defaultLanguage)) {
    errors.push("Default language is required.");
  }
  if (!hasOption(options.taxes, general.defaultTax)) {
    errors.push("Default tax is required.");
  }
  if (!hasOption(options.priceDisplayOptions, general.priceDisplay)) {
    errors.push("Price display is required.");
  }
  if (!general.paymentTerms) {
    errors.push("Payment terms are required.");
  } else if (general.paymentTerms.length > 80) {
    errors.push("Payment terms must be 80 characters or fewer.");
  } else if (!hasOption(options.paymentTerms, general.paymentTerms) && !isRecognizedPaymentTerm(general.paymentTerms)) {
    errors.push("Payment terms must include a number of days, for example Net 45, or be Due on Receipt.");
  }
  if (Number.isNaN(general.lateFeeValue) || general.lateFeeValue < 0) {
    errors.push("Late fee must be 0 or higher.");
  }
  if (!hasOption(options.lateFeeTypes, general.lateFeeType)) {
    errors.push("Late fee type is invalid.");
  }
  if (!settings.invoicePrefix) {
    errors.push("Invoice prefix is required.");
  }
  if (!/^\d{4}$/.test(String(settings.invoiceYear || ""))) {
    errors.push("Enter a valid four-digit invoice year.");
  }
  if (!hasOption(options.separatorStyles, settings.separatorStyle)) {
    errors.push("Separator style is invalid.");
  }
  if (!hasOption(options.invoiceFormats, settings.invoiceFormat)) {
    errors.push("Invoice format is invalid.");
  }
  if (
    settings.sequenceRules.yearlyReset &&
    !settings.invoiceFormat.includes("{YYYY}") &&
    !settings.invoiceFormat.includes("{YY}")
  ) {
    errors.push("Yearly reset requires the invoice format to include a year.");
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
  errors.push(...validateInvoiceEmailTemplates(
    settings.emailSubjectTemplate,
    settings.emailBodyTemplate
  ));
  return [...new Set(errors)];
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
      };
    })
    .filter(Boolean);
}

const auditSectionFields = {
  general: [
    "general",
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
    "nextInvoiceNumber",
    "sequenceRules"
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

function getChangedSettingsSections(previousSettings, nextSettings) {
  return Object.entries(auditSectionFields)
    .filter(([, fields]) => fields.some(
      (field) => JSON.stringify(previousSettings?.[field]) !== JSON.stringify(nextSettings?.[field])
    ))
    .map(([section]) => section);
}

function settingsAuditDescription(changedSections) {
  if (changedSections.length === 1) {
    return `Updated invoice ${changedSections[0]} settings`;
  }
  if (changedSections.length > 1) {
    const labels = changedSections.map(
      (section) => section.charAt(0).toUpperCase() + section.slice(1)
    );
    return `Updated invoice settings: ${labels.join(", ")}`;
  }
  return "Saved invoice settings";
}

function handleSettingsError(error, res, fallbackMessage) {
  res.status(error.statusCode || 500).json({
    message: error.statusCode ? error.message : fallbackMessage
  });
}

async function getSettings(req, res) {
  try {
    const companyId = getCompanyId(req);
    const settings = await getInvoiceSettings(companyId);
    res.json(await buildPayload(settings, Boolean(settings), companyId));
  } catch (error) {
    handleSettingsError(error, res, "Unable to load invoice settings.");
  }
}

async function putSettings(req, res) {
  try {
    const companyId = getCompanyId(req);
    const settings = normalizeSettings(req.body);
    const options = await getInvoiceSettingsOptions(companyId);
    const previousSettings = await getInvoiceSettings(companyId);

    // The next sequence can only be changed when Admin explicitly enables
    // manual override. Otherwise keep the latest server value to avoid a stale
    // settings screen rewinding a sequence that Finance has already advanced.
    if (!settings.sequenceRules.allowManualOverride) {
      settings.nextInvoiceNumber = previousSettings.nextInvoiceNumber;
    }
    const errors = validateSettings(settings, options);

    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const saved = await saveInvoiceSettings(settings, companyId);
    const changedBy = req.user?.email || "Admin";
    const numberingActivity = buildNumberingActivityRecords(previousSettings, settings, saved, changedBy);
    const changedSections = getChangedSettingsSections(previousSettings, settings);

    if (numberingActivity.length > 0) {
      await addNumberingActivity(numberingActivity, companyId);
    }

    await logAuditEvent({
      userId: req.user?.userId,
      userName: req.user?.email || "Admin",
      activityType: "Invoice Settings",
      actionDescription: settingsAuditDescription(changedSections),
      affectedRecord: String(saved.settingId),
      status: "Success",
      ipAddress: getClientIp(req)
    });

    res.json({
      ...(await buildPayload(saved, true, companyId)),
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
    const saved = await updateInvoiceLogo(companyLogoUrl, getCompanyId(req));

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
    const companyId = getCompanyId(req);
    const settings = req.body.settings
      ? normalizeSettings(req.body.settings)
      : await getInvoiceSettings(companyId);

    if (req.body.settings) {
      const options = await getInvoiceSettingsOptions(companyId);
      const errors = validateSettings(settings, options);
      if (errors.length > 0) {
        return res.status(400).json({ message: errors[0], errors });
      }
    }

    const result = await sendInvoiceSettingsTestEmail(recipient, {
      companyId,
      settings
    });
    res.json({ message: `Test invoice email sent to ${recipient}.`, result });
  } catch (error) {
    handleSettingsError(error, res, "Unable to send the test invoice email.");
  }
}

async function postInvoicePreview(req, res) {
  try {
    const companyId = getCompanyId(req);
    const settings = normalizeSettings(req.body);
    const options = await getInvoiceSettingsOptions(companyId);
    const errors = validateSettings(settings, options);
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

async function getGstRates(req, res) {
  try {
    const companyId = getCompanyId(req);
    const asOf = req.query.asOf || new Date();
    const listOptions = {
      limit: req.query.limit,
      order: req.query.order
    };
    const [rates, currentRate, nextRate] = await Promise.all([
      listGstRates(companyId, listOptions),
      getEffectiveGstRate(companyId, asOf),
      getNextScheduledGstRate(companyId, asOf)
    ]);
    res.json({ rates, currentRate, nextRate });
  } catch (error) {
    handleSettingsError(error, res, "Unable to load GST rates.");
  }
}

async function getNumberingActivity(req, res) {
  try {
    const companyId = getCompanyId(req);
    const result = await listNumberingActivityPage({
      page: req.query.page,
      pageSize: req.query.pageSize
    }, companyId);
    res.json(result);
  } catch (error) {
    handleSettingsError(error, res, "Unable to load numbering settings history.");
  }
}

async function postGstRate(req, res) {
  try {
    const companyId = getCompanyId(req);
    await createGstRate(req.body, companyId, {
      userId: req.user?.userId,
      email: req.user?.email,
      displayName: req.user?.name
    });
    await logAuditEvent({
      userId: req.user?.userId,
      userName: req.user?.email || "Admin",
      activityType: "Invoice GST",
      actionDescription: "Scheduled invoice GST rate",
      affectedRecord: String(req.body.effectiveFrom || req.body.effective_from || ""),
      status: "Success",
      previousValue: "",
      newValue: JSON.stringify(req.body),
      ipAddress: getClientIp(req)
    });
    return getGstRates(req, res);
  } catch (error) {
    handleSettingsError(error, res, "Unable to save GST rate.");
  }
}

module.exports = {
  getSettings,
  getGstRates,
  getNumberingActivity,
  postInvoiceLogo,
  postInvoicePreview,
  postGstRate,
  postTestInvoiceEmail,
  putSettings
};
