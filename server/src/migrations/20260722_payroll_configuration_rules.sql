CREATE TABLE IF NOT EXISTS payroll_configuration (
  configuration_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  configuration_type VARCHAR(40) NOT NULL DEFAULT 'setting',
  configuration_key VARCHAR(191) NOT NULL,
  configuration_value LONGTEXT NOT NULL,
  description VARCHAR(500) NULL,
  updated_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (configuration_id),
  UNIQUE KEY uq_payroll_configuration_type_key (configuration_type, configuration_key),
  KEY idx_payroll_configuration_updated_by (updated_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
