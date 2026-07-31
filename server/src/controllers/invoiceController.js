/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - SHARED
 * PURPOSE: Handles invoice Controller API requests, validation, status codes, and responses.
 * LAYER: Backend controller - validates HTTP input and returns the API response.
 * FIND RELATED CODE: Follow service/model calls to find business rules and database work.
 */
/**
 * Invoice Controller
 *
 * Core controller for invoice CRUD operations.
 * Handles invoice creation, retrieval, status management, scheduling, and sending.
 * All database operations use transactions for data integrity.
 * Integrates with fraud detection service on invoice creation.
 */

const { pool } = require("../config/db");
const { assessInvoiceRisk } = require("../services/fraudDetectionService");
const {
  assertInvoiceEmailTemplatesValid,
  sendInvoiceEmail
} = require("../services/invoiceDeliveryService");
const { getCompanyId } = require("../utils/companyScope");
const {
  calculateInvoiceLateFee,
  calculateDueDate,
  getInvoiceSettings,
  previewNextInvoiceNumber,
  reserveNextInvoiceNumber
} = require("../models/invoiceSettingsModel");
const { getEffectiveGstRate } = require("../models/invoiceGstRateModel");
const { calculateInvoiceTax } = require("../services/invoiceTaxCalculator");

/** Set of valid invoice statuses used throughout the application. */
const VALID_STATUSES = new Set(["Draft", "Scheduled", "Sent", "Viewed", "Paid", "Overdue", "Pending Review", "Void", "Cancelled", "Refunded"]);

/** Prefix used in audit_log entries for status change tracking. */
const STATUS_AUDIT_PREFIX = "invoice_status:";

/**
 * Convert any value to a safe 2-decimal currency number.
 * Returns 0 if the value is not a finite number.
 *
 * @param {*} value - The value to convert.
 * @returns {number} Rounded to 2 decimal places.
 */
function toCurrencyNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Number(numberValue.toFixed(2)) : 0;
}

/**
 * Generate the next sequential invoice number (INV-0001, INV-0002, etc.).
 * Parses the last used invoice ID and increments by 1.
 *
 * @param {string|null} lastInvoiceId - The most recent invoiceId from the database.
 * @returns {string} Next invoice number in INV-XXXX format.
 */
function buildNextInvoiceNumber(lastInvoiceId) {
  const match = String(lastInvoiceId || "").match(/^INV-(\d+)$/i);
  const nextNumber = match ? Number(match[1]) + 1 : 1;
  return `INV-${String(nextNumber).padStart(4, "0")}`;
}

/**
 * Normalize a status string to a valid database ENUM value.
 * Falls back to "Draft" if the status is not recognized.
 *
 * @param {string} status - The status to normalize.
 * @returns {string} A valid invoice status.
 */
function toDatabaseInvoiceStatus(status) {
  return VALID_STATUSES.has(status) ? status : "Draft";
}

/**
 * Determine the operational status of an invoice.
 * Prefers the latest audit log status over the raw database column,
 * ensuring the UI reflects the most recent status transition.
 *
 * @param {string} rowStatus - The status column from the invoice table.
 * @param {string|undefined} auditStatus - The latest status from the audit_log.
 * @returns {string} The effective operational status.
 */
function toOperationalInvoiceStatus(rowStatus, auditStatus) {
  if (auditStatus && VALID_STATUSES.has(auditStatus)) {
    return auditStatus;
  }

  if (VALID_STATUSES.has(rowStatus)) {
    return rowStatus;
  }

  return "Draft";
}

/**
 * Insert a record into the audit_log table.
 * Used to track all invoice operations for compliance and debugging.
 * Now includes previous_value, new_value, ip_address, and device_info.
 *
 * @param {Object} connection - MySQL connection (from pool.getConnection).
 * @param {string} action - The action performed (e.g. "invoice_created", "invoice_status:Sent").
 * @param {string} entityType - The entity type (e.g. "invoice", "payment").
 * @param {number|null} entityId - The primary key of the affected entity.
 * @param {number|null} userId - The user who performed the action.
 * @param {Object} [extra] - Additional audit data { previousValue, newValue, ipAddress, deviceInfo }.
 */
async function writeAuditLog(connection, action, entityType, entityId, userId, extra = {}) {
  try {
    await connection.query(
      `INSERT INTO audit_logs (user_id, module, activity_type, action_description, affected_record, status, created_at, previous_value, new_value, ip_address, device_info)
       VALUES (?, 'Invoice', ?, ?, ?, 'Success', NOW(), ?, ?, ?, ?)`,
      [
        userId || null,
        entityType,
        action,
        entityId ? String(entityId) : null,
        extra.previousValue || null,
        extra.newValue || null,
        extra.ipAddress || null,
        extra.deviceInfo || null
      ]
    );
  } catch {
    // Non-critical — don't block the operation if audit logging fails
  }
}

/**
 * Validate and normalize a date value.
 * Returns null if the value is not a parseable date.
 *
 * @param {*} value - The date value to normalize.
 * @returns {string|null} The normalized date string or null.
 */
function normalizeDate(value) {
  if (!value || Number.isNaN(Date.parse(value))) {
    return null;
  }

  return value;
}

/**
 * Validate the invoice creation/update payload.
 * Checks for required fields: customer_id, dates, and at least one valid line item.
 * Returns either an error message or the normalized invoice value.
 *
 * @param {Object} body - The request body.
 * @returns {Object} { error: string } on failure, { value: Object } on success.
 */
function validateInvoicePayload(body) {
  const customerId = Number(body.customer_id);
  const issueDate = normalizeDate(body.issue_date);
  const dueDate = normalizeDate(body.due_date);
  const items = Array.isArray(body.items) ? body.items : [];

  if (!customerId) {
    return { error: "Customer is required." };
  }

  if (!issueDate || !dueDate) {
    return { error: "Issue date and due date are required." };
  }

  if (items.length === 0) {
    return { error: "At least one invoice item is required." };
  }

  // Normalize line items: calculate amounts and validate fields
  const normalizedItems = items.map((item) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unit_price);
    const amount = toCurrencyNumber(quantity * unitPrice);

    return {
      description: String(item.description || "").trim(),
      quantity,
      unit_price: toCurrencyNumber(unitPrice),
      amount
    };
  });

  const hasInvalidItem = normalizedItems.some((item) =>
    !item.description ||
    !Number.isInteger(item.quantity) ||
    item.quantity <= 0 ||
    item.unit_price < 0
  );

  if (hasInvalidItem) {
    return {
      error: "Each invoice item requires a description, positive whole quantity, and valid unit price."
    };
  }

  return {
    value: {
      customer_id: customerId,
      issue_date: issueDate,
      due_date: dueDate,
      status: "Draft",
      items: normalizedItems,
      total_amount: toCurrencyNumber(
        normalizedItems.reduce((sum, item) => sum + item.amount, 0)
      )
    }
  };
}

/**
 * GET /api/invoices
 *
 * Retrieves all invoices with their line items and customer details.
 * Resolves the operational status from the audit log for accurate display.
 * Results sorted by creation date (newest first).
 *
 * Response: { invoices: [{ invoice_id, invoiceId, status, issue_date, due_date, total_amount, customer_name, items, ... }] }
 */
async function getInvoices(req, res) {
  try {
    const companyId = getCompanyId(req);
    const companyFilter = companyId ? "AND i.company_id = ?" : "";
    const params = companyId ? [companyId] : [];
    // Fetch all invoices joined with customer data
    const [rows] = await pool.query(`
      SELECT
        i.invoice_id,
        i.invoiceId,
        i.status,
        i.issue_date,
        i.due_date,
        i.subtotal_amount,
        i.tax_name,
        i.tax_rate,
        i.tax_amount,
        i.total_amount,
        i.customer_id,
        i.created_at,
        i.scheduled_at,
        c.name AS customer_name,
        c.email AS customer_email,
        c.address AS customer_address
      FROM invoice i
      INNER JOIN customer c ON c.customer_id = i.customer_id
      WHERE i.invoiceId <> '__SETTINGS__'
        ${companyFilter}
      ORDER BY i.created_at DESC, i.invoice_id DESC
    `, params);

    // Try to fetch payment columns (may not exist yet in older schemas)
    let paymentData = {};
    try {
      const [paymentRows] = await pool.query(`
        SELECT invoice_id, payment_url, qr_code_url, stripe_session_id,
               payment_intent_id, payment_status, payment_method,
               payment_date, transaction_id
        FROM invoice
        WHERE (payment_url IS NOT NULL OR payment_status IS NOT NULL)
          ${companyId ? "AND company_id = ?" : ""}
      `, companyId ? [companyId] : []);
      paymentRows.forEach((row) => {
        paymentData[row.invoice_id] = row;
      });
    } catch { /* columns not yet added — skip */ }

    const invoiceIds = rows.map((row) => row.invoice_id);
    let itemsByInvoiceId = {};
    let statusByInvoiceId = {};
    let sentAtByInvoiceId = {};
    const invoiceSettings = await getInvoiceSettings(companyId);

    if (invoiceIds.length > 0) {
      // Try loading items - attempt invoice_item table first, then items_json column
      try {
        const [itemRows] = await pool.query(
          "SELECT item_id, description, quantity, unit_price, amount, invoice_invoice_id FROM invoice_item WHERE invoice_invoice_id IN (?) ORDER BY item_id ASC",
          [invoiceIds]
        );
        itemsByInvoiceId = itemRows.reduce((acc, item) => {
          acc[item.invoice_invoice_id] = acc[item.invoice_invoice_id] || [];
          acc[item.invoice_invoice_id].push(item);
          return acc;
        }, {});
      } catch {
        // invoice_item table doesn't exist — skip
      }

      // For invoices without items from invoice_item, try items_json column
      const missingItemIds = invoiceIds.filter(id => !itemsByInvoiceId[id] || itemsByInvoiceId[id].length === 0);
      if (missingItemIds.length > 0) {
        try {
          const [itemRows] = await pool.query(
            "SELECT invoice_id, items_json FROM invoice WHERE invoice_id IN (?) AND items_json IS NOT NULL",
            [missingItemIds]
          );
          itemRows.forEach((row) => {
            try {
              const items = typeof row.items_json === "string" ? JSON.parse(row.items_json) : (row.items_json || []);
              if (items.length > 0) {
                itemsByInvoiceId[row.invoice_id] = items.map((item, idx) => ({
                  item_id: idx + 1,
                  description: item.description,
                  quantity: item.quantity,
                  unit_price: item.unit_price,
                  amount: item.amount,
                  invoice_invoice_id: row.invoice_id
                }));
              }
            } catch { itemsByInvoiceId[row.invoice_id] = []; }
          });
        } catch { /* items_json column may not exist */ }
      }

      // Resolve the latest operational status from audit_logs (note: table is audit_logs not audit_log)
      try {
        const [statusRows] = await pool.query(
          `SELECT al.entity_id, al.action_description AS action
           FROM audit_logs al
           WHERE al.activity_type = 'invoice'
             AND al.action_description LIKE ?
             AND al.affected_record IN (?)
           ORDER BY al.created_at DESC`,
          [`${STATUS_AUDIT_PREFIX}%`, invoiceIds.map(String)]
        );
        // Take the first (most recent) per entity
        statusRows.forEach((row) => {
          const entityId = Number(row.entity_id || row.affected_record);
          if (!statusByInvoiceId[entityId]) {
            statusByInvoiceId[entityId] = String(row.action || "").replace(STATUS_AUDIT_PREFIX, "");
          }
        });
      } catch {
        // audit_logs schema may differ — skip status resolution, use row.status directly
      }

      try {
        const [sentRows] = await pool.query(
          `SELECT CAST(affected_record AS UNSIGNED) AS invoice_id, MIN(created_at) AS sent_at
           FROM audit_logs
           WHERE action_description IN ('invoice_sent', 'scheduled_invoice_sent')
             AND CAST(affected_record AS UNSIGNED) IN (?)
           GROUP BY CAST(affected_record AS UNSIGNED)`,
          [invoiceIds]
        );
        sentAtByInvoiceId = sentRows.reduce((items, sentRow) => {
          items[Number(sentRow.invoice_id)] = sentRow.sent_at;
          return items;
        }, {});
      } catch {
        // Older audit schemas may not expose invoice send events.
      }
    }

    // Map results with resolved status and attached items
    res.json({
      invoices: rows.map((row) => {
        const payment = paymentData[row.invoice_id] || {};
        const status = toOperationalInvoiceStatus(row.status, statusByInvoiceId[row.invoice_id]);
        const lateFee = calculateInvoiceLateFee({ ...row, status }, invoiceSettings);
        return {
          ...row,
          database_status: row.status,
          status,
          total_amount: toCurrencyNumber(row.total_amount),
          late_fee_rate: lateFee.lateFeeRate,
          late_fee_amount: lateFee.lateFeeAmount,
          amount_due: lateFee.amountDue,
          items: itemsByInvoiceId[row.invoice_id] || [],
          payment_url: payment.payment_url || null,
          qr_code_url: payment.qr_code_url || null,
          stripe_session_id: payment.stripe_session_id || null,
          payment_intent_id: payment.payment_intent_id || null,
          payment_status: payment.payment_status || null,
          payment_method: payment.payment_method || null,
          payment_date: payment.payment_date || null,
          transaction_id: payment.transaction_id || null,
          sent_at: sentAtByInvoiceId[row.invoice_id] || row.created_at || null
        };
      })
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch invoices.",
      detail: error.message
    });
  }
}

/**
 * GET /api/invoices/customers
 *
 * Retrieves all customers for the invoice creation dropdown.
 * Lightweight query returning only id, name, email, address.
 */
async function getCustomers(req, res) {
  try {
    const companyId = getCompanyId(req);
    const [rows] = await pool.query(`
      SELECT customer_id, name, email, address
      FROM customer
      ${companyId ? "WHERE company_id = ?" : ""}
      ORDER BY name ASC
    `, companyId ? [companyId] : []);

    res.json({ customers: rows });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch customers.",
      detail: error.message
    });
  }
}

/**
 * GET /api/invoices/next-number
 *
 * Calculates and returns the next available invoice number.
 * Looks at the highest existing INV-XXXX number and increments.
 *
 * Response: { invoiceId: "INV-0033" }
 */
async function getNextInvoiceNumber(req, res) {
  try {
    const companyId = getCompanyId(req);
    const issueDate = normalizeDate(req.query.issueDate) || new Date();
    const previewDate = new Date(issueDate);
    const preview = await previewNextInvoiceNumber(previewDate, companyId);
    const currentGstRate = await getEffectiveGstRate(companyId, issueDate);

    res.json({
      invoiceId: preview.invoiceId,
      defaultDueDate: calculateDueDate(preview.settings),
      paymentTerms: preview.settings.paymentTerms,
      currentGstRate,
      settings: preview.settings
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to calculate next invoice number.",
      detail: error.message
    });
  }
}

/**
 * POST /api/invoices
 *
 * Creates a new invoice with line items.
 * Uses a database transaction to ensure atomicity.
 * Generates a sequential invoice number (INV-XXXX) using row-level locking.
 * Triggers fraud risk assessment after creation.
 * Writes audit logs for creation and initial status.
 *
 * Request body: { customer_id, issue_date, due_date, items: [{ description, quantity, unit_price }] }
 * Success response: 201 with { invoice: { invoice_id, invoiceId, status, total_amount } }
 */
async function createInvoice(req, res) {
  const validation = validateInvoicePayload(req.body);

  if (validation.error) {
    return res.status(400).json({ message: validation.error });
  }

  const invoice = validation.value;
  const companyId = getCompanyId(req);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (companyId) {
      const [customerRows] = await connection.query(
        "SELECT customer_id FROM customer WHERE customer_id = ? AND company_id = ? LIMIT 1",
        [invoice.customer_id, companyId]
      );
      if (!customerRows.length) {
        await connection.rollback();
        return res.status(400).json({ message: "Customer is not available for this company." });
      }
    }

    const [effectiveGstRate, invoiceSettings] = await Promise.all([
      getEffectiveGstRate(companyId, invoice.issue_date),
      getInvoiceSettings(companyId)
    ]);
    const subtotalAmount = invoice.total_amount;
    const taxRate = Number(effectiveGstRate?.ratePercentage || 0);
    const taxInclusive = invoiceSettings.taxInclusive || invoiceSettings.general?.priceDisplay === "tax_inclusive";
    const configuredDueDate = calculateDueDate(invoiceSettings, invoice.issue_date);
    const { taxAmount, totalAmount } = calculateInvoiceTax({
      subtotal: subtotalAmount,
      taxRate,
      taxInclusive
    });

    // Lock and advance the canonical settings sequence in this invoice transaction.
    const { invoiceId } = await reserveNextInvoiceNumber(connection, new Date(invoice.issue_date), companyId);

    // Insert invoice header
    const [invoiceResult] = await connection.query(
      `
        INSERT INTO invoice
          (status, issue_date, due_date, invoiceId, total_amount, customer_id, company_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `,
      [
        "Draft",
        invoice.issue_date,
        configuredDueDate,
        invoiceId,
        totalAmount,
        invoice.customer_id,
        companyId
      ]
    );

    const invoicePrimaryId = invoiceResult.insertId;

    try {
      await connection.query(
        `UPDATE invoice
         SET subtotal_amount = ?, tax_name = ?, tax_rate = ?, tax_amount = ?
         WHERE invoice_id = ?`,
        [
          subtotalAmount,
          effectiveGstRate?.taxName || "GST",
          taxRate,
          taxAmount,
          invoicePrimaryId
        ]
      );
    } catch {
      // Older schemas can still store the GST-inclusive total; migration adds explicit tax columns.
    }

    // Store line items in items_json column on the invoice table
    await connection.query(
      "UPDATE invoice SET items_json = ? WHERE invoice_id = ?",
      [JSON.stringify(invoice.items), invoicePrimaryId]
    );

    // Also try to insert into invoice_item table (may not exist)
    try {
      const itemValues = invoice.items.map((item) => [
        item.description,
        item.quantity,
        item.unit_price,
        item.amount,
        invoicePrimaryId
      ]);

      await connection.query(
        `INSERT INTO invoice_item (description, quantity, unit_price, amount, invoice_invoice_id) VALUES ?`,
        [itemValues]
      );
    } catch { /* invoice_item table may not exist — items stored in items_json */ }

    // Audit trail: record creation and initial status
    await writeAuditLog(
      connection,
      `${STATUS_AUDIT_PREFIX}Draft`,
      "invoice",
      invoicePrimaryId,
      req.user?.userId
    );
    await writeAuditLog(connection, "invoice_created", "invoice", invoicePrimaryId, req.user?.userId);

    // Run fraud risk assessment on the new invoice
    await assessInvoiceRisk(connection, invoicePrimaryId, {
      vendor_name: req.body.vendor_name,
      bank_account: req.body.bank_account,
      source: "single_invoice"
    });

    await connection.commit();

    // Notify Finance that draft was saved (non-blocking)
    const { notifyDraftSaved } = require("../services/invoiceNotificationService");
    notifyDraftSaved(invoiceId, req.user?.userId).catch(() => {});

    res.status(201).json({
      message: "Invoice created successfully.",
      invoice: {
        invoice_id: invoicePrimaryId,
        invoiceId,
        status: "Draft",
        subtotal_amount: subtotalAmount,
        tax_name: effectiveGstRate?.taxName || "GST",
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total_amount: totalAmount
      }
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({
      message: "Failed to create invoice.",
      detail: error.message
    });
  } finally {
    connection.release();
  }
}

/**
 * POST /api/invoices/:id/send
 *
 * Sends an invoice to the customer via email.
 * Updates the invoice status from Draft/Scheduled to "Sent".
 * Clears any scheduled_at timestamp.
 * Prevents re-sending of already-paid invoices.
 *
 * URL param: id (invoice primary key)
 * Success response: { message, invoice_id, status: "Sent" }
 */
async function sendInvoice(req, res) {
  const invoiceId = Number(req.params.id);
  const companyId = getCompanyId(req);

  if (!invoiceId) {
    return res.status(400).json({ message: "Invalid invoice id." });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Lock invoice row and fetch details for email
    const [rows] = await connection.query(
      `
        SELECT
          i.invoice_id,
          i.invoiceId,
          i.status,
          i.company_id,
          i.total_amount,
          i.due_date,
          i.customer_id,
          c.name AS customer_name,
          c.email AS customer_email,
          c.address AS customer_address
        FROM invoice i
        INNER JOIN customer c ON c.customer_id = i.customer_id
        WHERE i.invoice_id = ?
          ${companyId ? "AND i.company_id = ?" : ""}
        LIMIT 1
        FOR UPDATE
      `,
      companyId ? [invoiceId, companyId] : [invoiceId]
    );

    const invoice = rows[0];
    if (!invoice) {
      await connection.rollback();
      return res.status(404).json({ message: "Invoice not found." });
    }

    if (["Paid", "Void", "Cancelled", "Refunded"].includes(invoice.status)) {
      await connection.rollback();
      return res.status(400).json({ message: `${invoice.status} invoices cannot be sent.` });
    }

    // Fetch line items for PDF
    let items = [];
    try {
      const [itemRows] = await connection.query(
        "SELECT description, quantity, unit_price, amount FROM invoice_item WHERE invoice_invoice_id = ?",
        [invoiceId]
      );
      items = itemRows;
    } catch { /* invoice_item table may not exist */ }
    invoice.items = items;

    // If no items from invoice_item, try items_json
    if (!invoice.items || invoice.items.length === 0) {
      try {
        const [jsonRows] = await connection.query(
          "SELECT items_json FROM invoice WHERE invoice_id = ?",
          [invoiceId]
        );
        if (jsonRows[0]?.items_json) {
          const parsed = typeof jsonRows[0].items_json === "string"
            ? JSON.parse(jsonRows[0].items_json)
            : jsonRows[0].items_json;
          invoice.items = Array.isArray(parsed) ? parsed : [];
        }
      } catch { /* non-critical */ }
    }

    // Load Admin settings to determine which payment methods to enable
    const { getInvoiceSettings, defaultSettings: invoiceDefaults } = require("../models/invoiceSettingsModel");
    const adminSettings = (await getInvoiceSettings(companyId)) || invoiceDefaults;
    assertInvoiceEmailTemplatesValid(adminSettings);

    // Create Stripe Checkout Session (only if online payments enabled)
    const { createCheckoutSession } = require("../services/stripeService");
    const stripeResult = await createCheckoutSession(invoice);
    const paymentUrl = stripeResult.paymentUrl;
    const sessionId = stripeResult.sessionId;

    // Generate QR Code (only if Admin has enabled QR display)
    const { generateQRCode } = require("../services/qrCodeService");
    let qrCodeDataUri = null;
    if (adminSettings.qrCodeDisplay !== false) {
      qrCodeDataUri = await generateQRCode(paymentUrl);
    }

    // Store payment URL and QR code in invoice record
    try {
      await connection.query(
        "UPDATE invoice SET payment_url = ?, qr_code_url = ?, stripe_session_id = ? WHERE invoice_id = ?",
        [paymentUrl, qrCodeDataUri, sessionId, invoiceId]
      );
    } catch (colError) {
      // Columns may not exist yet — non-blocking
      console.log("[SEND] Payment URL columns not available:", colError.code);
    }

    // Generate PDF with payment URL and QR code
    const { generateInvoicePDF } = require("../services/pdfService");
    let pdfBuffer = null;
    try {
      pdfBuffer = await generateInvoicePDF(invoice, { paymentUrl, qrCodeDataUri });
    } catch (pdfError) {
      console.error("[SEND] PDF generation failed:", pdfError.message);
    }

    // Send invoice via email service with PDF attachment
    const delivery = await sendInvoiceEmail(invoice, {
      pdfBuffer,
      paymentUrl,
      qrCodeDataUri
    });

    // Update status to Sent and clear schedule
    await connection.query(
      "UPDATE invoice SET status = 'Sent', scheduled_at = NULL WHERE invoice_id = ?",
      [invoiceId]
    );
    await writeAuditLog(connection, `${STATUS_AUDIT_PREFIX}Sent`, "invoice", invoiceId, req.user?.userId, {
      previousValue: invoice.status,
      newValue: "Sent"
    });
    await writeAuditLog(connection, "invoice_sent", "invoice", invoiceId, req.user?.userId, {
      newValue: JSON.stringify({ ...delivery, emailType: "Invoice Issued", triggerSource: "Finance" })
    });

    await connection.commit();

    // Notify Finance (non-blocking)
    const { notifyInvoiceSent } = require("../services/invoiceNotificationService");
    notifyInvoiceSent(invoice.invoiceId, invoice.customer_name, req.user?.userId).catch(() => {});

    // WhatsApp auto-trigger: Invoice Sent (non-blocking)
    const { onInvoiceSent } = require("../services/whatsappAutoTrigger");
    onInvoiceSent({ invoice_id: invoiceId, invoiceId: invoice.invoiceId, total_amount: invoice.total_amount, due_date: invoice.due_date, customer_id: invoice.customer_id, payment_url: paymentUrl }).catch(() => {});

    res.json({
      message: "Invoice sent.",
      invoice_id: invoiceId,
      status: "Sent",
      payment_url: paymentUrl,
      qr_code: qrCodeDataUri ? true : false
    });
  } catch (error) {
    await connection.rollback();
    console.error("[SEND INVOICE] Error:", error.message, error.code, error.type);
    // Attempt audit log — may fail if connection is in a bad state
    try {
      await writeAuditLog(connection, "invoice_email_failed", "invoice", invoiceId, req.user?.userId, {
        newValue: JSON.stringify({ emailType: "Invoice Issued", message: error.message, errorCode: error.code, triggerSource: "Finance" })
      });
    } catch { /* non-critical */ }
    if (error.code === "INVALID_INVOICE_EMAIL_TEMPLATE") {
      return res.status(400).json({
        code: error.code,
        message: error.message,
        errors: error.validationErrors || []
      });
    }
    res.status(500).json({
      message: "Failed to send invoice.",
      detail: error.message
    });
  } finally {
    connection.release();
  }
}

/**
 * PUT /api/invoices/:id/status
 *
 * Updates an invoice status directly. Used by admin/finance invoice workflows
 * for state transitions that do not need the email-delivery side effects of
 * POST /api/invoices/:id/send.
 */
async function updateInvoiceStatus(req, res) {
  const invoiceId = Number(req.params.id);
  const companyId = getCompanyId(req);
  const status = String(req.body?.status || "").trim();

  if (!invoiceId) {
    return res.status(400).json({ message: "Invalid invoice id." });
  }

  if (!VALID_STATUSES.has(status)) {
    return res.status(400).json({ message: "Invalid invoice status." });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT invoice_id, invoiceId, status
       FROM invoice
       WHERE invoice_id = ?
         ${companyId ? "AND company_id = ?" : ""}
       LIMIT 1
       FOR UPDATE`,
      companyId ? [invoiceId, companyId] : [invoiceId]
    );

    const invoice = rows[0];
    if (!invoice) {
      await connection.rollback();
      return res.status(404).json({ message: "Invoice not found." });
    }

    await connection.query(
      "UPDATE invoice SET status = ?, scheduled_at = CASE WHEN ? = 'Sent' THEN NULL ELSE scheduled_at END WHERE invoice_id = ?",
      [status, status, invoiceId]
    );

    await writeAuditLog(connection, `${STATUS_AUDIT_PREFIX}${status}`, "invoice", invoiceId, req.user?.userId, {
      previousValue: invoice.status,
      newValue: status
    });

    await connection.commit();

    res.json({
      message: "Invoice status updated.",
      invoice_id: invoiceId,
      invoiceId: invoice.invoiceId,
      status
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({
      message: "Failed to update invoice status.",
      detail: error.message
    });
  } finally {
    connection.release();
  }
}

/**
 * PATCH /api/invoices/:id/void
 * Retains an officially-created invoice for audit while removing it from active totals.
 */
async function voidInvoice(req, res) {
  const invoiceId = Number(req.params.id);
  const companyId = getCompanyId(req);
  const reason = String(req.body?.reason || "").trim();
  if (!invoiceId) return res.status(400).json({ message: "Invalid invoice id." });
  if (!reason) return res.status(400).json({ message: "A void reason is required." });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT status, invoiceId FROM invoice WHERE invoice_id = ? ${companyId ? "AND company_id = ?" : ""} LIMIT 1 FOR UPDATE`,
      companyId ? [invoiceId, companyId] : [invoiceId]
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ message: "Invoice not found." });
    }
    if (rows[0].status === "Void") {
      await connection.rollback();
      return res.status(400).json({ message: "Invoice is already void." });
    }

    await connection.query(
      `UPDATE invoice
       SET status = 'Void', void_reason = ?, voided_by = ?, voided_at = NOW()
       WHERE invoice_id = ?`,
      [reason, req.user?.userId || null, invoiceId]
    );
    await writeAuditLog(connection, `${STATUS_AUDIT_PREFIX}Void`, "invoice", invoiceId, req.user?.userId, {
      previousValue: rows[0].status,
      newValue: JSON.stringify({ status: "Void", reason })
    });
    await writeAuditLog(connection, "invoice_voided", "invoice", invoiceId, req.user?.userId, {
      newValue: JSON.stringify({ reason })
    });
    await connection.commit();
    res.json({ message: "Invoice voided and retained for audit.", invoice_id: invoiceId, status: "Void" });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: "Failed to void invoice.", detail: error.message });
  } finally {
    connection.release();
  }
}

/**
 * Validate and parse a scheduled_at timestamp.
 * Returns null if the value is not a valid date.
 *
 * @param {*} value - The timestamp value.
 * @returns {Date|null} Parsed Date object or null.
 */
function normalizeScheduledAt(value) {
  if (!value || Number.isNaN(Date.parse(value))) {
    return null;
  }

  return new Date(value);
}

/**
 * POST /api/invoices/schedule
 *
 * Schedules one or more Draft invoices for automatic future sending.
 * The background invoice scheduler worker picks these up when the time arrives.
 * Only Draft invoices can be scheduled.
 *
 * Request body: { invoice_ids: number[], scheduled_at: string (ISO datetime) }
 * Validation: scheduled_at must be in the future; all IDs must exist and be Draft.
 * Success response: { message, scheduledCount, scheduled_at }
 */
async function scheduleInvoices(req, res) {
  const invoiceIds = Array.isArray(req.body.invoice_ids)
    ? [...new Set(req.body.invoice_ids.map((id) => Number(id)).filter(Boolean))]
    : [];
  const scheduledAt = normalizeScheduledAt(req.body.scheduled_at);

  if (invoiceIds.length === 0) {
    return res.status(400).json({ message: "At least one invoice id is required." });
  }

  if (!scheduledAt) {
    return res.status(400).json({ message: "A valid scheduled_at timestamp is required." });
  }

  if (scheduledAt.getTime() <= Date.now()) {
    return res.status(400).json({ message: "Schedule time must be in the future." });
  }

  const connection = await pool.getConnection();
  const companyId = getCompanyId(req);

  try {
    await connection.beginTransaction();

    // Lock all target invoices and verify they exist
    const [existingInvoices] = await connection.query(
      `SELECT invoice_id, status FROM invoice WHERE invoice_id IN (?) ${companyId ? "AND company_id = ?" : ""} FOR UPDATE`,
      companyId ? [invoiceIds, companyId] : [invoiceIds]
    );
    const existingIds = existingInvoices.map((invoice) => Number(invoice.invoice_id));

    if (existingIds.length !== invoiceIds.length) {
      await connection.rollback();
      return res.status(404).json({ message: "One or more invoices were not found." });
    }

    // Ensure all invoices are in Draft status
    const unschedulableInvoice = existingInvoices.find((invoice) => invoice.status !== "Draft");
    if (unschedulableInvoice) {
      await connection.rollback();
      return res.status(400).json({ message: "Only draft invoices can be scheduled." });
    }

    // Batch-update status and scheduled_at
    await connection.query(
      "UPDATE invoice SET status = 'Scheduled', scheduled_at = ? WHERE invoice_id IN (?)",
      [scheduledAt, invoiceIds]
    );

    // Write audit logs for each scheduled invoice
    const statusByInvoiceId = new Map(existingInvoices.map((invoice) => [Number(invoice.invoice_id), invoice.status]));
    for (const invoiceId of invoiceIds) {
      await writeAuditLog(
        connection,
        `${STATUS_AUDIT_PREFIX}Scheduled`,
        "invoice",
        invoiceId,
        req.user?.userId,
        {
          previousValue: statusByInvoiceId.get(Number(invoiceId)) || "Draft",
          newValue: "Scheduled"
        }
      );
      await writeAuditLog(
        connection,
        `invoice_scheduled:${scheduledAt.toISOString()}`,
        "invoice",
        invoiceId,
        req.user?.userId
      );
    }

    await connection.commit();

    res.json({
      message: "Invoices scheduled successfully.",
      scheduledCount: invoiceIds.length,
      scheduled_at: scheduledAt.toISOString()
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({
      message: "Failed to schedule invoices.",
      detail: error.message
    });
  } finally {
    connection.release();
  }
}

module.exports = {
  buildNextInvoiceNumber,
  createInvoice,
  getCustomers,
  getInvoices,
  getNextInvoiceNumber,
  scheduleInvoices,
  sendInvoice,
  updateInvoiceStatus,
  voidInvoice,
  toCurrencyNumber,
  STATUS_AUDIT_PREFIX,
  toDatabaseInvoiceStatus,
  toOperationalInvoiceStatus,
  validateInvoicePayload,
  writeAuditLog
};
