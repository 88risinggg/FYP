/**
 * EVALUATION HEADER
 * FEATURE: SHARED / APPLICATION CORE
 * PURPOSE: Reads and writes backup Model data in the database.
 * LAYER: Backend model - contains database queries and persistence operations.
 * FIND RELATED CODE: Use Find All References to locate the controller/service that requests this data.
 */
/**
 * Backup Model
 *
 * Interacts with the `backup` table to log and manage backup records.
 */

const { pool } = require("../config/db");

/**
 * Create a new backup record.
 */
async function createBackupRecord({ name, filePath, fileSize, type, userId }) {
  const [result] = await pool.execute(
    `INSERT INTO backup (name, file_path, file_size, type, user_user_id)
     VALUES (?, ?, ?, ?, ?)`,
    [name, filePath, fileSize, type, userId]
  );
  return result.insertId;
}

/**
 * Get all backup records ordered by date descending.
 */
async function getAllBackups() {
  const [rows] = await pool.execute(
    `SELECT b.backup_id, b.name, b.file_path, b.file_size, b.type, b.date, b.status,
            u.email AS created_by
     FROM backup b
     LEFT JOIN user u ON b.user_user_id = u.user_id
     ORDER BY b.date DESC`
  );
  return rows;
}

/**
 * Get a single backup record by ID.
 */
async function getBackupById(backupId) {
  const [rows] = await pool.execute(
    `SELECT * FROM backup WHERE backup_id = ?`,
    [backupId]
  );
  return rows[0] || null;
}

/**
 * Soft-delete a backup by setting status to 0.
 */
async function deleteBackupRecord(backupId) {
  const [result] = await pool.execute(
    `UPDATE backup SET status = 0 WHERE backup_id = ?`,
    [backupId]
  );
  return result.affectedRows > 0;
}

/**
 * Get active backups only (status = 1).
 */
async function getActiveBackups() {
  const [rows] = await pool.execute(
    `SELECT b.backup_id, b.name, b.file_path, b.file_size, b.type, b.date, b.status,
            u.email AS created_by
     FROM backup b
     LEFT JOIN user u ON b.user_user_id = u.user_id
     WHERE b.status = 1
     ORDER BY b.date DESC`
  );
  return rows;
}

module.exports = {
  createBackupRecord,
  getAllBackups,
  getBackupById,
  deleteBackupRecord,
  getActiveBackups
};
