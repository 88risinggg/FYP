-- ============================================================
-- Complete Invoice Workflow Migration
-- Adds missing tables and columns for the fully automated workflow
-- ============================================================

-- 1. Invoice View Tracking Table
CREATE TABLE IF NOT EXISTS invoice_view_log (
  view_id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  view_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(100) NULL,
  user_agent TEXT NULL,
  device_info VARCHAR(255) NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoice(invoice_id) ON DELETE CASCADE,
  INDEX idx_invoice_view_invoice (invoice_id),
  INDEX idx_invoice_view_date (view_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Manual Payment Submissions Table (customer uploads proof)
CREATE TABLE IF NOT EXISTS manual_payment_submission (
  submission_id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  reference_number VARCHAR(255) NULL,
  payment_method VARCHAR(100) NOT NULL DEFAULT 'Bank Transfer',
  proof_file_url VARCHAR(500) NULL,
  proof_file_name VARCHAR(255) NULL,
  customer_notes TEXT NULL,
  status ENUM('Pending Review', 'Approved', 'Rejected') NOT NULL DEFAULT 'Pending Review',
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  review_notes TEXT NULL,
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoice(invoice_id) ON DELETE CASCADE,
  INDEX idx_mps_invoice (invoice_id),
  INDEX idx_mps_status (status),
  INDEX idx_mps_submitted (submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Add Pending Review to invoice status ENUM (if not already present)
-- Note: MySQL ENUM modification is idempotent when the value already exists
ALTER TABLE invoice MODIFY COLUMN status
  ENUM('Draft', 'Scheduled', 'Sent', 'Viewed', 'Paid', 'Overdue', 'Cancelled', 'Refunded', 'Failed_Payment', 'Pending Review')
  DEFAULT 'Draft';

-- 4. Invoice Reminder Log table (may already exist from reminderService)
CREATE TABLE IF NOT EXISTS invoice_reminder_log (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  reminder_type VARCHAR(50) NOT NULL,
  delivery_status VARCHAR(20) NOT NULL DEFAULT 'Sent',
  customer_email VARCHAR(255) NULL,
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  error_message TEXT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoice(invoice_id) ON DELETE CASCADE,
  INDEX idx_irl_invoice (invoice_id),
  INDEX idx_irl_type (reminder_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Add vaniday_order_id column if not present
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
