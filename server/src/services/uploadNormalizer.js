/**
 * EVALUATION HEADER
 * FEATURE: SHARED / APPLICATION CORE
 * PURPOSE: Provides reusable upload Normalizer business or integration operations.
 * LAYER: Backend service - contains reusable business rules or external integrations.
 * FIND RELATED CODE: Use Find All References to locate controllers, workers, or services that call it.
 */
/**
 * Upload Data Normalization Module
 *
 * Provides header mapping and row normalization for HR staff uploads.
 * Handles whitespace trimming, numeric conversion, and date normalization.
 */

// Canonical headers expected for staff import
const CANONICAL_HEADERS = [
  'employee_id',
  'name',
  'email',
  'phone',
  'hire_date',
  'base_salary',
  'status',
  'department_id',
  'user_user_id',
  'race',
  'religion',
  'bank',
  'account_no'
];

/**
 * Normalizes a separator-delimited key by replacing hyphens and spaces with
 * underscores and converting to lowercase. This allows case-insensitive and
 * separator-agnostic comparison of header names.
 *
 * @param {string} key - The header name to normalize
 * @returns {string} Normalized key
 */
function normalizeKey(key) {
  return String(key)
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');
}

/**
 * Maps file headers to canonical field names using case-insensitive matching
 * with underscores, hyphens, and spaces treated as equivalent separators.
 *
 * @param {string[]} headers - Array of header strings from the uploaded file
 * @returns {{ headerMapping: Object<string, string>, missingHeaders: string[] }}
 *   - headerMapping: Maps canonical field name → actual header found in the file
 *   - missingHeaders: Canonical headers that could not be matched
 */
function mapHeaders(headers) {
  const headerMapping = {};
  const normalizedActualHeaders = {};

  // Build a lookup of normalized actual header → original header name
  for (const header of headers) {
    const normalized = normalizeKey(header);
    normalizedActualHeaders[normalized] = header;
  }

  // Common synonyms / alternate names for canonical headers
  const synonyms = {
    employee_id: ['employee_id', 'staff_id', 'emp_id', 'employeeid', 'staffid'],
    name: ['name', 'staff_name', 'employee_name', 'full_name', 'fullname'],
    email: ['email', 'email_address', 'emailaddress'],
    phone: ['phone', 'phone_number', 'phonenumber', 'contact', 'contact_number'],
    hire_date: ['hire_date', 'hiredate', 'date_hired', 'datehired', 'start_date'],
    base_salary: ['base_salary', 'basesalary', 'salary', 'base_pay'],
    status: ['status', 'employee_status'],
    department_id: ['department_id', 'departmentid', 'dept_id', 'deptid'],
    user_user_id: ['user_user_id', 'useruserid', 'user_id', 'userid'],
    race: ['race', 'ethnicity'],
    religion: ['religion'],
    bank: ['bank', 'bank_name', 'bankname'],
    account_no: ['account_no', 'accountno', 'account_number', 'accountnumber', 'bank_account']
  };

  const missingHeaders = [];

  for (const canonical of CANONICAL_HEADERS) {
    let matched = false;

    // First try direct normalized match
    if (normalizedActualHeaders[canonical]) {
      headerMapping[canonical] = normalizedActualHeaders[canonical];
      matched = true;
      continue;
    }

    // Try synonyms
    const canonicalSynonyms = synonyms[canonical] || [canonical];
    for (const synonym of canonicalSynonyms) {
      const normalizedSynonym = normalizeKey(synonym);
      if (normalizedActualHeaders[normalizedSynonym]) {
        headerMapping[canonical] = normalizedActualHeaders[normalizedSynonym];
        matched = true;
        break;
      }
    }

    if (!matched) {
      missingHeaders.push(canonical);
    }
  }

  return { headerMapping, missingHeaders };
}

/**
 * Month name abbreviation map for DD-Mon-YYYY date parsing.
 */
const MONTH_MAP = {
  jan: '01', feb: '02', mar: '03', apr: '04',
  may: '05', jun: '06', jul: '07', aug: '08',
  sep: '09', oct: '10', nov: '11', dec: '12'
};

/**
 * Normalizes a date string to ISO 8601 format (YYYY-MM-DD).
 * Accepted formats:
 *   - YYYY-MM-DD (already ISO)
 *   - DD/MM/YYYY
 *   - MM/DD/YYYY
 *   - DD-Mon-YYYY (e.g., 15-Jan-2024)
 *
 * For DD/MM/YYYY vs MM/DD/YYYY ambiguity: if the first segment > 12,
 * it must be DD/MM/YYYY. If second segment > 12, it must be MM/DD/YYYY.
 * If both are <= 12, we default to DD/MM/YYYY convention.
 *
 * @param {string} dateStr - Raw date string
 * @returns {string|null} ISO date string or null if not parseable
 */
function normalizeDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Pattern 1: YYYY-MM-DD (ISO format)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    if (isValidDate(year, month, day)) {
      return `${year}-${pad(month)}-${pad(day)}`;
    }
    return null;
  }

  // Pattern 2: DD-Mon-YYYY (e.g., 15-Jan-2024)
  const monMatch = trimmed.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[-\s](\d{4})$/);
  if (monMatch) {
    const [, day, monStr, year] = monMatch;
    const month = MONTH_MAP[monStr.toLowerCase()];
    if (month && isValidDate(year, month, day)) {
      return `${year}-${month}-${pad(day)}`;
    }
    return null;
  }

  // Pattern 3: DD/MM/YYYY or MM/DD/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, part1, part2, year] = slashMatch;
    const p1 = parseInt(part1, 10);
    const p2 = parseInt(part2, 10);

    // Disambiguate DD/MM/YYYY vs MM/DD/YYYY
    if (p1 > 12 && p2 <= 12) {
      // part1 must be day (> 12), part2 is month → DD/MM/YYYY
      if (isValidDate(year, part2, part1)) {
        return `${year}-${pad(part2)}-${pad(part1)}`;
      }
    } else if (p2 > 12 && p1 <= 12) {
      // part2 must be day (> 12), part1 is month → MM/DD/YYYY
      if (isValidDate(year, part1, part2)) {
        return `${year}-${pad(part1)}-${pad(part2)}`;
      }
    } else {
      // Both <= 12: default to DD/MM/YYYY
      if (isValidDate(year, part2, part1)) {
        return `${year}-${pad(part2)}-${pad(part1)}`;
      }
    }
    return null;
  }

  return null;
}

/**
 * Validates that a given year, month, day represent a real calendar date.
 */
function isValidDate(year, month, day) {
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);

  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  if (y < 1900 || y > 2100) return false;

  // Use Date object for full validation (handles leap years, month lengths)
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

/**
 * Zero-pads a number or string to 2 digits.
 */
function pad(val) {
  return String(val).padStart(2, '0');
}

/**
 * Converts a salary string to a numeric value.
 * Strips commas and whitespace before parsing.
 *
 * @param {*} value - Raw salary value
 * @returns {number|null} Parsed number or null if not parseable
 */
function normalizeSalary(value) {
  if (value === null || value === undefined) return null;

  const str = String(value).trim().replace(/,/g, '');
  if (str === '') return null;

  const num = Number(str);
  if (isNaN(num) || !isFinite(num)) return null;

  return num;
}

/**
 * Normalizes a single row of parsed file data into canonical field names
 * with cleaned values.
 *
 * - All string values are trimmed of leading/trailing whitespace
 * - base_salary is converted to numeric (commas stripped) or null
 * - hire_date is normalized to ISO 8601 (YYYY-MM-DD) or left as-is for
 *   downstream validation to flag as error
 *
 * @param {Object} rawRow - Raw row object from file parser output
 * @param {Object} headerMapping - Maps canonical field names to actual header names
 * @returns {Object} Normalized row object with canonical field names
 */
function normalizeRow(rawRow, headerMapping) {
  const normalized = {};

  for (const canonical of CANONICAL_HEADERS) {
    const actualHeader = headerMapping[canonical];
    if (!actualHeader) {
      normalized[canonical] = null;
      continue;
    }

    let value = rawRow[actualHeader];

    // Trim string values
    if (typeof value === 'string') {
      value = value.trim();
    } else if (value !== null && value !== undefined) {
      value = String(value).trim();
    }

    // Apply field-specific normalization
    if (canonical === 'base_salary') {
      normalized[canonical] = normalizeSalary(value);
    } else if (canonical === 'hire_date') {
      const normalizedDate = normalizeDate(value);
      // If date cannot be normalized, keep original trimmed value for
      // downstream validation to classify as error (Requirement 11.4)
      normalized[canonical] = normalizedDate !== null ? normalizedDate : (value || null);
    } else {
      // For all other string fields, store trimmed value or null if empty
      normalized[canonical] = value === '' || value === undefined || value === null ? null : value;
    }
  }

  return normalized;
}

module.exports = {
  normalizeRow,
  mapHeaders,
  normalizeDate,
  normalizeSalary,
  normalizeKey,
  CANONICAL_HEADERS
};
