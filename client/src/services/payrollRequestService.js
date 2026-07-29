/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - SHARED
 * PURPOSE: Provides reusable payroll Request Service business or integration operations.
 * LAYER: Frontend service - calls backend APIs or manages browser-side application state.
 * FIND RELATED CODE: Search the API path in server/src/routes to continue into the backend.
 */
import { apiRequest } from "./apiClient.js";
import { getStoredSession } from "./sessionService.js";
const API = import.meta.env.VITE_API_BASE_URL || "";
export const listPayrollRequests = () => apiRequest("/api/payroll-requests");
export const submitPayrollRequest = (formData) =>
  apiRequest("/api/payroll-requests", {
    method: "POST",
    headers: { "Content-Type": undefined },
    body: formData,
  });
export const reviewPayrollRequest = (id, role, action, payload = {}) =>
  apiRequest(`/api/payroll-requests/${id}/${role}/${action}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
export const releasePayrollRequestToTreasury = (id) =>
  apiRequest(`/api/payroll-requests/finance-release/${id}/treasury`, { method: "POST" });
export async function getPayrollRequestAttachment(id, attachmentId) {
  const token = getStoredSession()?.token;
  const response = await fetch(
    `${API}/api/payroll-requests/${id}/attachments/${attachmentId}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!response.ok)
    throw new Error(
      (await response.json().catch(() => ({}))).message ||
        "Evidence unavailable",
    );
  const blob = await response.blob();
  return { blob, contentType: response.headers.get("content-type") || blob.type || "application/octet-stream" };
}
export async function openPayrollRequestAttachment(id, attachmentId) {
  const { blob } = await getPayrollRequestAttachment(id, attachmentId);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
