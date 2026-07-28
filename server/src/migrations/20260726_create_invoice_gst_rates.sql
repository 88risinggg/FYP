CREATE TABLE IF NOT EXISTS invoice_gst_rates (
  gst_rate_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id INT NULL,
  tax_code VARCHAR(30) NOT NULL,
  tax_name VARCHAR(30) NOT NULL DEFAULT 'GST',
  rate_percentage DECIMAL(8,2) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by_user_id INT NULL,
  created_by VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (gst_rate_id),
  INDEX idx_invoice_gst_rates_company_dates (company_id, is_active, effective_from, effective_to)
);

INSERT INTO invoice_gst_rates
  (company_id, tax_code, tax_name, rate_percentage, effective_from, effective_to, is_active, created_by)
SELECT NULL, 'GST_9', 'GST', 9.00, '2024-01-01', NULL, 1, 'System'
WHERE NOT EXISTS (
  SELECT 1 FROM invoice_gst_rates WHERE company_id IS NULL
);

ALTER TABLE invoice ADD COLUMN IF NOT EXISTS subtotal_amount DECIMAL(12,2) NULL;
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS tax_name VARCHAR(30) NULL;
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(8,2) NULL;
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(12,2) NULL;
