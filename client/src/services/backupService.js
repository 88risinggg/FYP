import { apiRequest } from "./apiClient.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export async function fetchBackups() {
  const data = await apiRequest("/api/admin/backups");
  return data.backups;
}

export async function fetchAvailableTables() {
  const data = await apiRequest("/api/admin/backups/tables");
  return data.tables;
}

export async function createBackup({ type, tables }) {
  return apiRequest("/api/admin/backups", {
    method: "POST",
    body: JSON.stringify({ type, tables })
  });
}

export async function deleteBackup(id) {
  return apiRequest(`/api/admin/backups/${id}`, {
    method: "DELETE"
  });
}

export async function restoreBackup(id) {
  return apiRequest(`/api/admin/backups/${id}/restore`, {
    method: "POST"
  });
}

export function getBackupDownloadUrl(id) {
  const token = localStorage.getItem("authToken");
  return `${API_BASE_URL}/api/admin/backups/${id}/download?token=${token}`;
}
