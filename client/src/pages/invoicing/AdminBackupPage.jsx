import {
  Archive,
  CheckCircle2,
  Database,
  Download,
  HardDrive,
  Loader2,
  RotateCcw,
  Trash2,
  Upload
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  createBackup,
  deleteBackup,
  fetchAvailableTables,
  fetchBackups,
  restoreBackup
} from "../../services/backupService.js";

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatSize(kb) {
  if (!kb) return "-";
  if (kb >= 1024) return `${(kb / 1024).toFixed(2)} MB`;
  return `${Number(kb).toFixed(2)} KB`;
}

export default function AdminBackupPage() {
  const [backups, setBackups] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Backup form state
  const [backupType, setBackupType] = useState("FULL");
  const [selectedTables, setSelectedTables] = useState([]);
  const [showTableSelector, setShowTableSelector] = useState(false);

  // Restore confirmation
  const [restoreTarget, setRestoreTarget] = useState(null);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [backupList, tableList] = await Promise.all([
        fetchBackups(),
        fetchAvailableTables()
      ]);
      setBackups(backupList);
      setTables(tableList);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreateBackup() {
    if (backupType === "PARTIAL" && selectedTables.length === 0) {
      setError("Please select at least one table for partial backup");
      return;
    }

    setCreating(true);
    setError("");
    setSuccess("");

    try {
      const result = await createBackup({
        type: backupType,
        tables: backupType === "PARTIAL" ? selectedTables : undefined
      });
      setSuccess(result.message);
      setSelectedTables([]);
      setShowTableSelector(false);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Are you sure you want to delete this backup?")) return;

    setError("");
    setSuccess("");
    try {
      await deleteBackup(id);
      setSuccess("Backup deleted successfully");
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRestore(id) {
    setError("");
    setSuccess("");
    try {
      const result = await restoreBackup(id);
      setSuccess(result.message);
      setRestoreTarget(null);
    } catch (err) {
      setError(err.message);
      setRestoreTarget(null);
    }
  }

  function toggleTable(tableName) {
    setSelectedTables((prev) =>
      prev.includes(tableName)
        ? prev.filter((t) => t !== tableName)
        : [...prev, tableName]
    );
  }

  function selectAllTables() {
    setSelectedTables([...tables]);
  }

  function deselectAllTables() {
    setSelectedTables([]);
  }

  if (loading) {
    return (
      <section className="app-panel rounded-lg p-8 text-center text-[#7b6660]">
        <Loader2 className="mx-auto animate-spin" size={24} />
        <p className="mt-2">Loading backup data...</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm font-medium text-[#F38978]">Data Protection</p>
        <h2 className="mt-1 text-2xl font-semibold text-white">Database Backup & Restore</h2>
        <p className="mt-2 text-sm text-[#7b6660]">
          Create backups of your database and restore from previous backups when needed.
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="rounded-lg border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle2 size={16} />
          {success}
        </div>
      )}

      {/* Create Backup Section */}
      <div className="app-panel rounded-lg p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F38978]/10 text-[#F38978]">
            <HardDrive size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Create New Backup</h3>
            <p className="text-sm text-[#7b6660]">Choose between a full or partial database backup</p>
          </div>
        </div>

        {/* Type Selection */}
        <div className="flex flex-wrap gap-3 mb-5">
          <button
            type="button"
            onClick={() => { setBackupType("FULL"); setShowTableSelector(false); }}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
              backupType === "FULL"
                ? "border-[#F38978]/50 bg-[#F38978]/15 text-white"
                : "border-[#ead3cc] bg-white/[0.05] text-[#7b6660] hover:bg-[#FDD9CD]/50"
            }`}
          >
            <Database size={16} />
            Full Backup
          </button>
          <button
            type="button"
            onClick={() => { setBackupType("PARTIAL"); setShowTableSelector(true); }}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
              backupType === "PARTIAL"
                ? "border-[#F38978]/50 bg-[#F38978]/15 text-white"
                : "border-[#ead3cc] bg-white/[0.05] text-[#7b6660] hover:bg-[#FDD9CD]/50"
            }`}
          >
            <Archive size={16} />
            Partial Backup
          </button>
          <button
            type="button"
            onClick={() => { setBackupType("INCREMENTAL"); setShowTableSelector(false); }}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
              backupType === "INCREMENTAL"
                ? "border-[#F38978]/50 bg-[#F38978]/15 text-white"
                : "border-[#ead3cc] bg-white/[0.05] text-[#7b6660] hover:bg-[#FDD9CD]/50"
            }`}
          >
            <RotateCcw size={16} />
            Incremental
          </button>
          <button
            type="button"
            onClick={() => { setBackupType("DIFFERENTIAL"); setShowTableSelector(false); }}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
              backupType === "DIFFERENTIAL"
                ? "border-[#F38978]/50 bg-[#F38978]/15 text-white"
                : "border-[#ead3cc] bg-white/[0.05] text-[#7b6660] hover:bg-[#FDD9CD]/50"
            }`}
          >
            <HardDrive size={16} />
            Differential
          </button>
        </div>

        {/* Type Description */}
        <div className="mb-5 rounded-lg border border-[#ead3cc] bg-[#fff3ee]/70 px-4 py-3 text-sm text-[#7b6660]">
          {backupType === "FULL" && "Full Backup — Creates a complete snapshot of all tables and data in the database."}
          {backupType === "PARTIAL" && "Partial Backup — Backs up only the tables you select below."}
          {backupType === "INCREMENTAL" && "Incremental Backup — Backs up only data that has changed since the last backup (any type)."}
          {backupType === "DIFFERENTIAL" && "Differential Backup — Backs up all data that has changed since the last Full backup."}
        </div>

        {/* Table Selector for Partial Backup */}
        {showTableSelector && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-[#7b6660]">
                Select tables to backup ({selectedTables.length} of {tables.length} selected)
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllTables}
                  className="text-xs text-[#F38978] hover:underline"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={deselectAllTables}
                  className="text-xs text-[#7b6660] hover:underline"
                >
                  Deselect All
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-60 overflow-y-auto rounded-lg border border-[#ead3cc] bg-[#fff3ee]/70 p-3">
              {tables.map((table) => (
                <label
                  key={table}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer transition ${
                    selectedTables.includes(table)
                      ? "bg-[#F38978]/15 text-white"
                      : "text-[#7b6660] hover:bg-[#FDD9CD]/45"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedTables.includes(table)}
                    onChange={() => toggleTable(table)}
                    className="rounded border-white/20 bg-[#FDD9CD]/50 text-[#F38978] focus:ring-[#F38978]/50"
                  />
                  {table}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Backup Button */}
        <button
          type="button"
          onClick={handleCreateBackup}
          disabled={creating}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#F38978] to-[#F38978] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#E77463]/30 hover:opacity-90 disabled:opacity-50"
        >
          {creating ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Creating Backup...
            </>
          ) : (
            <>
              <Upload size={16} />
              Create {backupType === "FULL" ? "Full" : backupType === "PARTIAL" ? "Partial" : backupType === "INCREMENTAL" ? "Incremental" : "Differential"} Backup
            </>
          )}
        </button>
      </div>

      {/* Backup History */}
      <div className="app-panel rounded-lg p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#fff3ee] text-emerald-700">
            <Archive size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Backup History</h3>
            <p className="text-sm text-[#7b6660]">{backups.length} backup(s) available</p>
          </div>
        </div>

        {backups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#ead3cc] bg-[#fff3ee]/70 px-4 py-8 text-center text-sm text-[#7b6660]">
            No backups created yet. Create your first backup above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#ead3cc] text-left text-xs uppercase tracking-wide text-[#7b6660]/70">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Created By</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr
                    key={backup.backup_id}
                    className="border-b border-[#f0d2ca] hover:bg-[#FDD9CD]/35"
                  >
                    <td className="px-4 py-3 font-medium text-white">{backup.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          backup.type === "FULL"
                            ? "bg-emerald-400/10 text-emerald-700 border border-emerald-300/20"
                            : backup.type === "INCREMENTAL"
                            ? "bg-sky-400/10 text-sky-700 border border-sky-300/20"
                            : backup.type === "DIFFERENTIAL"
                            ? "bg-[#FDD9CD]/45 text-[#F38978] border border-[#f0d2ca]"
                            : "bg-amber-400/10 text-amber-700 border border-amber-300/20"
                        }`}
                      >
                        {backup.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#7b6660]">{formatSize(backup.file_size)}</td>
                    <td className="px-4 py-3 text-[#7b6660]">{formatDate(backup.date)}</td>
                    <td className="px-4 py-3 text-[#7b6660]">{backup.created_by || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const link = document.createElement("a");
                            link.href = `${import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"}/api/admin/backups/${backup.backup_id}/download`;
                            link.setAttribute("download", "");
                            // Use fetch with auth header for download
                            const token = localStorage.getItem("authToken");
                            fetch(link.href, { headers: { Authorization: `Bearer ${token}` } })
                              .then(res => res.blob())
                              .then(blob => {
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = backup.name + ".sql";
                                a.click();
                                URL.revokeObjectURL(url);
                              });
                          }}
                          className="rounded-lg p-2 text-[#7b6660] hover:bg-[#FDD9CD]/50 hover:text-white"
                          title="Download"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRestoreTarget(backup)}
                          className="rounded-lg p-2 text-sky-700 hover:bg-sky-400/10"
                          title="Restore"
                        >
                          <RotateCcw size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(backup.backup_id)}
                          className="rounded-lg p-2 text-rose-700 hover:bg-rose-400/10"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Restore Confirmation Modal */}
      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="app-panel w-full max-w-md rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Confirm Restore</h3>
            <p className="text-sm text-[#7b6660] mb-1">
              Are you sure you want to restore from this backup?
            </p>
            <p className="text-sm text-rose-700 mb-4">
              ⚠️ This will overwrite the current database with the backup data. This action cannot be undone.
            </p>
            <div className="rounded-lg border border-[#ead3cc] bg-white/[0.05] p-3 mb-5 text-sm">
              <p className="text-white font-medium">{restoreTarget.name}</p>
              <p className="text-[#7b6660]">
                {restoreTarget.type} • {formatSize(restoreTarget.file_size)} • {formatDate(restoreTarget.date)}
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRestoreTarget(null)}
                className="rounded-lg border border-[#ead3cc] bg-white/[0.05] px-4 py-2 text-sm font-medium text-[#7b6660] hover:bg-[#FDD9CD]/50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRestore(restoreTarget.backup_id)}
                className="rounded-lg bg-rose-500/80 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500"
              >
                Restore Database
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}