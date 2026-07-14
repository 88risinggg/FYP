-- Migration: Reset invoice system and enhance with Stripe payment columns
-- Run this script to:
--   1. Delete all existing invoice records and related data
--   2. Reset auto-increment sequences
--   3. Add Stripe payment tracking columns

-- =====================================================
-- PART 1: Delete all existing invoice-related records
-- =====================================================

-- Delete payment records (depends on invoice)
DELETE FROM payment;

-- Delete invoice items (depends on invoice)
DELETE FROM invoice_item;

-- Delete fraud assessments (depends on invoice)
DELETE FROM invoice_fraud_assessment;

-- Delete invoice notifications
DELETE FROM invoice_notification;

-- Delete invoice view logs
DELETE FROM invoice_view_log;

-- Delete audit logs related to invoices
DELETE FROM audit_log WHERE entity_type = 'invoice';
DELETE FROM audit_log WHERE entity_type = 'payment';

-- Delete all invoices
DELETE FROM invoice;

-- =====================================================
-- PART 2: Reset auto-increment sequences
-- =====================================================

ALTER TABLE invoice AUTO_INCREMENT = 1;
ALTER TABLE invoice_item AUTO_INCREMENT = 1;
ALTER TABLE payment AUTO_INCREMENT = 1;

-- =====================================================
-- PART 3: Add/Ensure Stripe payment columns on invoice table
-- =====================================================

-- Add columns if they don't exist (safe to run multiple times)
-- payment_url: Stripe Checkout URL
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS payment_url TEXT NULL;

-- qr_code_url: Base64 QR code data URI
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS qr_code_url TEXT NULL;

-- stripe_session_id: Stripe Checkout Session ID
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(255) NULL;

-- stripe_payment_intent_id: Stripe Payment Intent ID
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS payment_intent_id VARCHAR(255) NULL;

-- payment_status: Stripe payment lifecycle status
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) NULL DEFAULT NULL;

-- payment_method: Method used for payment (card, apple_pay, google_pay, etc.)
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS payment_method VARCHAR(100) NULL DEFAULT NULL;

-- paid_at: Timestamp when payment was completed
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS payment_date DATETIME NULL;

-- transaction_id: Stripe transaction/payment intent ID for reference
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(255) NULL DEFAULT NULL;

-- Update invoice status ENUM to include all needed statuses
ALTER TABLE invoice MODIFY COLUMN status ENUM('Draft', 'Scheduled', 'Sent', 'Viewed', 'Paid', 'Overdue', 'Cancelled', 'Refunded', 'Failed_Payment') DEFAULT 'Draft';

-- =====================================================
-- PART 4: Ensure notification table exists
-- =====================================================

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

-- =====================================================
-- PART 5: Ensure view log table exists
-- =====================================================

CREATE TABLE IF NOT EXISTS invoice_view_log (
  view_id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(512) NULL,
  INDEX idx_invoice_id (invoice_id)
);
