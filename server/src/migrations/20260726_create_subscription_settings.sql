CREATE TABLE IF NOT EXISTS subscription_settings (
  company_id               INT          NOT NULL,
  plans_json               JSON         NULL,
  billing_rules_json       JSON         NULL,
  automation_settings_json JSON         NULL,
  updated_by               INT          NULL,
  created_at               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
