-- ============================================================
-- Complete Invoice Workflow Migration
-- Adds missing tables and columns for the fully automated workflow
-- ============================================================

-- The agreed schema uses existing tables only. Workflow tracking is stored as
-- invoice/payment/audit attributes; this migration intentionally creates none.

-- 1. Add Pending Review to invoice status ENUM (if not already present)
-- Note: MySQL ENUM modification is idempotent when the value already exists
ALTER TABLE invoice MODIFY COLUMN status
  ENUM('Draft', 'Scheduled', 'Sent', 'Viewed', 'Paid', 'Overdue', 'Cancelled', 'Refunded', 'Failed_Payment', 'Pending Review')
  DEFAULT 'Draft';

-- 2. Add vaniday_order_id column if not present
-- (used by deduplication in Vaniday import)
ALTER TABLE invoice ADD COLUMN vaniday_order_id VARCHAR(100) NULL;
ALTER TABLE invoice ADD INDEX idx_invoice_vaniday_order (vaniday_order_id);

-- 6. Add shop_title, seller_id, service_provider columns for Vaniday data
ALTER TABLE invoice ADD COLUMN shop_title VARCHAR(255) NULL;
ALTER TABLE invoice ADD COLUMN seller_id VARCHAR(100) NULL;
ALTER TABLE invoice ADD COLUMN service_provider VARCHAR(255) NULL;
ALTER TABLE invoice ADD COLUMN vaniday_share DECIMAL(12,2) NULL;
ALTER TABLE invoice ADD COLUMN salon_share DECIMAL(12,2) NULL;
ALTER TABLE invoice ADD COLUMN vaniday_commission DECIMAL(12,2) NULL;

-- 7. Add items_json column if not present
ALTER TABLE invoice ADD COLUMN items_json JSON NULL;

-- 8. Add risk/fraud inline columns if not present
ALTER TABLE invoice ADD COLUMN risk_score INT NULL DEFAULT NULL;
ALTER TABLE invoice ADD COLUMN risk_level VARCHAR(20) NULL DEFAULT NULL;
ALTER TABLE invoice ADD COLUMN review_status VARCHAR(30) NULL DEFAULT NULL;
ALTER TABLE invoice ADD COLUMN fraud_indicators_json JSON NULL;
ALTER TABLE invoice ADD COLUMN vendor_name VARCHAR(255) NULL;
ALTER TABLE invoice ADD COLUMN assessed_at DATETIME NULL;

-- 9. Ensure audit_logs table has the needed columns
ALTER TABLE audit_logs ADD COLUMN previous_value TEXT NULL;
ALTER TABLE audit_logs ADD COLUMN new_value TEXT NULL;
ALTER TABLE audit_logs ADD COLUMN ip_address VARCHAR(100) NULL;
ALTER TABLE audit_logs ADD COLUMN device_info VARCHAR(255) NULL;
