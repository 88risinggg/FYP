-- ============================================================
-- Migration: 20260725_create_subscriptions.sql
-- Purpose : Create the subscriptions table and extend the
--           invoice table with a subscription_id foreign key.
-- Run once against the target database.
-- ============================================================

-- -------------------------------------------------------
-- 1. subscriptions table
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  subscription_id   INT           NOT NULL AUTO_INCREMENT,
  customer_id       INT           NOT NULL,
  company_id        INT           NULL,
  plan_name         VARCHAR(120)  NOT NULL,
  description       TEXT          NULL,
  amount            DECIMAL(12,2) NOT NULL,
  billing_frequency ENUM('Weekly','Monthly','Quarterly','Yearly') NOT NULL DEFAULT 'Monthly',
  start_date        DATE          NOT NULL,
  next_billing_date DATE          NOT NULL,
  end_date          DATE          NULL,
  auto_renew        TINYINT(1)    NOT NULL DEFAULT 1,
  auto_send         TINYINT(1)    NOT NULL DEFAULT 0,
  status            ENUM('Active','Paused','Cancelled','Expired') NOT NULL DEFAULT 'Active',
  cancelled_at      DATETIME      NULL,
  paused_at         DATETIME      NULL,
  created_by        INT           NULL,
  created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (subscription_id),
  INDEX idx_sub_customer   (customer_id),
  INDEX idx_sub_company    (company_id),
  INDEX idx_sub_status     (status),
  INDEX idx_sub_next_bill  (next_billing_date),
  INDEX idx_sub_created_by (created_by),

  CONSTRAINT fk_sub_customer FOREIGN KEY (customer_id)
    REFERENCES customer (customer_id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------
-- 2. Add subscription_id column to the invoice table
--    (safe: only adds the column if it does not exist)
-- -------------------------------------------------------
SET @dbname   = DATABASE();
SET @tblname  = 'invoice';
SET @colname  = 'subscription_id';
SET @colexist = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @dbname
    AND TABLE_NAME   = @tblname
    AND COLUMN_NAME  = @colname
);

SET @sql = IF(
  @colexist = 0,
  CONCAT(
    'ALTER TABLE `invoice` ',
    'ADD COLUMN `subscription_id` INT NULL AFTER `company_id`, ',
    'ADD INDEX `idx_inv_subscription` (`subscription_id`)'
  ),
  'SELECT ''subscription_id column already exists — skipping.'''
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
