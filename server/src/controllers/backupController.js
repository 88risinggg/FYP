/**
 * Backup Controller
 *
 * Handles API requests for database backup operations.
 * Supports FULL and PARTIAL backup types.
 * All endpoints require Admin role authentication.
 */

const {
  createBackup,
  getAllTables,
  getBackupFilePath,
  deleteBackupFile,
  restoreBackup
} = require("../services/backupService");

const {
  createBackupRecord,
  getActiveBackups,
  getBackupById,
  deleteBackupRecord
} = require("../models/backupModel");

/**
 * POST /api/admin/backups
 *
 * Trigger a manual database backup.
 * Body: { type: "FULL" | "PARTIAL", tables: ["table1", "table2"] }
 */
async function triggerBackup(req, res) {
  try {
    const { type = "FULL", tables } = req.body;
    const userId = req.user.userId;

    if (!["FULL", "PARTIAL", "INCREMENTAL", "DIFFERENTIAL"].includes(type)) {
      return res.status(400).json({ message: "Type must be FULL, PARTIAL, INCREMENTAL, or DIFFERENTIAL" });
    }

    if (type === "PARTIAL" && (!tables || tables.length === 0)) {
      return res.status(400).json({ message: "Please select at least one table for partial backup" });
    }

    const result = await createBackup({ type, tables, userId });

    // Record in the backup table
    const backupId = await createBackupRecord({
      name: result.filename.slice(0, 20),
      filePath: result.filepath,
      fileSize: result.fileSize,
      type,
      userId
    });

    res.status(201).json({
      message: "Backup created successfully",
      backup: {
        backupId,
        filename: result.filename,
        fileSize: result.fileSize,
        tables: result.tables,
        type,
        createdAt: result.createdAt
      }
    });
  } catch (error) {
    console.error("Backup creation failed:", error.message);
    res.status(500).json({
      message: "Failed to create backup",
      detail: error.message
    });
  }
}

/**
 * GET /api/admin/backups
 *
 * List all active backups.
 */
async function getBackups(req, res) {
  try {
    const backups = await getActiveBackups();
    res.json({ backups });
  } catch (error) {
    res.status(500).json({
      message: "Failed to list backups",
      detail: error.message
    });
  }
}

/**
 * GET /api/admin/backups/tables
 *
 * List all available database tables (for partial backup selection).
 */
async function getAvailableTables(req, res) {
  try {
    const tables = await getAllTables();
    res.json({ tables });
  } catch (error) {
    res.status(500).json({
      message: "Failed to list tables",
      detail: error.message
    });
  }
}

/**
 * GET /api/admin/backups/:id/download
 *
 * Download a specific backup file.
 */
async function downloadBackup(req, res) {
  try {
    const { id } = req.params;
    const backup = await getBackupById(id);

    if (!backup || backup.status === 0) {
      return res.status(404).json({ message: "Backup not found" });
    }

    const filepath = backup.file_path;
    const resolvedPath = getBackupFilePath(filepath);

    if (!resolvedPath) {
      return res.status(404).json({ message: "Backup file not found on disk" });
    }

    res.download(resolvedPath, backup.name + ".sql");
  } catch (error) {
    res.status(500).json({
      message: "Failed to download backup",
      detail: error.message
    });
  }
}

/**
 * DELETE /api/admin/backups/:id
 *
 * Soft-delete a backup record and remove the file.
 */
async function removeBackup(req, res) {
  try {
    const { id } = req.params;
    const backup = await getBackupById(id);

    if (!backup || backup.status === 0) {
      return res.status(404).json({ message: "Backup not found" });
    }

    // Remove file from disk
    deleteBackupFile(backup.file_path);

    // Soft-delete record
    await deleteBackupRecord(id);

    res.json({ message: "Backup deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete backup",
      detail: error.message
    });
  }
}

/**
 * POST /api/admin/backups/:id/restore
 *
 * Restore the database from a specific backup.
 */
async function restoreFromBackup(req, res) {
  try {
    const { id } = req.params;
    const backup = await getBackupById(id);

    if (!backup || backup.status === 0) {
      return res.status(404).json({ message: "Backup not found" });
    }

    const result = await restoreBackup(backup.file_path);

    res.json({
      message: "Database restored successfully",
      statementsExecuted: result.statementsExecuted
    });
  } catch (error) {
    console.error("Database restore failed:", error.message);
    res.status(500).json({
      message: "Failed to restore database",
      detail: error.message
    });
  }
}

module.exports = {
  triggerBackup,
  getBackups,
  getAvailableTables,
  downloadBackup,
  removeBackup,
  restoreFromBackup
};
