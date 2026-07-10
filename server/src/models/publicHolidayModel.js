/**
 * Public Holiday Model
 *
 * Database initialization and queries for the Public Holiday Management module.
 * Handles public_holidays table creation and holiday-related database operations.
 */

const { pool } = require("../config/db");

/**
 * Ensure the public_holidays table exists.
 * Called on module load to guarantee the table is available before any queries.
 * NOTE: If the table already exists (e.g., with ENUM status), this is a no-op.
 */
async function ensurePublicHolidaysTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public_holidays (
      holiday_id INT AUTO_INCREMENT PRIMARY KEY,
      holiday_name VARCHAR(100) NOT NULL,
      holiday_date DATE NOT NULL,
      description VARCHAR(255) NULL,
      status ENUM('Active', 'Inactive') DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_holiday_date (holiday_date)
    )
  `);
}

// Run table creation on module load
ensurePublicHolidaysTable().catch((err) => {
  console.error("[PUBLIC_HOLIDAYS] Table init error:", err.message);
});

/**
 * Get all public holidays, ordered by date descending.
 */
async function getAllHolidays() {
  const [rows] = await pool.query(
    "SELECT * FROM public_holidays ORDER BY holiday_date DESC"
  );
  return rows;
}

/**
 * Get a single public holiday by ID.
 */
async function getHolidayById(holidayId) {
  const [rows] = await pool.query(
    "SELECT * FROM public_holidays WHERE holiday_id = ?",
    [holidayId]
  );
  return rows[0] || null;
}

/**
 * Check if a holiday date already exists (optionally excluding a specific holiday_id for updates).
 */
async function holidayDateExists(holidayDate, excludeId = null) {
  let sql = "SELECT holiday_id FROM public_holidays WHERE holiday_date = ?";
  const params = [holidayDate];

  if (excludeId) {
    sql += " AND holiday_id != ?";
    params.push(excludeId);
  }

  const [rows] = await pool.query(sql, params);
  return rows.length > 0;
}

/**
 * Create a new public holiday.
 */
async function createHoliday({ holiday_name, holiday_date, description, status }) {
  const statusVal = (status === 'Inactive' || status === 0 || status === '0') ? 'Inactive' : 'Active';
  const [result] = await pool.query(
    `INSERT INTO public_holidays (holiday_name, holiday_date, description, status)
     VALUES (?, ?, ?, ?)`,
    [holiday_name, holiday_date, description || null, statusVal]
  );
  return result.insertId;
}

/**
 * Update an existing public holiday.
 */
async function updateHoliday(holidayId, { holiday_name, holiday_date, description, status }) {
  const statusVal = (status === 'Inactive' || status === 0 || status === '0') ? 'Inactive' : 'Active';
  const [result] = await pool.query(
    `UPDATE public_holidays 
     SET holiday_name = ?, holiday_date = ?, description = ?, status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE holiday_id = ?`,
    [holiday_name, holiday_date, description || null, statusVal, holidayId]
  );
  return result.affectedRows > 0;
}

/**
 * Delete a public holiday by ID.
 */
async function deleteHoliday(holidayId) {
  const [result] = await pool.query(
    "DELETE FROM public_holidays WHERE holiday_id = ?",
    [holidayId]
  );
  return result.affectedRows > 0;
}

/**
 * Get all active public holiday dates for a given year.
 * Used by leave calculation to exclude public holidays from working days.
 */
async function getActiveHolidayDatesForYear(year) {
  const [rows] = await pool.query(
    "SELECT holiday_date FROM public_holidays WHERE status = 'Active' AND YEAR(holiday_date) = ?",
    [year]
  );
  return rows.map((r) => r.holiday_date);
}

/**
 * Get all active public holiday dates within a date range.
 * Used by leave calculation to exclude public holidays from working days.
 */
/**
 * Get all active public holiday dates within a date range.
 * Used by leave calculation to exclude public holidays from working days.
 */
async function getActiveHolidaysInRange(startDate, endDate) {
  const [rows] = await pool.query(
    "SELECT holiday_date FROM public_holidays WHERE status = 'Active' AND holiday_date BETWEEN ? AND ?",
    [startDate, endDate]
  );
  return rows.map((r) => {
    const d = new Date(r.holiday_date);
    // Use local date parts to avoid timezone shift issues
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
}

module.exports = {
  ensurePublicHolidaysTable,
  getAllHolidays,
  getHolidayById,
  holidayDateExists,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  getActiveHolidayDatesForYear,
  getActiveHolidaysInRange,
};
