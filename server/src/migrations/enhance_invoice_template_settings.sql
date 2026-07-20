-- Migration: Enhance invoice_settings with full template configuration attributes
-- Adds all fields required for a fully dynamic, database-driven invoice template

-- =====================================================
-- Template Identity
-- =====================================================
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS template_name VARCHAR(100) NOT NULL DEFAULT 'Default Template';
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS template_description TEXT NULL;

-- =====================================================
-- Company Extended Details
-- =====================================================
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS uen_number VARCHAR(50) NOT NULL DEFAULT '';
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS gst_registration_number VARCHAR(50) NOT NULL DEFAULT '';
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS company_phone VARCHAR(50) NOT NULL DEFAULT '';
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS company_email VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS company_website VARCHAR(255) NOT NULL DEFAULT '';

-- =====================================================
-- Theme & Styling
-- =====================================================
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS primary_color VARCHAR(20) NOT NULL DEFAULT '#061e4b';
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(20) NOT NULL DEFAULT '#ff5a52';
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS font_family VARCHAR(100) NOT NULL DEFAULT 'Arial, Helvetica, sans-serif';
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS font_size_base INT NOT NULL DEFAULT 12;
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS invoice_border_style VARCHAR(30) NOT NULL DEFAULT 'modern';
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS header_style VARCHAR(30) NOT NULL DEFAULT 'default';
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS footer_style VARCHAR(30) NOT NULL DEFAULT 'default';
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS item_table_style VARCHAR(30) NOT NULL DEFAULT 'striped';

-- =====================================================
-- Currency & Formatting
-- =====================================================
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(10) NOT NULL DEFAULT 'S$';
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS currency_format VARCHAR(30) NOT NULL DEFAULT 'symbol_before';
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS display_date_format VARCHAR(30) NOT NULL DEFAULT 'DD MMM YYYY';
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS display_time_format VARCHAR(20) NOT NULL DEFAULT 'HH:mm';
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS decimal_precision INT NOT NULL DEFAULT 2;

-- =====================================================
-- Invoice Number Configuration
-- =====================================================
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS running_number INT NOT NULL DEFAULT 1;
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS reset_number_yearly TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS invoice_date_source VARCHAR(30) NOT NULL DEFAULT 'issue_date';

-- =====================================================
-- Tax Configuration
-- =====================================================
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS tax_enabled TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS tax_name VARCHAR(30) NOT NULL DEFAULT 'GST';
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS tax_percentage DECIMAL(8,2) NOT NULL DEFAULT 9.00;
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS tax_inclusive TINYINT(1) NOT NULL DEFAULT 0;

-- =====================================================
-- Defaults
-- =====================================================
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS default_discount DECIMAL(8,2) NOT NULL DEFAULT 0.00;
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS default_notes TEXT NULL;
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT NULL;

-- =====================================================
-- Display Toggles
-- =====================================================
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS qr_code_display TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS bank_details_display TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS paynow_display TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS signature_display TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS watermark_enabled TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS status_badge_style VARCHAR(30) NOT NULL DEFAULT 'ribbon';
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS company_stamp_url VARCHAR(500) NULL;
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS signature_url VARCHAR(500) NULL;

-- =====================================================
-- PDF Options
-- =====================================================
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS pdf_page_size VARCHAR(10) NOT NULL DEFAULT 'A4';
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS pdf_orientation VARCHAR(12) NOT NULL DEFAULT 'portrait';

-- =====================================================
-- Vaniday Field Mapping (JSON)
-- =====================================================
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS vaniday_field_mapping JSON NULL;

-- =====================================================
-- Audit Log Enhanced Tracking
-- =====================================================
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS previous_value TEXT NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_value TEXT NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45) NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS device_info VARCHAR(512) NULL;
