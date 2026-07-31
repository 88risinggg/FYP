-- PRESENTATION NOTE:
-- This migration creates the two database tables used by the admin
-- Automatic Customer Reminder Policy page.
-- reminder_settings stores the saved policy.
-- reminder_logs stores sent/failed delivery history.
CREATE TABLE IF NOT EXISTS reminder_settings (
  reminder_setting_id INT NOT NULL AUTO_INCREMENT,
  company_id INT NOT NULL,
  rule_name VARCHAR(160) NOT NULL DEFAULT 'Invoice reminder policy',
  is_enabled TINYINT(1) NOT NULL DEFAULT 0,
  frequency ENUM('Daily','Weekdays') NOT NULL DEFAULT 'Weekdays',
  reminder_time TIME NOT NULL DEFAULT '09:00:00',
  timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Singapore',
  delivery_channel VARCHAR(30) NOT NULL DEFAULT 'Email',
  whatsapp_enabled TINYINT(1) NOT NULL DEFAULT 0,
  first_reminder_days INT NOT NULL DEFAULT 1,
  second_reminder_days INT NOT NULL DEFAULT 16,
  final_reminder_days INT NULL DEFAULT 31,
  unpaid_only TINYINT(1) NOT NULL DEFAULT 1,
  stop_when_paid TINYINT(1) NOT NULL DEFAULT 1,
  exclude_cancelled TINYINT(1) NOT NULL DEFAULT 1,
  include_pdf TINYINT(1) NOT NULL DEFAULT 0,
  template_name VARCHAR(160) NOT NULL DEFAULT 'Overdue Invoice Reminder',
  email_subject VARCHAR(255) NOT NULL,
  email_body TEXT NOT NULL,
  created_by INT NULL,
  updated_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (reminder_setting_id),
  UNIQUE KEY uq_reminder_settings_company (company_id),
  INDEX idx_reminder_settings_enabled_time (is_enabled, reminder_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reminder_logs (
  reminder_log_id INT NOT NULL AUTO_INCREMENT,
  company_id INT NOT NULL,
  reminder_setting_id INT NOT NULL,
  invoice_id INT NOT NULL,
  invoice_number VARCHAR(100) NOT NULL,
  client_email VARCHAR(255) NOT NULL,
  reminder_type VARCHAR(50) NOT NULL,
  delivery_channel VARCHAR(30) NOT NULL DEFAULT 'Email',
  delivery_status ENUM('Sent','Failed','Skipped') NOT NULL,
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  error_message TEXT NULL,
  PRIMARY KEY (reminder_log_id),
  UNIQUE KEY uq_reminder_delivery (
    company_id,
    reminder_setting_id,
    invoice_id,
    reminder_type,
    delivery_status
  ),
  INDEX idx_reminder_logs_company_sent (company_id, sent_at),
  INDEX idx_reminder_logs_invoice (company_id, invoice_id),
  INDEX idx_reminder_logs_status (company_id, delivery_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO reminder_settings (
  company_id,
  rule_name,
  is_enabled,
  frequency,
  reminder_time,
  timezone,
  delivery_channel,
  first_reminder_days,
  second_reminder_days,
  final_reminder_days,
  unpaid_only,
  stop_when_paid,
  exclude_cancelled,
  include_pdf,
  template_name,
  email_subject,
  email_body
)
SELECT
  company_id,
  'Invoice reminder policy',
  0,
  'Weekdays',
  '09:00:00',
  COALESCE(NULLIF(timezone, ''), 'Asia/Singapore'),
  'Email',
  1,
  16,
  31,
  1,
  1,
  1,
  0,
  'Overdue Invoice Reminder',
  'Reminder: Invoice {{invoice_number}} is overdue',
  CONCAT(
    'Dear {{client_name}},\n\n',
    'This is a reminder that invoice {{invoice_number}} for {{amount_due}} ',
    'was due on {{due_date}} and is now {{overdue_days}} days overdue.\n\n',
    'Please make payment here: {{payment_link}}\n\n',
    'Regards,\n{{company_name}}'
  )
FROM companies
ON DUPLICATE KEY UPDATE company_id = VALUES(company_id);
