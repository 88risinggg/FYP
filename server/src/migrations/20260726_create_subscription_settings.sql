-- Subscription settings are now stored as a JSON column on the companies table (1:1 merge).
-- This migration adds the column if it doesn't exist.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_settings_json JSON NULL;

-- Migrate any existing data from the old subscription_settings table (if present)
-- into the companies.subscription_settings_json column.
-- This is a one-time data migration step.
UPDATE companies c
  INNER JOIN subscription_settings ss ON ss.company_id = c.company_id
SET c.subscription_settings_json = JSON_OBJECT(
  'plans', COALESCE(ss.plans_json, JSON_ARRAY()),
  'billingRules', COALESCE(ss.billing_rules_json, JSON_OBJECT()),
  'automation', COALESCE(ss.automation_settings_json, JSON_OBJECT())
)
WHERE c.subscription_settings_json IS NULL;

-- After verifying migration, the old table can be dropped:
-- DROP TABLE IF EXISTS subscription_settings;
