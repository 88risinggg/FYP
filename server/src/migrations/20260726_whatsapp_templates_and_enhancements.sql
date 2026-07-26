-- ─────────────────────────────────────────────────────────────────────────────
-- WhatsApp Integration Enhancement Migration
-- Adds: message_templates table, customer contact preferences,
--        enhanced notification_settings, delivery status tracking
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Message Templates Table
CREATE TABLE IF NOT EXISTS whatsapp_message_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  template_name VARCHAR(100) NOT NULL,
  template_type ENUM(
    'invoice_created',
    'invoice_sent',
    'payment_reminder',
    'overdue_notice',
    'payment_received',
    'subscription_started',
    'subscription_renewed',
    'subscription_expiring',
    'subscription_payment_failed',
    'subscription_cancelled',
    'subscription_invoice',
    'custom'
  ) NOT NULL,
  message_body TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_template_type (template_type),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Enhance customer table with contact preferences
ALTER TABLE customer
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(5) DEFAULT '+65',
  ADD COLUMN IF NOT EXISTS preferred_contact_method ENUM('email', 'whatsapp', 'both') DEFAULT 'email';

-- 3. Enhance notification_settings with additional WhatsApp config
ALTER TABLE notification_settings
  ADD COLUMN IF NOT EXISTS default_country_code VARCHAR(5) DEFAULT '+65',
  ADD COLUMN IF NOT EXISTS send_pdf_attachments BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_send_invoice BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_send_receipt BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_send_subscription BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS overdue_reminder_days JSON DEFAULT NULL;

-- 4. Enhance whatsapp_notification_logs with delivery tracking
ALTER TABLE whatsapp_notification_logs
  ADD COLUMN IF NOT EXISTS delivery_status ENUM(
    'queued', 'sent', 'delivered', 'read', 'failed', 'undelivered'
  ) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMP NULL DEFAULT NULL,
  ADD INDEX IF NOT EXISTS idx_message_id (message_id),
  ADD INDEX IF NOT EXISTS idx_invoice_id (invoice_id),
  ADD INDEX IF NOT EXISTS idx_customer_id (customer_id);

-- 5. Insert default message templates
INSERT INTO whatsapp_message_templates (template_name, template_type, message_body, is_default) VALUES
('Invoice Created', 'invoice_created',
 'Hello {{CustomerName}},\n\nYour invoice *{{InvoiceNumber}}* has been generated.\n\nAmount: {{Amount}}\nDue Date: {{DueDate}}\n\n{{PaymentLink}}\n\nThank you.\n— {{CompanyName}}',
 TRUE),
('Invoice Sent', 'invoice_sent',
 'Hello {{CustomerName}},\n\nInvoice *{{InvoiceNumber}}* has been sent to you.\n\nAmount: {{Amount}}\nDue Date: {{DueDate}}\n\nPlease check your email for the full details.\n— {{CompanyName}}',
 TRUE),
('Payment Reminder', 'payment_reminder',
 'Payment Reminder\n\nInvoice: {{InvoiceNumber}}\nAmount: {{Amount}}\nDue: {{DueDate}}\n\n{{PaymentLink}}\n\nPlease complete payment before the due date.\n— {{CompanyName}}',
 TRUE),
('Overdue Notice', 'overdue_notice',
 'OVERDUE NOTICE\n\nInvoice {{InvoiceNumber}} is overdue.\n\nAmount Due: {{Amount}}\n\n{{PaymentLink}}\n\nPlease complete payment immediately.\n— {{CompanyName}}',
 TRUE),
('Payment Received', 'payment_received',
 'Payment Confirmation\n\nInvoice: {{InvoiceNumber}}\nAmount Paid: {{Amount}}\nPayment Date: {{PaymentDate}}\nStatus: Paid\n\nThank you for your payment.\n— {{CompanyName}}',
 TRUE),
('Subscription Started', 'subscription_started',
 'Hello {{CustomerName}},\n\nYour subscription *{{SubscriptionName}}* is now active.\n\nAmount: {{Amount}}/billing cycle\n\nThank you for subscribing.\n— {{CompanyName}}',
 TRUE),
('Subscription Renewed', 'subscription_renewed',
 'Hello {{CustomerName}},\n\nYour subscription *{{SubscriptionName}}* has been renewed.\n\nInvoice: {{InvoiceNumber}}\nAmount: {{Amount}}\n\n— {{CompanyName}}',
 TRUE),
('Subscription Expiring', 'subscription_expiring',
 'Hello {{CustomerName}},\n\nYour subscription *{{SubscriptionName}}* will expire on {{DueDate}}.\n\nPlease renew to continue your service.\n— {{CompanyName}}',
 TRUE),
('Subscription Payment Failed', 'subscription_payment_failed',
 'Hello {{CustomerName}},\n\nPayment of {{Amount}} for subscription *{{SubscriptionName}}* has failed.\n\nPlease update your payment method.\n— {{CompanyName}}',
 TRUE),
('Subscription Cancelled', 'subscription_cancelled',
 'Hello {{CustomerName}},\n\nYour subscription *{{SubscriptionName}}* has been cancelled.\n\nIf this was a mistake, please contact support.\n— {{CompanyName}}',
 TRUE),
('Subscription Invoice', 'subscription_invoice',
 'Hello {{CustomerName}},\n\nYour subscription invoice *{{InvoiceNumber}}* has been generated.\n\nBilling Period: {{BillingPeriod}}\nAmount: {{Amount}}\nDue: {{DueDate}}\n\n— {{CompanyName}}',
 TRUE)
ON DUPLICATE KEY UPDATE updated_at = NOW();
