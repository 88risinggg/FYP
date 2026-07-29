/**
 * EVALUATION HEADER
 * FEATURE: SHARED / APPLICATION CORE
 * PURPOSE: Provides reusable upload Row Validator business or integration operations.
 * LAYER: Backend service - contains reusable business rules or external integrations.
 * FIND RELATED CODE: Use Find All References to locate controllers, workers, or services that call it.
 */
/**
 * Upload Row Validator
 *
 * Validates a normalized row object against field rules.
 * Preconditions: row is a non-null object with normalized field names,
 * row has been through normalizeRow() processing.
 *
 * Postconditions:
 * - Returns an array of human-readable error strings
 * - Empty array means the row is valid
 * - Each error identifies the field and issue
 * - Does NOT mutate the input row
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates a single normalized row.
 * @param {Object} row - Normalized row object with a rowNumber property
 * @returns {string[]} Array of error messages (empty if valid)
 */
function validateRow(row) {
  const errors = [];
  const rowNum = row.rowNumber;

  // Required: name (non-empty after trim)
  if (!row.name || (typeof row.name === 'string' && row.name.trim() === '')) {
    errors.push(`Row ${rowNum}: "name" is required and must not be empty`);
  }

  // Required: hire_date (valid ISO 8601 YYYY-MM-DD date)
  if (!row.hire_date || (typeof row.hire_date === 'string' && row.hire_date.trim() === '')) {
    errors.push(`Row ${rowNum}: "hire_date" is required`);
  } else {
    if (!isValidISODate(row.hire_date)) {
      errors.push(`Row ${rowNum}: "hire_date" must be a valid date in YYYY-MM-DD format`);
    }
  }

  // Optional: email (skip if absent or empty)
  if (row.email !== undefined && row.email !== null && row.email !== '') {
    if (!EMAIL_PATTERN.test(row.email)) {
      errors.push(`Row ${rowNum}: "email" format is invalid`);
    }
  }

  // Optional: phone (skip if absent or empty, must not contain alphabetic characters)
  if (row.phone !== undefined && row.phone !== null && row.phone !== '') {
    const phoneStr = String(row.phone);
    if (/[a-zA-Z]/.test(phoneStr)) {
      errors.push(`Row ${rowNum}: "phone" must not contain alphabetic characters`);
    }
  }

  // Optional: base_salary (skip if absent/null/empty, must be numeric, non-negative, finite)
  if (row.base_salary !== undefined && row.base_salary !== null && row.base_salary !== '') {
    const salary = Number(row.base_salary);
    if (isNaN(salary) || !isFinite(salary)) {
      errors.push(`Row ${rowNum}: "base_salary" must be a valid finite number`);
    } else if (salary < 0) {
      errors.push(`Row ${rowNum}: "base_salary" must not be negative`);
    }
  }

  return errors;
}

/**
 * Checks if a string is a valid ISO 8601 date (YYYY-MM-DD) representing a real calendar date.
 * @param {string} dateStr
 * @returns {boolean}
 */
function isValidISODate(dateStr) {
  if (typeof dateStr !== 'string') return false;
  if (!ISO_DATE_PATTERN.test(dateStr)) return false;

  // Parse and verify it's a real calendar date
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

module.exports = { validateRow };
