/**
 * EVALUATION HEADER
 * FEATURE: SHARED / APPLICATION CORE
 * PURPOSE: Implements the application's timezone responsibilities.
 * LAYER: Backend configuration - initializes shared infrastructure or environment settings.
 * FIND RELATED CODE: Use Find All References on its exports to locate connected features.
 */
const APPLICATION_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Singapore";
const DATABASE_TIMEZONE = process.env.DB_TIMEZONE || "+08:00";

// Set this before application modules perform any calendar arithmetic.
process.env.TZ = APPLICATION_TIMEZONE;

module.exports = { APPLICATION_TIMEZONE, DATABASE_TIMEZONE };
