-- Migration: Add payment URL, QR code, and Stripe session columns to invoice table
-- Also creates the invoice_notification table for Finance notifications

-- Add payment-related columns to invoice table (ignore if already exist)
ALTER TABLE invoice ADD COLUMN payment_url TEXT NULL;
ALTER TABLE invoice ADD COLUMN qr_code_url TEXT NULL;
ALTER TABLE invoice ADD COLUMN stripe_session_id VARCHAR(255) NULL;
ALTER TABLE invoice ADD COLUMN payment_intent_id VARCHAR(255) NULL;
ALTER TABLE invoice ADD COLUMN payment_date DATETIME NULL;

-- Update invoice status ENUM to include new statuses
ALTER TABLE invoice MODIFY COLUMN status ENUM('Draft', 'Scheduled', 'Sent', 'Viewed', 'Paid', 'Overdue', 'Cancelled', 'Refunded', 'Failed_Payment') DEFAULT 'Draft';

-- Create invoice_notification table
CREATE TABLE IF NOT EXISTS invoice_notification (
  notification_id INT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  invoice_id INT NULL,
  user_id INT NOT NULL,
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_is_read (is_read),
  INDEX idx_created_at (created_at)
);

-- Create invoice_view_log table for detailed view tracking
CREATE TABLE IF NOT EXISTS invoice_view_log (
  view_id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(512) NULL,
  INDEX idx_invoice_id (invoice_id)
);
