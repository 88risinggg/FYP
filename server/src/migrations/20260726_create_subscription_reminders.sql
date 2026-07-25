-- ============================================================
-- Migration: 20260726_create_subscription_reminders.sql
-- Purpose : Create the subscription_reminders table for the
--           Subscription Reminders feature (replaces audit logs
--           in the subscription module).
-- Run once against the target database.
-- ============================================================

CREATE TABLE IF NOT EXISTS subscription_reminders (
  reminder_id       INT              NOT NULL AUTO_INCREMENT,
  subscription_id   INT              NOT NULL,
  customer_id       INT              NOT NULL,
  company_id        INT              NULL,
  customer_name     VARCHAR(200)     NULL,
  company_name      VARCHAR(200)     NULL,
  reminder_type     ENUM(
    'renewal_due_7_days',
    'expires_today',
    'expired',
    'billing_today',
    'invoice_generation_failed',
    'payment_failed',
    'subscription_paused',
    'auto_renew_disabled',
    'incomplete_import'
  )                                  NOT NULL,
  priority          ENUM('Low','Medium','High') NOT NULL DEFAULT 'Medium',
  reminder_date     DATE             NOT NULL,
  status            ENUM('Active','Completed','Dismissed') NOT NULL DEFAULT 'Active',
  resolved_at       DATETIME         NULL,
  resolved_by       INT              NULL,
  notes             TEXT             NULL,
  created_at        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (reminder_id),
  INDEX idx_subrem_subscription (subscription_id),
  INDEX idx_subrem_customer     (customer_id),
  INDEX idx_subrem_company      (company_id),
  INDEX idx_subrem_type         (reminder_type),
  INDEX idx_subrem_priority     (priority),
  INDEX idx_subrem_status       (status),
  INDEX idx_subrem_date         (reminder_date),

  CONSTRAINT fk_subrem_subscription FOREIGN KEY (subscription_id)
    REFERENCES subscriptions (subscription_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_subrem_customer FOREIGN KEY (customer_id)
    REFERENCES customer (customer_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
