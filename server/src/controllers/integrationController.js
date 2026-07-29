/**
 * EVALUATION HEADER
 * FEATURE: SHARED / APPLICATION CORE
 * PURPOSE: Handles integration Controller API requests, validation, status codes, and responses.
 * LAYER: Backend controller - validates HTTP input and returns the API response.
 * FIND RELATED CODE: Follow service/model calls to find business rules and database work.
 */
/**
 * Integration Controller
 *
 * Provides:
 *   - Integration status panel (Stripe, SMTP, WhatsApp)
 *   - Send Test Email (development only, uses Test Customer)
 *   - Send Test WhatsApp (development only, uses Test Customer)
 *   - Email delivery logs viewing
 *   - Retry failed email
 *
 * All endpoints require Admin or Finance role.
 */

const { getStripeStatus } = require("../services/stripeService");
const { verifySmtpConnection, sendInvoiceSettingsTestEmail } = require("../services/invoiceDeliveryService");
const { getTestCustomer } = require("../services/testCustomerService");
const {
  getEmailLogs,
  getEmailLogById,
  incrementAttempt,
  createEmailLog,
  markEmailSent,
  markEmailFailed
} = require("../services/integrationLogService");

// ─── Integration Status Panel ─────────────────────────────────────────────────

/**
 * GET /api/integrations/status
 * Returns configuration status for Stripe, SMTP, and WhatsApp.
 */
async function getIntegrationStatus(req, res) {
  try {
    // Stripe status
    const stripe = getStripeStatus();

    // SMTP status
    const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
    const smtpFrom = process.env.SMTP_FROM || process.env.SMTP_USER || "";

    // WhatsApp status (check via config model)
    let whatsapp = { enabled: false, configured: false, provider: "twilio" };
    try {
      const configModel = require("../models/whatsappConfigModel");
      whatsapp = await configModel.getIntegrationStatus();
      whatsapp.provider = "twilio";
    } catch { /* table may not exist */ }

    res.json({
      stripe: {
        configured: stripe.configured,
        testMode: stripe.testMode,
        liveMode: stripe.liveMode,
        webhookConfigured: stripe.webhookConfigured,
        publishableKeySet: stripe.publishableKeySet
      },
      smtp: {
        configured: smtpConfigured,
        host: smtpConfigured ? process.env.SMTP_HOST : null,
        port: smtpConfigured ? Number(process.env.SMTP_PORT || 587) : null,
        fromAddress: smtpFrom ? smtpFrom.replace(/.*<(.+)>.*/, "$1") : null,
        verified: null // Call verify endpoint separately
      },
      whatsapp
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch integration status." });
  }
}

/**
 * POST /api/integrations/smtp/verify
 * Verify SMTP connection is working.
 */
async function verifySMTP(req, res) {
  try {
    const result = await verifySmtpConnection();
    res.json({
      verified: result.success,
      error: result.error || null,
      message: result.success ? "SMTP connection verified." : `SMTP verification failed: ${result.error}`
    });
  } catch (error) {
    res.status(500).json({ verified: false, error: error.message });
  }
}

// ─── Test Email (Development Only) ───────────────────────────────────────────

/**
 * POST /api/integrations/test/email
 * Send a test email to the Test Customer's email address.
 * Only available in development/test environments.
 */
async function sendTestEmail(req, res) {
  const env = (process.env.NODE_ENV || "development").toLowerCase();
  if (env === "production" && !process.env.ENABLE_INTEGRATION_TEST_ENDPOINTS) {
    return res.status(403).json({ message: "Test endpoints are disabled in production." });
  }

  try {
    const testCustomer = await getTestCustomer();

    if (!testCustomer.email) {
      return res.status(400).json({ message: "Test Customer does not have an email address." });
    }

    // Create log entry
    const logId = await createEmailLog({
      customerId: testCustomer.customerId,
      emailType: "test_email",
      recipient: testCustomer.email,
      subject: "PayNivo Integration Test Email",
      deduplicationKey: null, // Allow multiple test emails
      triggeredBy: "user",
      triggeredByUserId: req.user?.userId
    });

    const result = await sendInvoiceSettingsTestEmail(testCustomer.email);

    if (logId) {
      if (result.messageId) {
        await markEmailSent(logId, result.messageId);
      } else {
        await markEmailSent(logId, "console-mode");
      }
    }

    res.json({
      message: "Test email sent successfully.",
      recipient: testCustomer.email,
      customerName: testCustomer.name,
      provider: result.provider || "smtp",
      messageId: result.messageId || null
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to send test email.",
      error: error.message.includes("SMTP") ? error.message : "Unable to deliver email. Check SMTP configuration."
    });
  }
}

// ─── Test WhatsApp (Development Only) ─────────────────────────────────────────

/**
 * POST /api/integrations/test/whatsapp
 * Send a test WhatsApp message to the Test Customer's phone number.
 * Only available in development/test environments.
 */
async function sendTestWhatsApp(req, res) {
  const env = (process.env.NODE_ENV || "development").toLowerCase();
  if (env === "production" && !process.env.ENABLE_INTEGRATION_TEST_ENDPOINTS) {
    return res.status(403).json({ message: "Test endpoints are disabled in production." });
  }

  try {
    const testCustomer = await getTestCustomer();

    if (!testCustomer.whatsappNumber) {
      return res.status(400).json({ message: "Test Customer does not have a WhatsApp number." });
    }

    const whatsappService = require("../services/whatsappService");
    const result = await whatsappService.sendAndLog({
      phone: testCustomer.whatsappNumber,
      messageBody: `[TEST] PayNivo integration test message sent at ${new Date().toLocaleString("en-SG")}. This confirms your WhatsApp integration is working.`,
      messageType: "custom",
      customerId: testCustomer.customerId,
      invoiceId: null,
      recipientName: testCustomer.name,
      sentBy: req.user?.userId,
      useRetry: false
    });

    if (result.success) {
      res.json({
        message: "Test WhatsApp message sent successfully.",
        recipient: testCustomer.whatsappNumber.replace(/(\d{4})(\d+)(\d{2})/, "$1****$3"),
        customerName: testCustomer.name,
        messageId: result.messageId,
        logId: result.logId
      });
    } else {
      res.status(422).json({
        message: "Failed to send test WhatsApp message.",
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      message: "Failed to send test WhatsApp message.",
      error: error.message
    });
  }
}

// ─── Email Delivery Logs ──────────────────────────────────────────────────────

/**
 * GET /api/integrations/email-logs
 * View email delivery logs with optional filtering.
 */
async function getEmailDeliveryLogs(req, res) {
  try {
    const { page, limit, email_type, status, invoice_id, customer_id } = req.query;
    const result = await getEmailLogs({
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      email_type,
      status,
      invoice_id: invoice_id ? Number(invoice_id) : undefined,
      customer_id: customer_id ? Number(customer_id) : undefined
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch email logs." });
  }
}

/**
 * POST /api/integrations/email-logs/:logId/retry
 * Retry a failed email delivery.
 */
async function retryFailedEmail(req, res) {
  const logId = Number(req.params.logId);
  if (!logId) return res.status(400).json({ message: "Log ID is required." });

  try {
    const log = await getEmailLogById(logId);
    if (!log) return res.status(404).json({ message: "Email log not found." });

    if (log.status === "sent") {
      return res.status(400).json({ message: "This email was already sent successfully." });
    }

    if (log.attempt_count >= 5) {
      return res.status(400).json({ message: "Maximum retry attempts reached (5)." });
    }

    // Increment attempt
    await incrementAttempt(logId);

    // Re-send based on email type
    if (log.email_type === "test_email") {
      const result = await sendInvoiceSettingsTestEmail(log.recipient);
      await markEmailSent(logId, result.messageId || "retry-console");
      return res.json({ message: "Test email retry sent.", messageId: result.messageId });
    }

    // For other types, use generic re-send
    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });

    const smtpFrom = process.env.SMTP_FROM || process.env.SMTP_USER;
    const info = await transporter.sendMail({
      from: smtpFrom,
      to: log.recipient,
      subject: log.subject || "PayNivo Notification (Retry)",
      text: `This is a retry of a previously failed email notification.\n\nOriginal type: ${log.email_type}\nOriginal date: ${log.created_at}`
    });

    await markEmailSent(logId, info.messageId);
    res.json({ message: "Email retry sent.", messageId: info.messageId });
  } catch (error) {
    if (logId) await markEmailFailed(logId, error.code || "RETRY_ERROR", error.message);
    res.status(500).json({ message: "Email retry failed.", error: error.message });
  }
}

module.exports = {
  getEmailDeliveryLogs,
  getIntegrationStatus,
  retryFailedEmail,
  sendTestEmail,
  sendTestWhatsApp,
  verifySMTP
};
