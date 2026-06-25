CREATE TABLE IF NOT EXISTS fraud_vendor_profile (
  vendor_id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_name VARCHAR(255) NOT NULL UNIQUE,
  status ENUM('Verified', 'Suspended', 'Unknown') NOT NULL DEFAULT 'Verified',
  verified_bank_account_hash VARCHAR(128) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoice_fraud_metadata (
  metadata_id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL UNIQUE,
  vendor_name VARCHAR(255) NULL,
  bank_account_hash VARCHAR(128) NULL,
  source VARCHAR(50) NOT NULL DEFAULT 'invoice',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_invoice_fraud_metadata_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoice(invoice_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invoice_fraud_assessment (
  assessment_id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL UNIQUE,
  risk_score TINYINT UNSIGNED NOT NULL DEFAULT 0,
  risk_level ENUM('Low', 'Medium', 'High') NOT NULL DEFAULT 'Low',
  review_status ENUM('Open', 'Approved', 'Rejected') NOT NULL DEFAULT 'Open',
  model_version VARCHAR(50) NOT NULL DEFAULT 'rules-v1',
  assessed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_invoice_fraud_assessment_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoice(invoice_id)
    ON DELETE CASCADE,
  INDEX idx_fraud_assessment_risk (risk_level, risk_score),
  INDEX idx_fraud_assessment_review (review_status, assessed_at)
);

CREATE TABLE IF NOT EXISTS invoice_fraud_indicator (
  indicator_id INT AUTO_INCREMENT PRIMARY KEY,
  assessment_id INT NOT NULL,
  indicator_code VARCHAR(80) NOT NULL,
  indicator_label VARCHAR(255) NOT NULL,
  severity TINYINT UNSIGNED NOT NULL DEFAULT 0,
  details_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_invoice_fraud_indicator_assessment
    FOREIGN KEY (assessment_id) REFERENCES invoice_fraud_assessment(assessment_id)
    ON DELETE CASCADE,
  INDEX idx_fraud_indicator_code (indicator_code)
);

CREATE TABLE IF NOT EXISTS fraud_alert (
  alert_id INT AUTO_INCREMENT PRIMARY KEY,
  assessment_id INT NOT NULL,
  invoice_id INT NOT NULL,
  alert_type VARCHAR(80) NOT NULL,
  message VARCHAR(255) NOT NULL,
  status ENUM('Open', 'Acknowledged', 'Resolved') NOT NULL DEFAULT 'Open',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  CONSTRAINT fk_fraud_alert_assessment
    FOREIGN KEY (assessment_id) REFERENCES invoice_fraud_assessment(assessment_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_fraud_alert_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoice(invoice_id)
    ON DELETE CASCADE,
  INDEX idx_fraud_alert_status (status, created_at)
);

CREATE TABLE IF NOT EXISTS employee_authorization_limit (
  limit_id INT AUTO_INCREMENT PRIMARY KEY,
  user_user_id INT NOT NULL UNIQUE,
  approval_limit DECIMAL(12, 2) NOT NULL DEFAULT 5000.00,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_employee_authorization_user
    FOREIGN KEY (user_user_id) REFERENCES user(user_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invoice_approval (
  approval_id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  user_user_id INT NULL,
  decision ENUM('Approved', 'Rejected') NOT NULL,
  notes TEXT NULL,
  risk_score_at_decision TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_invoice_approval_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoice(invoice_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_invoice_approval_user
    FOREIGN KEY (user_user_id) REFERENCES user(user_id)
    ON DELETE SET NULL,
  INDEX idx_invoice_approval_user_vendor (user_user_id, created_at),
  INDEX idx_invoice_approval_invoice (invoice_id, created_at)
);

CREATE OR REPLACE VIEW fraud_training_dataset AS
SELECT
  i.invoice_id,
  i.invoiceId,
  i.customer_id,
  c.name AS customer_name,
  ifm.vendor_name,
  i.issue_date,
  i.due_date,
  i.total_amount,
  i.status AS invoice_status,
  ifa.risk_score,
  ifa.risk_level,
  ifa.review_status,
  ifa.model_version,
  ifa.assessed_at
FROM invoice i
INNER JOIN customer c ON c.customer_id = i.customer_id
LEFT JOIN invoice_fraud_metadata ifm ON ifm.invoice_id = i.invoice_id
LEFT JOIN invoice_fraud_assessment ifa ON ifa.invoice_id = i.invoice_id;
