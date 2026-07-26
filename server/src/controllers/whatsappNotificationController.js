/**
 * WhatsApp Notification Controller
 *
 * Thin controller layer for WhatsApp notification API endpoints.
 * Delegates business logic to whatsappService and whatsappNotificationModel.
 *
 * Endpoints:
 *   GET    /api/whatsapp-notifications/settings       — Get notification settings
 *   PUT    /api/whatsapp-notifications/settings       — Update notification settings
 *   POST   /api/whatsapp-notifications/send           — Send a manual notification
 *   GET    /api/whatsapp-notifications/logs           — Get notification logs (paginated)
 *   POST   /api/whatsapp-notifications/test           — Send a test message
 *   GET    /api/whatsapp-notifications/dashboard      — Dashboard stats + recent logs
 *   POST   /api/customers/:id/verify-whatsapp         — Verify customer WhatsApp
 *   PUT    /api/customers/:id/whatsapp                — Update customer WhatsApp number
 */

const notificationModel = require("../models/whatsappNotificationModel");
const whatsappService = require("../services/whatsappService");
const templateModel = require("../models/whatsappTemplateModel");
const { pool } = require("../config/db");

// ─── Settings ─────────────────────────────────────────────────────────────────

/**
 * GET /api/whatsapp-notifications/settings
 */
async function getSettings(req, res) {
  try {
    const settings = await notificationModel.getSettings();
    if (!settings) {
      return res.json({
        whatsapp_enabled: false,
        send_invoice_created: true,
        send_payment_received: true,
        send_payment_reminder: true,
        send_overdue_notice: true,
        send_subscription_invoice: true,
        reminder_days_before: [7, 3, 1]
      });
    }
    res.json(settings);
  } catch (error) {
    console.error("[WHATSAPP] Failed to fetch settings:", error.message);
    res.status(500).json({ message: "Failed to fetch notification settings." });
  }
}

/**
 * PUT /api/whatsapp-notifications/settings
 */
async function updateSettings(req, res) {
  try {
    const {
      whatsapp_enabled,
      send_invoice_created,
      send_payment_received,
      send_payment_reminder,
      send_overdue_notice,
      send_subscription_invoice,
      reminder_days_before
    } = req.body;

    const updated = await notificationModel.updateSettings({
      whatsapp_enabled,
      send_invoice_created,
      send_payment_received,
      send_payment_reminder,
      send_overdue_notice,
      send_subscription_invoice,
      reminder_days_before
    });

    res.json({ message: "Notification settings updated successfully.", settings: updated });
  } catch (error) {
    console.error("[WHATSAPP] Failed to update settings:", error.message);
    res.status(500).json({ message: "Failed to update notification settings." });
  }
}

// ─── Manual Send ──────────────────────────────────────────────────────────────

/**
 * POST /api/whatsapp-notifications/send
 *
 * Body: { customer_id, invoice_id, notification_type }
 * Sends a specific notification type to a customer for a given invoice.
 */
async function sendNotification(req, res) {
  try {
    const { customer_id, invoice_id, notification_type } = req.body;

    if (!customer_id || !invoice_id || !notification_type) {
      return res.status(400).json({ message: "customer_id, invoice_id, and notification_type are required." });
    }

    const validTypes = ["invoice_created", "payment_received", "payment_reminder", "overdue_notice", "subscription_invoice"];
    if (!validTypes.includes(notification_type)) {
      return res.status(400).json({ message: `Invalid notification_type. Must be one of: ${validTypes.join(", ")}` });
    }

    // Check settings
    const settings = await notificationModel.getSettings();
    if (!settings || !settings.whatsapp_enabled) {
      return res.status(400).json({ message: "WhatsApp notifications are disabled. Enable them in settings first." });
    }

    // Get customer WhatsApp number
    const customer = await notificationModel.getCustomerWithWhatsApp(customer_id);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
    }
    if (!customer.whatsapp_number) {
      return res.status(400).json({ message: "Customer does not have a WhatsApp number configured." });
    }

    // Get invoice details
    const [invoiceRows] = await pool.query(
      `SELECT i.invoice_id, i.invoiceId, i.total_amount, i.due_date, i.status, i.payment_url
       FROM invoice i WHERE i.invoice_id = ? LIMIT 1`,
      [invoice_id]
    );
    if (invoiceRows.length === 0) {
      return res.status(404).json({ message: "Invoice not found." });
    }
    const invoice = invoiceRows[0];

    // Send based on type
    let result;
    const baseParams = {
      phone: customer.whatsapp_number,
      invoiceNumber: invoice.invoiceId,
      amount: invoice.total_amount,
      customerId: customer.customer_id,
      invoiceId: invoice.invoice_id
    };

    switch (notification_type) {
      case "invoice_created":
        result = await whatsappService.sendInvoiceCreated({
          ...baseParams,
          customerName: customer.name,
          dueDate: invoice.due_date,
          paymentLink: invoice.payment_url || null
        });
        break;
      case "payment_received":
        result = await whatsappService.sendPaymentReceived(baseParams);
        break;
      case "payment_reminder":
        result = await whatsappService.sendPaymentReminder({
          ...baseParams,
          dueDate: invoice.due_date
        });
        break;
      case "overdue_notice":
        result = await whatsappService.sendOverdueNotice(baseParams);
        break;
      case "subscription_invoice":
        result = await whatsappService.sendSubscriptionInvoice({
          ...baseParams,
          customerName: customer.name,
          billingPeriod: "Current Period",
          dueDate: invoice.due_date
        });
        break;
      default:
        return res.status(400).json({ message: "Unsupported notification type." });
    }

    if (result.success) {
      res.json({ message: "Notification sent successfully.", logId: result.logId, messageId: result.messageId });
    } else {
      res.status(422).json({ message: "Notification failed to send.", error: result.error, logId: result.logId });
    }
  } catch (error) {
    console.error("[WHATSAPP] Send notification error:", error.message);
    res.status(500).json({ message: "Failed to send notification.", detail: error.message });
  }
}

// ─── Logs ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/whatsapp-notifications/logs
 *
 * Query params: page, limit, search, notification_type, status, sort_by, sort_order
 */
async function getLogs(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      notification_type = "",
      status = "",
      sort_by = "created_at",
      sort_order = "DESC"
    } = req.query;

    const result = await notificationModel.getLogs({
      page: Number(page),
      limit: Number(limit),
      search,
      notification_type,
      status,
      sort_by,
      sort_order
    });

    res.json(result);
  } catch (error) {
    console.error("[WHATSAPP] Failed to fetch logs:", error.message);
    res.status(500).json({ message: "Failed to fetch notification logs." });
  }
}

// ─── Test ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/whatsapp-notifications/test
 *
 * Body: { phone }
 * Sends a test message to verify WhatsApp integration.
 */
async function sendTest(req, res) {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: "Phone number is required." });
    }

    const result = await whatsappService.sendTestNotification(phone);

    if (result.success) {
      res.json({ message: "Test message sent successfully.", provider: result.provider, messageId: result.messageId });
    } else {
      res.status(422).json({ message: "Test message failed.", error: result.error });
    }
  } catch (error) {
    console.error("[WHATSAPP] Test send error:", error.message);
    res.status(500).json({ message: "Failed to send test message.", detail: error.message });
  }
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

/**
 * GET /api/whatsapp-notifications/dashboard
 *
 * Returns stats and recent notification logs for dashboard widgets.
 */
async function getDashboard(req, res) {
  try {
    const [stats, recentLogs] = await Promise.all([
      notificationModel.getDashboardStats(),
      notificationModel.getRecentLogs(10)
    ]);

    res.json({ stats, recentLogs });
  } catch (error) {
    console.error("[WHATSAPP] Dashboard error:", error.message);
    res.status(500).json({ message: "Failed to load dashboard data." });
  }
}

// ─── Customer WhatsApp Management ─────────────────────────────────────────────

/**
 * PUT /api/customers/:id/whatsapp
 *
 * Body: { whatsapp_number }
 * Updates the WhatsApp number for a customer.
 */
async function updateCustomerWhatsApp(req, res) {
  try {
    const customerId = Number(req.params.id);
    const { whatsapp_number } = req.body;

    if (!customerId) {
      return res.status(400).json({ message: "Customer ID is required." });
    }

    if (!whatsapp_number) {
      return res.status(400).json({ message: "WhatsApp number is required." });
    }

    // Validate format
    const validation = whatsappService.validatePhoneNumber(whatsapp_number);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.error });
    }

    const updated = await notificationModel.updateCustomerWhatsApp(customerId, validation.number);
    if (!updated) {
      return res.status(404).json({ message: "Customer not found." });
    }

    res.json({ message: "WhatsApp number updated successfully.", whatsapp_number: validation.number });
  } catch (error) {
    console.error("[WHATSAPP] Update customer WhatsApp error:", error.message);
    res.status(500).json({ message: "Failed to update WhatsApp number." });
  }
}

/**
 * POST /api/customers/:id/verify-whatsapp
 *
 * Sends a verification test message and marks the number as verified on success.
 */
async function verifyCustomerWhatsApp(req, res) {
  try {
    const customerId = Number(req.params.id);

    const customer = await notificationModel.getCustomerWithWhatsApp(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
    }

    if (!customer.whatsapp_number) {
      return res.status(400).json({ message: "Customer does not have a WhatsApp number. Add one first." });
    }

    // Send a test message to verify
    const result = await whatsappService.sendTestNotification(customer.whatsapp_number);

    if (result.success) {
      await notificationModel.verifyCustomerWhatsApp(customerId);
      res.json({ message: "WhatsApp number verified successfully.", verified: true });
    } else {
      res.status(422).json({ message: "Verification failed. Could not send test message.", error: result.error, verified: false });
    }
  } catch (error) {
    console.error("[WHATSAPP] Verify customer WhatsApp error:", error.message);
    res.status(500).json({ message: "Failed to verify WhatsApp number." });
  }
}

/**
 * GET /api/customers/:id/whatsapp
 *
 * Returns the WhatsApp info for a customer.
 */
async function getCustomerWhatsApp(req, res) {
  try {
    const customerId = Number(req.params.id);
    const customer = await notificationModel.getCustomerWithWhatsApp(customerId);

    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
    }

    res.json({
      customer_id: customer.customer_id,
      name: customer.name,
      whatsapp_number: customer.whatsapp_number || null,
      whatsapp_verified: Boolean(customer.whatsapp_verified)
    });
  } catch (error) {
    console.error("[WHATSAPP] Get customer WhatsApp error:", error.message);
    res.status(500).json({ message: "Failed to fetch customer WhatsApp info." });
  }
}

// ─── Connection Test ──────────────────────────────────────────────────────────

/**
 * POST /api/whatsapp-notifications/test-connection
 * Tests the Twilio API connection without sending a message.
 */
async function testConnection(req, res) {
  try {
    const result = await whatsappService.testConnection();
    if (result.success) {
      res.json({ message: "Connection successful.", accountName: result.accountName, status: result.status });
    } else {
      res.status(422).json({ message: "Connection failed.", error: result.error });
    }
  } catch (error) {
    console.error("[WHATSAPP] Test connection error:", error.message);
    res.status(500).json({ message: "Failed to test connection.", detail: error.message });
  }
}

// ─── Send Invoice via WhatsApp ────────────────────────────────────────────────

/**
 * POST /api/whatsapp-notifications/send-invoice/:invoiceId
 * Sends the invoice to the customer via WhatsApp with optional PDF attachment.
 */
async function sendInvoiceWhatsApp(req, res) {
  try {
    const invoiceId = Number(req.params.invoiceId);
    const { send_pdf = false } = req.body;

    if (!invoiceId) {
      return res.status(400).json({ message: "Invoice ID is required." });
    }

    // Check settings
    const settings = await notificationModel.getSettings();
    if (!settings || !settings.whatsapp_enabled) {
      return res.status(400).json({ message: "WhatsApp notifications are disabled." });
    }

    // Get invoice + customer
    const [invoiceRows] = await pool.query(
      `SELECT i.invoice_id, i.invoiceId, i.total_amount, i.due_date, i.status, i.payment_url, i.customer_id
       FROM invoice i WHERE i.invoice_id = ? LIMIT 1`,
      [invoiceId]
    );
    if (invoiceRows.length === 0) {
      return res.status(404).json({ message: "Invoice not found." });
    }
    const invoice = invoiceRows[0];

    const customer = await notificationModel.getCustomerWithWhatsApp(invoice.customer_id);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
    }
    if (!customer.whatsapp_number) {
      return res.status(400).json({ message: "Customer does not have a WhatsApp number." });
    }

    const shouldSendPdf = send_pdf || Boolean(settings.send_pdf_attachments);

    const result = await whatsappService.sendInvoiceCreated({
      customerName: customer.name,
      phone: customer.whatsapp_number,
      invoiceNumber: invoice.invoiceId,
      amount: invoice.total_amount,
      dueDate: invoice.due_date,
      paymentLink: invoice.payment_url || null,
      customerId: customer.customer_id,
      invoiceId: invoice.invoice_id,
      sendPdf: shouldSendPdf
    });

    if (result.success) {
      res.json({ message: "Invoice sent via WhatsApp.", logId: result.logId, messageId: result.messageId });
    } else {
      res.status(422).json({ message: "Failed to send invoice via WhatsApp.", error: result.error, logId: result.logId });
    }
  } catch (error) {
    console.error("[WHATSAPP] Send invoice error:", error.message);
    res.status(500).json({ message: "Failed to send invoice via WhatsApp.", detail: error.message });
  }
}


// ─── Communication History ────────────────────────────────────────────────────

/**
 * GET /api/whatsapp-notifications/history/:invoiceId
 * Returns WhatsApp communication history for a specific invoice.
 */
async function getInvoiceCommunicationHistory(req, res) {
  try {
    const invoiceId = Number(req.params.invoiceId);
    if (!invoiceId) {
      return res.status(400).json({ message: "Invoice ID is required." });
    }

    const logs = await notificationModel.getLogsByInvoiceId(invoiceId);
    res.json({ logs });
  } catch (error) {
    console.error("[WHATSAPP] Communication history error:", error.message);
    res.status(500).json({ message: "Failed to fetch communication history." });
  }
}

// ─── Twilio Webhook ───────────────────────────────────────────────────────────

/**
 * POST /api/whatsapp-notifications/webhook/status
 * Twilio delivery status callback endpoint.
 * No authentication required (validated by Twilio signature).
 */
async function webhookStatusCallback(req, res) {
  try {
    const result = await whatsappService.handleStatusCallback(req.body);
    if (result.updated) {
      console.log(`[WEBHOOK] Status updated: ${result.messageSid} -> ${result.status}`);
    }
    // Twilio expects 200 response
    res.status(200).send("<Response></Response>");
  } catch (error) {
    console.error("[WEBHOOK] Status callback error:", error.message);
    res.status(200).send("<Response></Response>"); // Always 200 to prevent retries
  }
}

// ─── Template Endpoints ───────────────────────────────────────────────────────

/**
 * GET /api/whatsapp-notifications/templates
 */
async function getTemplates(req, res) {
  try {
    const { template_type, is_active } = req.query;
    const filters = {};
    if (template_type) filters.template_type = template_type;
    if (is_active !== undefined) filters.is_active = is_active === "true";

    const templates = await templateModel.getAll(filters);
    const placeholders = templateModel.getPlaceholders();
    const types = templateModel.getTemplateTypes();

    res.json({ templates, placeholders, types });
  } catch (error) {
    console.error("[WHATSAPP] Get templates error:", error.message);
    res.status(500).json({ message: "Failed to fetch templates." });
  }
}

/**
 * GET /api/whatsapp-notifications/templates/:id
 */
async function getTemplateById(req, res) {
  try {
    const template = await templateModel.getById(Number(req.params.id));
    if (!template) {
      return res.status(404).json({ message: "Template not found." });
    }
    res.json(template);
  } catch (error) {
    console.error("[WHATSAPP] Get template error:", error.message);
    res.status(500).json({ message: "Failed to fetch template." });
  }
}

/**
 * POST /api/whatsapp-notifications/templates
 */
async function createTemplate(req, res) {
  try {
    const { template_name, template_type, message_body, is_default, is_active } = req.body;

    if (!template_name || !template_type || !message_body) {
      return res.status(400).json({ message: "template_name, template_type, and message_body are required." });
    }

    const validTypes = templateModel.getTemplateTypes();
    if (!validTypes.includes(template_type)) {
      return res.status(400).json({ message: `Invalid template_type. Must be one of: ${validTypes.join(", ")}` });
    }

    const template = await templateModel.create({
      template_name,
      template_type,
      message_body,
      is_default: is_default || false,
      is_active: is_active !== false,
      created_by: req.user?.userId || null
    });

    res.status(201).json({ message: "Template created.", template });
  } catch (error) {
    console.error("[WHATSAPP] Create template error:", error.message);
    res.status(500).json({ message: "Failed to create template." });
  }
}

/**
 * PUT /api/whatsapp-notifications/templates/:id
 */
async function updateTemplate(req, res) {
  try {
    const id = Number(req.params.id);
    const { template_name, template_type, message_body, is_default, is_active } = req.body;

    const updates = {};
    if (template_name !== undefined) updates.template_name = template_name;
    if (template_type !== undefined) updates.template_type = template_type;
    if (message_body !== undefined) updates.message_body = message_body;
    if (is_default !== undefined) updates.is_default = is_default;
    if (is_active !== undefined) updates.is_active = is_active;

    const template = await templateModel.update(id, updates);
    if (!template) {
      return res.status(404).json({ message: "Template not found." });
    }

    res.json({ message: "Template updated.", template });
  } catch (error) {
    console.error("[WHATSAPP] Update template error:", error.message);
    res.status(500).json({ message: "Failed to update template." });
  }
}

/**
 * DELETE /api/whatsapp-notifications/templates/:id
 */
async function deleteTemplate(req, res) {
  try {
    const id = Number(req.params.id);
    const removed = await templateModel.remove(id);
    if (!removed) {
      return res.status(400).json({ message: "Cannot delete default template or template not found." });
    }
    res.json({ message: "Template deleted." });
  } catch (error) {
    console.error("[WHATSAPP] Delete template error:", error.message);
    res.status(500).json({ message: "Failed to delete template." });
  }
}

/**
 * PUT /api/whatsapp-notifications/templates/:id/default
 */
async function setDefaultTemplate(req, res) {
  try {
    const id = Number(req.params.id);
    const template = await templateModel.setDefault(id);
    if (!template) {
      return res.status(404).json({ message: "Template not found." });
    }
    res.json({ message: "Template set as default.", template });
  } catch (error) {
    console.error("[WHATSAPP] Set default template error:", error.message);
    res.status(500).json({ message: "Failed to set default template." });
  }
}

/**
 * GET /api/whatsapp-notifications/templates/placeholders
 */
async function getTemplatePlaceholders(req, res) {
  try {
    const placeholders = templateModel.getPlaceholders();
    const types = templateModel.getTemplateTypes();
    res.json({ placeholders, types });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch placeholders." });
  }
}

module.exports = {
  getSettings,
  updateSettings,
  sendNotification,
  getLogs,
  sendTest,
  getDashboard,
  updateCustomerWhatsApp,
  verifyCustomerWhatsApp,
  getCustomerWhatsApp,
  // New endpoints
  testConnection,
  sendInvoiceWhatsApp,
  getInvoiceCommunicationHistory,
  webhookStatusCallback,
  // Template endpoints
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  setDefaultTemplate,
  getTemplatePlaceholders
};
