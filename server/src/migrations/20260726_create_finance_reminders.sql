-- ============================================================
-- Migration: 20260726_create_finance_reminders.sql
-- Purpose : Create a unified finance_reminders table for the
--           Finance Reminder module. Consolidates invoice-level
--           and subscription-level reminders into a single view
--           that Finance users can filter, search, complete, and dismiss.
-- ============================================================

CREATE TABLE IF NOT EXISTS finance_reminders (
  reminder_id       INT              NOT NULL AUTO_INCREMENT,
  reminder_type     ENUM(
    'invoice_due_7_days',
    'invoice_due_today',
    'invoice_overdue',
    'payment_failed',
    'payment_succeeded',
    'subscription_renewal_due',
    'invoice_generation_failed',
    'bulk_upload_validation_error'
  )                                  NOT NULL,
  priority          ENUM('Low','Medium','High') NOT NULL DEFAULT 'Medium',
  title             VARCHAR(255)     NOT NULL,
  message           TEXT             NOT NULL,
  invoice_id        INT              NULL,
  subscription_id   INT              NULL,
  customer_id       INT              NULL,
  company_id        INT              NULL,
  customer_name     VARCHAR(200)     NULL,
  invoice_number    VARCHAR(100)     NULL,
  amount            DECIMAL(12,2)    NULL,
  due_date          DATE             NULL,
  status            ENUM('Active','Completed','Dismissed') NOT NULL DEFAULT 'Active',
  resolved_at       DATETIME         NULL,
  resolved_by       INT              NULL,
  notes             TEXT             NULL,
  created_at        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (reminder_id),
  INDEX idx_finrem_type       (reminder_type),
  INDEX idx_finrem_priority   (priority),
  INDEX idx_finrem_status     (status),
  INDEX idx_finrem_invoice    (invoice_id),
  INDEX idx_finrem_sub        (subscription_id),
  INDEX idx_finrem_customer   (customer_id),
  INDEX idx_finrem_company    (company_id),
  INDEX idx_finrem_created    (created_at),
  INDEX idx_finrem_due_date   (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add PayNow-related columns to the invoice table if not present
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoice' AND COLUMN_NAME = 'paynow_reference');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE invoice ADD COLUMN paynow_reference VARCHAR(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoice' AND COLUMN_NAME = 'paynow_qr_data');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE invoice ADD COLUMN paynow_qr_data TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add payment_method_preference to customer table for default payment method
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer' AND COLUMN_NAME = 'preferred_payment_method');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE customer ADD COLUMN preferred_payment_method VARCHAR(50) NULL DEFAULT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
