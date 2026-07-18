/**
 * Database Backup Service
 *
 * Supports 4 backup types:
 * - FULL: All tables, all data (complete snapshot)
 * - PARTIAL: User-selected tables only
 * - INCREMENTAL: Only data changed since the last backup (any type)
 * - DIFFERENTIAL: Only data changed since the last FULL backup
 *
 * Incremental/Differential detection relies on timestamp columns
 * (created_at, updated_at, date, etc.) found in each table.
 */

const fs = require("fs");
const path = require("path");
const { pool } = require("../config/db");

const BACKUP_DIR = path.join(__dirname, "../../backups");

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Generate a timestamped filename for a backup.
 */
function generateBackupFilename(type) {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `backup_${type.toLowerCase()}_${timestamp}.sql`;
}

/**
 * Escape a value for safe inclusion in a SQL INSERT statement.
 */
function escapeSqlValue(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (value instanceof Date) {
    return `'${value.toISOString().slice(0, 19).replace("T", " ")}'`;
  }
  if (Buffer.isBuffer(value)) {
    return `X'${value.toString("hex")}'`;
  }
  const escaped = String(value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  return `'${escaped}'`;
}

/**
 * Get all table names in the current database.
 */
async function getAllTables() {
  const [rows] = await pool.execute("SHOW TABLES");
  return rows.map((row) => Object.values(row)[0]);
}

/**
 * Generate CREATE TABLE statement for a given table.
 */
async function getCreateTableSQL(tableName) {
  const [rows] = await pool.execute(`SHOW CREATE TABLE \`${tableName}\``);
  return rows[0]["Create Table"];
}

/**
 * Get column names for a table.
 */
async function getTableColumns(tableName) {
  const [rows] = await pool.execute(`SHOW COLUMNS FROM \`${tableName}\``);
  return rows.map((r) => r.Field);
}

/**
 * Find a suitable timestamp column in the table for change tracking.
 * Prioritizes: updated_at > created_at > date > any datetime/timestamp column.
 */
async function findTimestampColumn(tableName) {
  const [rows] = await pool.execute(`SHOW COLUMNS FROM \`${tableName}\``);

  const preferred = ["updated_at", "created_at", "date", "updated", "created"];
  for (const name of preferred) {
    const match = rows.find(
      (r) => r.Field.toLowerCase() === name &&
        (r.Type.includes("datetime") || r.Type.includes("timestamp"))
    );
    if (match) return match.Field;
  }

  // Fallback: any datetime/timestamp column
  const fallback = rows.find(
    (r) => r.Type.includes("datetime") || r.Type.includes("timestamp")
  );
  return fallback ? fallback.Field : null;
}

/**
 * Export rows from a table as INSERT statements.
 * If sinceDate is provided, only exports rows newer than that date.
 */
async function exportTableData(tableName, sinceDate = null) {
  let rows;

  if (sinceDate) {
    const tsCol = await findTimestampColumn(tableName);
    if (tsCol) {
      const sinceStr = sinceDate.toISOString().slice(0, 19).replace("T", " ");
      [rows] = await pool.execute(
        `SELECT * FROM \`${tableName}\` WHERE \`${tsCol}\` >= ?`,
        [sinceStr]
      );
    } else {
      // No timestamp column — include all data (can't determine changes)
      [rows] = await pool.execute(`SELECT * FROM \`${tableName}\``);
    }
  } else {
    [rows] = await pool.execute(`SELECT * FROM \`${tableName}\``);
  }

  if (rows.length === 0) {
    return { sql: `-- No data in table \`${tableName}\`\n`, rowCount: 0 };
  }

  const columns = Object.keys(rows[0]);
  const columnList = columns.map((col) => `\`${col}\``).join(", ");
  let sql = "";

  for (const row of rows) {
    const values = columns.map((col) => escapeSqlValue(row[col])).join(", ");
    sql += `INSERT INTO \`${tableName}\` (${columnList}) VALUES (${values});\n`;
  }

  return { sql, rowCount: rows.length };
}

/**
 * Get the date of the last backup of a given type (or any type).
 */
async function getLastBackupDate(type = null) {
  let query;
  let params;

  if (type) {
    query = "SELECT date FROM backup WHERE status = 1 AND type = ? ORDER BY date DESC LIMIT 1";
    params = [type];
  } else {
    query = "SELECT date FROM backup WHERE status = 1 ORDER BY date DESC LIMIT 1";
    params = [];
  }

  const [rows] = await pool.execute(query, params);
  return rows.length > 0 ? new Date(rows[0].date) : null;
}

/**
 * Create a database backup.
 *
 * @param {Object} options
 * @param {string} options.type - "FULL", "PARTIAL", "INCREMENTAL", or "DIFFERENTIAL"
 * @param {string[]} [options.tables] - Tables to include (for PARTIAL only)
 * @param {number} options.userId - User who triggered the backup
 * @returns {Object} Backup metadata
 */
async function createBackup({ type = "FULL", tables: selectedTables, userId }) {
  const allTables = await getAllTables();
  let tablesToBackup;
  let sinceDate = null;

  // Determine which tables and date range
  switch (type) {
    case "PARTIAL":
      if (!selectedTables || selectedTables.length === 0) {
        throw new Error("Please select at least one table for partial backup");
      }
      tablesToBackup = selectedTables.filter((t) => allTables.includes(t));
      if (tablesToBackup.length === 0) {
        throw new Error("None of the selected tables exist in the database");
      }
      break;

    case "INCREMENTAL":
      tablesToBackup = allTables;
      sinceDate = await getLastBackupDate(); // since last backup of ANY type
      if (!sinceDate) {
        // No previous backup exists — fallback to full export
        sinceDate = null;
      }
      break;

    case "DIFFERENTIAL":
      tablesToBackup = allTables;
      sinceDate = await getLastBackupDate("FULL"); // since last FULL backup
      if (!sinceDate) {
        // No full backup exists — export everything
        sinceDate = null;
      }
      break;

    default:
      // FULL
      type = "FULL";
      tablesToBackup = allTables;
      break;
  }

  const dbName = process.env.DB_NAME;
  const filename = generateBackupFilename(type);
  const filepath = path.join(BACKUP_DIR, filename);

  let sql = "";
  sql += `-- Database Backup: ${dbName}\n`;
  sql += `-- Type: ${type}\n`;
  sql += `-- Created: ${new Date().toISOString()}\n`;
  sql += `-- Tables: ${tablesToBackup.length}\n`;
  if (sinceDate) {
    sql += `-- Changes since: ${sinceDate.toISOString()}\n`;
  }
  sql += `-- Generated by PayNivo Backup Service\n`;
  sql += `\n`;
  sql += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

  let totalRows = 0;

  for (const table of tablesToBackup) {
    sql += `-- --------------------------------------------------------\n`;
    sql += `-- Table: \`${table}\`\n`;
    sql += `-- --------------------------------------------------------\n\n`;

    // For FULL and PARTIAL, include schema; for INCREMENTAL/DIFFERENTIAL, data only
    if (type === "FULL" || type === "PARTIAL") {
      sql += `DROP TABLE IF EXISTS \`${table}\`;\n`;
      const createSQL = await getCreateTableSQL(table);
      sql += `${createSQL};\n\n`;
    }

    const { sql: dataSQL, rowCount } = await exportTableData(table, sinceDate);
    sql += `${dataSQL}\n`;
    totalRows += rowCount;
  }

  sql += `SET FOREIGN_KEY_CHECKS = 1;\n`;

  fs.writeFileSync(filepath, sql, "utf8");
  const stats = fs.statSync(filepath);
  const fileSizeKB = (stats.size / 1024).toFixed(2);

  return {
    filename,
    filepath,
    fileSize: parseFloat(fileSizeKB),
    tables: tablesToBackup.length,
    rows: totalRows,
    type,
    createdAt: new Date().toISOString()
  };
}

/**
 * Get the full path for a backup file.
 * Returns null if file does not exist.
 */
function getBackupFilePath(filename) {
  const safeName = path.basename(filename);
  const filepath = path.join(BACKUP_DIR, safeName);
  if (!fs.existsSync(filepath)) {
    return null;
  }
  return filepath;
}

/**
 * Delete a backup file from disk.
 */
function deleteBackupFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

/**
 * Restore the database from a backup file.
 * WARNING: This will execute all SQL statements in the backup.
 */
async function restoreBackup(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error("Backup file not found on disk");
  }

  const sql = fs.readFileSync(filePath, "utf8");

  // Split into individual statements (skip comments and empty lines)
  const statements = sql
    .split(";\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const statement of statements) {
      if (statement.length > 0) {
        await connection.execute(statement);
      }
    }

    await connection.commit();
    return { success: true, statementsExecuted: statements.length };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  createBackup,
  getAllTables,
  getBackupFilePath,
  deleteBackupFile,
  restoreBackup,
  BACKUP_DIR
};
