-- ============================================================
-- Migration: Merge 1:1 tables into parent tables
-- Date: 2026-07-27
--
-- This migration merges two strict 1:1 tables:
--   1. user_privacy_settings → user (privacy columns added inline)
--   2. subscription_settings → companies (JSON column added)
--
-- Both merges preserve all existing data and functionality.
-- After successful migration, the old tables can be safely dropped.
-- ============================================================

-- ────────────────────────────────────────────────────────────────
-- 1. MERGE: user_privacy_settings → user table
-- ────────────────────────────────────────────────────────────────

-- Add privacy columns to the user table (defaults match original table)
ALTER TABLE user ADD COLUMN IF NOT EXISTS analytics_tracking TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE user ADD COLUMN IF NOT EXISTS profile_visible TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE user ADD COLUMN IF NOT EXISTS activity_visible TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE user ADD COLUMN IF NOT EXISTS analytics_cookies TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE user ADD COLUMN IF NOT EXISTS marketing_cookies TINYINT(1) NOT NULL DEFAULT 0;

-- Migrate existing privacy settings data from the old table into user
UPDATE user u
  INNER JOIN user_privacy_settings ups ON ups.user_id = u.user_id
SET
  u.analytics_tracking = ups.analytics_tracking,
  u.profile_visible = ups.profile_visible,
  u.activity_visible = ups.activity_visible,
  u.analytics_cookies = ups.analytics_cookies,
  u.marketing_cookies = ups.marketing_cookies;

-- Drop the old table (data has been migrated)
DROP TABLE IF EXISTS user_privacy_settings;


-- ────────────────────────────────────────────────────────────────
-- 2. MERGE: subscription_settings → companies table
-- ────────────────────────────────────────────────────────────────

-- Add JSON column to companies table for subscription settings
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_settings_json JSON NULL;

-- Migrate existing subscription settings data into companies
UPDATE companies c
  INNER JOIN subscription_settings ss ON ss.company_id = c.company_id
SET c.subscription_settings_json = JSON_OBJECT(
  'plans', COALESCE(ss.plans_json, JSON_ARRAY()),
  'billingRules', COALESCE(ss.billing_rules_json, JSON_OBJECT()),
  'automation', COALESCE(ss.automation_settings_json, JSON_OBJECT())
);

-- Drop the old table (data has been migrated)
DROP TABLE IF EXISTS subscription_settings;


-- ════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (run manually to confirm migration success)
-- ════════════════════════════════════════════════════════════════
--
-- Check privacy columns exist on user:
-- SHOW COLUMNS FROM user LIKE '%tracking%';
-- SHOW COLUMNS FROM user LIKE '%visible%';
-- SHOW COLUMNS FROM user LIKE '%cookies%';
--
-- Check subscription settings column on companies:
-- SELECT company_id, subscription_settings_json FROM companies WHERE subscription_settings_json IS NOT NULL;
--
-- Confirm old tables are gone:
-- SHOW TABLES LIKE 'user_privacy_settings';
-- SHOW TABLES LIKE 'subscription_settings';
