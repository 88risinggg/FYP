/**
 * WhatsApp Integration Controller (Refactored)
 *
 * Separated into Admin and Finance sections:
 *
 * ADMIN:
 *   - Configure Twilio credentials (encrypted)
 *   - Enable/disable integration
 *   - Test connection
 *   - Manage templates
 *   - Manage notification rules
 *   - View integration logs
 *   - View webhook status
 *
 * FINANCE:
 *   - Send Invoice via WhatsApp
 *   - Send Payment Reminder
 *   - Send Overdue Notification
 *   - Send Payment Confirmation
 *   - View message delivery status
 *   - Resend failed messages
 *   - View communication history per invoice
 *
 * WEBHOOK (no auth):
 *   - Twilio status callbacks
 */

const configModel = require("../models/whatsappConfigModel");
const messageModel = require("../models/whatsappMessageModel");
const whatsappService = require("../services/whatsappService");
const { pool } = require("../config/db");

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/whatsapp/admin/config
 * Returns current config (credentials masked).
 */
async function getConfig(req, res) {
  try {
    const config = await configModel.getConfig();
    if (!config) {
      return res.json({ configured: false, is_enabled: false });
    }
    res.json({ configured: true, ...config });
  } catch (error) {
    console.error("[WHATSAPP] getConfig error:", error.message);
    res.status(500).json({ message: "Failed to fetch WhatsApp configuration." });
  }
}

/**
 * PUT /api/whatsapp/admin/config
 * Save/update Twilio credentials and settings.
 */
async function saveConfig(req, res) {
  try {
    const { account_sid, auth_token, whatsapp_number, webhook_url, is_enabled } = req.body;

    if (!account_sid || !auth_token || !whatsapp_number) {
      return res.status(400).json({ message: "Account SID, Auth Token, and WhatsApp Number are required." });
    }

    // Validate credentials format
    if (!account_sid.startsWith("AC") || account_sid.length < 30) {
      return res.status(400).json({ message: "Invalid Account SID format. Must start with 'AC'." });
    }

    if (auth_token.length < 20) {
      return res.status(400).json({ message: "Invalid Auth Token format." });
    }

    const config = await configModel.saveConfig({
      account_sid,
      auth_token,
      whatsapp_number,
      webhook_url: webhook_url || null,
      is_enabled: is_enabled !== undefined ? is_enabled : false,
      updated_by: req.user?.userId
    });

    whatsappService.invalidateCache();

    await configModel.createIntegrationLog(
      "config_updated",
      { whatsapp_number, is_enabled, webhook_url: webhook_url || null },
      req.user?.userId,
      req.ip
    );

    res.json({ message: "WhatsApp configuration saved successfully.", config });
  } catch (error) {
    console.error("[WHATSAPP] saveConfig error:", error.message);
    res.status(500).json({ message: "Failed to save configuration." });
  }
}

/**
 * PUT /api/whatsapp/admin/toggle
 * Enable or disable WhatsApp integration.
 */
async function toggleEnabled(req, res) {
  try {
    const { is_enabled } = req.body;
    if (is_enabled === undefined) {
      return res.status(400).json({ message: "is_enabled field is required." });
    }

    const config = await configModel.setEnabled(is_enabled, req.user?.userId);
    if (!config) {
      return res.status(400).json({ message: "WhatsApp must be configured before it can be enabled." });
    }

    whatsappService.invalidateCache();

    await configModel.createIntegrationLog(
      is_enabled ? "integration_enabled" : "integration_disabled",
      null,
      req.user?.userId,
      req.ip
    );

    res.json({ message: `WhatsApp integration ${is_enabled ? "enabled" : "disabled"}.`, config });
  } catch (error) {
    console.error("[WHATSAPP] toggleEnabled error:", error.message);
    res.status(500).json({ message: "Failed to update integration status." });
  }
}

/**
 * POST /api/whatsapp/admin/test-connection
 * Test Twilio API connection (does not send a message).
 */
async function testConnection(req, res) {
  try {
    const result = await whatsappService.testConnection();

    await configModel.createIntegrationLog(
      "connection_tested",
      { success: result.success, accountName: result.accountName, error: result.error },
      req.user?.userId,
      req.ip
    );

    if (result.success) {
      res.json({ message: "Connection successful.", accountName: result.accountName, status: result.status });
    } else {
      res.status(422).json({ message: "Connection failed.", error: result.error });
    }
  } catch (error) {
    console.error("[WHATSAPP] testConnection error:", error.message);
    res.status(500).json({ message: "Failed to test connection." });
  }
}

/**
 * POST /api/whatsapp/admin/test-message
 * Send a test message to verify delivery.
 */
async function sendTestMessage(req, res) {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: "Phone number is required." });

    const result = await whatsappService.sendTestMessage(phone);

    await configModel.createIntegrationLog(
      "test_message_sent",
      { phone, success: result.success, error: result.error },
      req.user?.userId,
      req.ip
    );

    if (result.success) {
      res.json({ message: "Test message sent.", messageId: result.messageId });
    } else {
      res.status(422).json({ message: "Test message failed.", error: result.error });
    }
  } catch (error) {
    console.error("[WHATSAPP] sendTestMessage error:", error.message);
    res.status(500).json({ message: "Failed to send test message." });
  }
}

/**
 * GET /api/whatsapp/admin/logs
 * Get integration audit logs.
 */
async function getIntegrationLogs(req, res) {
  try {
    const { page = 1, limit = 50 } = req.query;
    const result = await configModel.getIntegrationLogs({ page: Number(page), limit: Number(limit) });
    res.json(result);
  } catch (error) {
    console.error("[WHATSAPP] getIntegrationLogs error:", error.message);
    res.status(500).json({ message: "Failed to fetch integration logs." });
  }
}

/**
 * GET /api/whatsapp/admin/notification-rules
 * Get all notification rules.
 */
async function getNotificationRules(req, res) {
  try {
    const rules = await configModel.getNotificationRules();
    res.json({ rules });
  } catch (error) {
    console.error("[WHATSAPP] getNotificationRules error:", error.message);
    res.status(500).json({ message: "Failed to fetch notification rules." });
  }
}

/**
 * PUT /api/whatsapp/admin/notification-rules/:ruleType
 * Update a notification rule.
 */
async function updateNotificationRule(req, res) {
  try {
    const { ruleType } = req.params;
    const validTypes = ["invoice_sent", "payment_reminder", "overdue_notice", "payment_confirmation"];
    if (!validTypes.includes(ruleType)) {
      return res.status(400).json({ message: `Invalid rule type. Must be one of: ${validTypes.join(", ")}` });
    }

    const rule = await configModel.updateNotificationRule(ruleType, req.body);

    await configModel.createIntegrationLog(
      "notification_rule_updated",
      { ruleType, ...req.body },
      req.user?.userId,
      req.ip
    );

    res.json({ message: "Notification rule updated.", rule });
  } catch (error) {
    console.error("[WHATSAPP] updateNotificationRule error:", error.message);
    res.status(500).json({ message: "Failed to update notification rule." });
  }
}

// ─── Templates (Admin) ────────────────────────────────────────────────────────

/**
 * GET /api/whatsapp/admin/templates
 */
async function getTemplates(req, res) {
  try {
    const { template_type } = req.query;
    const templates = await messageModel.getTemplates(template_type ? { template_type } : {});
    const placeholders = messageModel.getPlaceholders();
    res.json({ templates, placeholders });
  } catch (error) {
    console.error("[WHATSAPP] getTemplates error:", error.message);
    res.status(500).json({ message: "Failed to fetch templates." });
  }
}

/**
 * GET /api/whatsapp/admin/templates/:id
 */
async function getTemplateById(req, res) {
  try {
    const template = await messageModel.getTemplateById(Number(req.params.id));
    if (!template) return res.status(404).json({ message: "Template not found." });
    res.json(template);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch template." });
  }
}

/**
 * POST /api/whatsapp/admin/templates
 */
async function createTemplate(req, res) {
  try {
    const { template_name, template_type, message_body } = req.body;
    if (!template_name || !template_type || !message_body) {
      return res.status(400).json({ message: "template_name, template_type, and message_body are required." });
    }

    const template = await messageModel.createTemplate({
      ...req.body,
      created_by: req.user?.userId
    });

    await configModel.createIntegrationLog(
      "template_created",
      { template_name, template_type },
      req.user?.userId,
      req.ip
    );

    res.status(201).json({ message: "Template created.", template });
  } catch (error) {
    console.error("[WHATSAPP] createTemplate error:", error.message);
    res.status(500).json({ message: "Failed to create template." });
  }
}

/**
 * PUT /api/whatsapp/admin/templates/:id
 */
async function updateTemplate(req, res) {
  try {
    const template = await messageModel.updateTemplate(Number(req.params.id), req.body);
    if (!template) return res.status(404).json({ message: "Template not found." });
    res.json({ message: "Template updated.", template });
  } catch (error) {
    res.status(500).json({ message: "Failed to update template." });
  }
}

/**
 * DELETE /api/whatsapp/admin/templates/:id
 */
async function deleteTemplate(req, res) {
  try {
    const deleted = await messageModel.deleteTemplate(Number(req.params.id));
    if (!deleted) return res.status(400).json({ message: "Cannot delete default templates." });
    res.json({ message: "Template deleted." });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete template." });
  }
}

/**
 * PUT /api/whatsapp/admin/templates/:id/default
 */
async function setDefaultTemplate(req, res) {
  try {
    const template = await messageModel.setDefaultTemplate(Number(req.params.id));
    if (!template) return res.status(404).json({ message: "Template not found." });
    res.json({ message: "Template set as default.", template });
  } catch (error) {
    res.status(500).json({ message: "Failed to set default template." });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FINANCE ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/whatsapp/finance/status
 * Check if WhatsApp integration is available for use.
 */
async function getFinanceStatus(req, res) {
  try {
    const status = await configModel.getIntegrationStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ message: "Failed to check integration status." });
  }
}

/**
 * POST /api/whatsapp/finance/send-invoice/:invoiceId
 * Send an invoice to the customer via WhatsApp.
 */
async function sendInvoiceWhatsApp(req, res) {
  try {
    const invoiceId = Number(req.params.invoiceId);
    if (!invoiceId) return res.status(400).json({ message: "Invoice ID is required." });

    // Check integration enabled
    const status = await configModel.getIntegrationStatus();
    if (!status.enabled || !status.configured) {
      return res.status(400).json({ message: "WhatsApp integration is not enabled or not configured." });
    }

    // Get invoice + customer data
    const [invoiceRows] = await pool.query(
      `SELECT i.invoice_id, i.invoiceId, i.total_amount, i.due_date, i.status, i.payment_url, i.customer_id
       FROM invoice i WHERE i.invoice_id = ? LIMIT 1`,
      [invoiceId]
    );
    if (invoiceRows.length === 0) return res.status(404).json({ message: "Invoice not found." });
    const invoice = invoiceRows[0];

    const [customerRows] = await pool.query(
      "SELECT customer_id, name, whatsapp_number FROM customer WHERE customer_id = ?",
      [invoice.customer_id]
    );
    if (customerRows.length === 0) return res.status(404).json({ message: "Customer not found." });
    const customer = customerRows[0];

    // Allow recipient override from body
    const phone = req.body.recipient_phone || customer.whatsapp_number;
    if (!phone) {
      return res.status(400).json({ message: "Customer does not have a WhatsApp number. Provide recipient_phone in request body." });
    }

    // Build PDF URL for media attachment (requires public access for Twilio)
    const appBaseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 5002}`;
    const pdfUrl = `${appBaseUrl}/api/public/invoice/${invoice.invoiceId}/pdf`;

    const result = await whatsappService.sendInvoice({
      customerId: customer.customer_id,
      customerName: customer.name,
      phone,
      invoiceId: invoice.invoice_id,
      invoiceNumber: invoice.invoiceId,
      amount: invoice.total_amount,
      dueDate: invoice.due_date,
      paymentLink: invoice.payment_url || null,
      sentBy: req.user?.userId,
      pdfUrl
    });

    if (result.success) {
      // Update invoice status to "Sent" (same as email send)
      if (!["Paid", "Void", "Cancelled", "Refunded"].includes(invoice.status)) {
        await pool.query(
          "UPDATE invoice SET status = 'Sent', scheduled_at = NULL WHERE invoice_id = ?",
          [invoiceId]
        );
      }
      res.json({ message: "Invoice sent via WhatsApp.", messageId: result.messageId, logId: result.logId });
    } else {
      res.status(422).json({ message: "Failed to send invoice.", error: result.error, logId: result.logId });
    }
  } catch (error) {
    console.error("[WHATSAPP] sendInvoiceWhatsApp error:", error.message);
    res.status(500).json({ message: "Failed to send invoice via WhatsApp." });
  }
}

/**
 * POST /api/whatsapp/finance/send-reminder/:invoiceId
 * Send a payment reminder for an invoice.
 */
async function sendReminderWhatsApp(req, res) {
  try {
    const invoiceId = Number(req.params.invoiceId);
    if (!invoiceId) return res.status(400).json({ message: "Invoice ID is required." });

    const status = await configModel.getIntegrationStatus();
    if (!status.enabled || !status.configured) {
      return res.status(400).json({ message: "WhatsApp integration is not enabled or not configured." });
    }

    const [invoiceRows] = await pool.query(
      `SELECT i.invoice_id, i.invoiceId, i.total_amount, i.due_date, i.payment_url, i.customer_id
       FROM invoice i WHERE i.invoice_id = ? LIMIT 1`,
      [invoiceId]
    );
    if (invoiceRows.length === 0) return res.status(404).json({ message: "Invoice not found." });
    const invoice = invoiceRows[0];

    const [customerRows] = await pool.query(
      "SELECT customer_id, name, whatsapp_number FROM customer WHERE customer_id = ?",
      [invoice.customer_id]
    );
    if (customerRows.length === 0) return res.status(404).json({ message: "Customer not found." });
    const customer = customerRows[0];

    const phone = req.body.recipient_phone || customer.whatsapp_number;
    if (!phone) return res.status(400).json({ message: "Customer does not have a WhatsApp number." });

    const result = await whatsappService.sendPaymentReminder({
      customerId: customer.customer_id,
      customerName: customer.name,
      phone,
      invoiceId: invoice.invoice_id,
      invoiceNumber: invoice.invoiceId,
      amount: invoice.total_amount,
      dueDate: invoice.due_date,
      paymentLink: invoice.payment_url || null,
      sentBy: req.user?.userId
    });

    if (result.success) {
      res.json({ message: "Payment reminder sent.", messageId: result.messageId, logId: result.logId });
    } else {
      res.status(422).json({ message: "Failed to send reminder.", error: result.error, logId: result.logId });
    }
  } catch (error) {
    console.error("[WHATSAPP] sendReminderWhatsApp error:", error.message);
    res.status(500).json({ message: "Failed to send payment reminder." });
  }
}

/**
 * POST /api/whatsapp/finance/send-overdue/:invoiceId
 * Send an overdue notice for an invoice.
 */
async function sendOverdueWhatsApp(req, res) {
  try {
    const invoiceId = Number(req.params.invoiceId);
    if (!invoiceId) return res.status(400).json({ message: "Invoice ID is required." });

    const status = await configModel.getIntegrationStatus();
    if (!status.enabled || !status.configured) {
      return res.status(400).json({ message: "WhatsApp integration is not enabled or not configured." });
    }

    const [invoiceRows] = await pool.query(
      `SELECT i.invoice_id, i.invoiceId, i.total_amount, i.due_date, i.payment_url, i.customer_id
       FROM invoice i WHERE i.invoice_id = ? LIMIT 1`,
      [invoiceId]
    );
    if (invoiceRows.length === 0) return res.status(404).json({ message: "Invoice not found." });
    const invoice = invoiceRows[0];

    const [customerRows] = await pool.query(
      "SELECT customer_id, name, whatsapp_number FROM customer WHERE customer_id = ?",
      [invoice.customer_id]
    );
    if (customerRows.length === 0) return res.status(404).json({ message: "Customer not found." });
    const customer = customerRows[0];

    const phone = req.body.recipient_phone || customer.whatsapp_number;
    if (!phone) return res.status(400).json({ message: "Customer does not have a WhatsApp number." });

    const result = await whatsappService.sendOverdueNotice({
      customerId: customer.customer_id,
      customerName: customer.name,
      phone,
      invoiceId: invoice.invoice_id,
      invoiceNumber: invoice.invoiceId,
      amount: invoice.total_amount,
      paymentLink: invoice.payment_url || null,
      sentBy: req.user?.userId
    });

    if (result.success) {
      res.json({ message: "Overdue notice sent.", messageId: result.messageId, logId: result.logId });
    } else {
      res.status(422).json({ message: "Failed to send overdue notice.", error: result.error, logId: result.logId });
    }
  } catch (error) {
    console.error("[WHATSAPP] sendOverdueWhatsApp error:", error.message);
    res.status(500).json({ message: "Failed to send overdue notice." });
  }
}

/**
 * POST /api/whatsapp/finance/send-confirmation/:invoiceId
 * Send a payment confirmation for an invoice.
 */
async function sendConfirmationWhatsApp(req, res) {
  try {
    const invoiceId = Number(req.params.invoiceId);
    if (!invoiceId) return res.status(400).json({ message: "Invoice ID is required." });

    const status = await configModel.getIntegrationStatus();
    if (!status.enabled || !status.configured) {
      return res.status(400).json({ message: "WhatsApp integration is not enabled or not configured." });
    }

    const [invoiceRows] = await pool.query(
      `SELECT i.invoice_id, i.invoiceId, i.total_amount, i.customer_id
       FROM invoice i WHERE i.invoice_id = ? LIMIT 1`,
      [invoiceId]
    );
    if (invoiceRows.length === 0) return res.status(404).json({ message: "Invoice not found." });
    const invoice = invoiceRows[0];

    const [customerRows] = await pool.query(
      "SELECT customer_id, name, whatsapp_number FROM customer WHERE customer_id = ?",
      [invoice.customer_id]
    );
    if (customerRows.length === 0) return res.status(404).json({ message: "Customer not found." });
    const customer = customerRows[0];

    const phone = req.body.recipient_phone || customer.whatsapp_number;
    if (!phone) return res.status(400).json({ message: "Customer does not have a WhatsApp number." });

    const result = await whatsappService.sendPaymentConfirmation({
      customerId: customer.customer_id,
      customerName: customer.name,
      phone,
      invoiceId: invoice.invoice_id,
      invoiceNumber: invoice.invoiceId,
      amount: invoice.total_amount,
      sentBy: req.user?.userId
    });

    if (result.success) {
      res.json({ message: "Payment confirmation sent.", messageId: result.messageId, logId: result.logId });
    } else {
      res.status(422).json({ message: "Failed to send confirmation.", error: result.error, logId: result.logId });
    }
  } catch (error) {
    console.error("[WHATSAPP] sendConfirmationWhatsApp error:", error.message);
    res.status(500).json({ message: "Failed to send payment confirmation." });
  }
}

/**
 * GET /api/whatsapp/finance/history/:invoiceId
 * Get WhatsApp message history for an invoice.
 */
async function getInvoiceHistory(req, res) {
  try {
    const invoiceId = Number(req.params.invoiceId);
    if (!invoiceId) return res.status(400).json({ message: "Invoice ID is required." });

    const messages = await messageModel.getByInvoiceId(invoiceId);
    res.json({ messages });
  } catch (error) {
    console.error("[WHATSAPP] getInvoiceHistory error:", error.message);
    res.status(500).json({ message: "Failed to fetch message history." });
  }
}

/**
 * GET /api/whatsapp/finance/messages
 * Get all messages with filtering (paginated).
 */
async function getMessages(req, res) {
  try {
    const result = await messageModel.getMessages(req.query);
    res.json(result);
  } catch (error) {
    console.error("[WHATSAPP] getMessages error:", error.message);
    res.status(500).json({ message: "Failed to fetch messages." });
  }
}

/**
 * GET /api/whatsapp/finance/dashboard
 * Get WhatsApp message dashboard stats.
 */
async function getDashboard(req, res) {
  try {
    const stats = await messageModel.getDashboardStats();
    res.json({ stats });
  } catch (error) {
    console.error("[WHATSAPP] getDashboard error:", error.message);
    res.status(500).json({ message: "Failed to fetch dashboard stats." });
  }
}

/**
 * POST /api/whatsapp/finance/resend/:messageId
 * Resend a failed message.
 */
async function resendFailedMessage(req, res) {
  try {
    const messageId = Number(req.params.messageId);
    if (!messageId) return res.status(400).json({ message: "Message ID is required." });

    const result = await whatsappService.resendMessage(messageId);

    if (result.success) {
      res.json({ message: "Message resent successfully.", messageId: result.messageId });
    } else {
      res.status(422).json({ message: "Resend failed.", error: result.error });
    }
  } catch (error) {
    console.error("[WHATSAPP] resendFailedMessage error:", error.message);
    res.status(500).json({ message: "Failed to resend message." });
  }
}

/**
 * GET /api/whatsapp/finance/status/:invoiceId
 * Get latest message delivery status for an invoice.
 */
async function getDeliveryStatus(req, res) {
  try {
    const invoiceId = Number(req.params.invoiceId);
    if (!invoiceId) return res.status(400).json({ message: "Invoice ID is required." });

    const latest = await messageModel.getLatestForInvoice(invoiceId);
    res.json({ latestMessage: latest });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch delivery status." });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOK (no auth)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/whatsapp/webhook/status
 * Twilio sends status callbacks here.
 */
async function webhookStatusCallback(req, res) {
  try {
    const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = req.body;

    if (!MessageSid || !MessageStatus) {
      return res.status(400).send("Missing MessageSid or MessageStatus.");
    }

    const errorMsg = ErrorMessage || (ErrorCode ? `Error code: ${ErrorCode}` : null);
    await messageModel.updateStatusFromWebhook(MessageSid, MessageStatus, errorMsg);

    res.status(200).send("OK");
  } catch (error) {
    console.error("[WHATSAPP] Webhook error:", error.message);
    res.status(500).send("Webhook processing failed.");
  }
}

module.exports = {
  // Admin
  getConfig,
  saveConfig,
  toggleEnabled,
  testConnection,
  sendTestMessage,
  getIntegrationLogs,
  getNotificationRules,
  updateNotificationRule,
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  setDefaultTemplate,
  // Finance
  getFinanceStatus,
  sendInvoiceWhatsApp,
  sendReminderWhatsApp,
  sendOverdueWhatsApp,
  sendConfirmationWhatsApp,
  getInvoiceHistory,
  getMessages,
  getDashboard,
  resendFailedMessage,
  getDeliveryStatus,
  // Webhook
  webhookStatusCallback
};
