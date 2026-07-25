-- Migration: Add Finance User Settings JSON columns to user table
-- These columns store subscription, payment, and email settings for Finance users.

ALTER TABLE user ADD COLUMN IF NOT EXISTS subscription_settings_json JSON DEFAULT NULL;
ALTER TABLE user ADD COLUMN IF NOT EXISTS payment_settings_json JSON DEFAULT NULL;
ALTER TABLE user ADD COLUMN IF NOT EXISTS email_settings_json JSON DEFAULT NULL;
