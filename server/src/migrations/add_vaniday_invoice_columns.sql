-- Migration: Add Vaniday-specific columns to invoice table
-- Tracks the original Vaniday booking data for audit and display

ALTER TABLE invoice ADD COLUMN IF NOT EXISTS vaniday_order_id VARCHAR(100) NULL;
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS shop_title VARCHAR(255) NULL;
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS seller_id VARCHAR(100) NULL;
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS service_provider VARCHAR(255) NULL;
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS vaniday_share DECIMAL(10,2) NULL;
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS salon_share DECIMAL(10,2) NULL;
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS vaniday_commission DECIMAL(8,2) NULL;
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS items_json JSON NULL;

-- Add phone column to customer for Vaniday contact number
ALTER TABLE customer ADD COLUMN IF NOT EXISTS phone VARCHAR(50) NULL;
ALTER TABLE customer ADD COLUMN IF NOT EXISTS vaniday_customer_id VARCHAR(100) NULL;
ALTER TABLE customer ADD COLUMN IF NOT EXISTS data_source VARCHAR(50) NULL DEFAULT 'manual';

-- Index for fast OrderID lookup during duplicate detection
CREATE INDEX IF NOT EXISTS idx_invoice_vaniday_order ON invoice (vaniday_order_id);
CREATE INDEX IF NOT EXISTS idx_customer_email ON customer (email);

-- Update invoice status ENUM to include all statuses from the spec
ALTER TABLE invoice MODIFY COLUMN status
  ENUM('Draft', 'Generated', 'Scheduled', 'Sent', 'Viewed', 'Unpaid', 'Partially_Paid', 'Paid', 'Overdue', 'Cancelled', 'Void', 'Refunded', 'Failed_Payment')
  DEFAULT 'Draft';
