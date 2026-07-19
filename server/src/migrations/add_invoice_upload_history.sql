CREATE TABLE IF NOT EXISTS invoice_upload_history (
  upload_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(150) NULL,
  status ENUM('Pending', 'Validated', 'Successful', 'Failed') NOT NULL DEFAULT 'Pending',
  total_rows INT UNSIGNED NOT NULL DEFAULT 0,
  valid_rows INT UNSIGNED NOT NULL DEFAULT 0,
  invalid_rows INT UNSIGNED NOT NULL DEFAULT 0,
  created_invoices INT UNSIGNED NOT NULL DEFAULT 0,
  error_message TEXT NULL,
  uploaded_by INT NULL,
  uploader_email VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  PRIMARY KEY (upload_id),
  INDEX idx_invoice_upload_created_at (created_at),
  INDEX idx_invoice_upload_status (status),
  INDEX idx_invoice_upload_uploaded_by (uploaded_by)
);

CREATE TABLE IF NOT EXISTS invoice_upload_validation_errors (
  validation_error_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  upload_id BIGINT UNSIGNED NOT NULL,
  source_row_number INT UNSIGNED NULL,
  invoice_number VARCHAR(100) NULL,
  field_name VARCHAR(100) NULL,
  error_message TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (validation_error_id),
  INDEX idx_invoice_validation_upload (upload_id),
  CONSTRAINT fk_invoice_validation_upload
    FOREIGN KEY (upload_id) REFERENCES invoice_upload_history(upload_id)
    ON DELETE CASCADE
);
