/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - SHARED
 * PURPOSE: Provides reusable payroll User Service business or integration operations.
 * LAYER: Frontend service - calls backend APIs or manages browser-side application state.
 * FIND RELATED CODE: Search the API path in server/src/routes to continue into the backend.
 */
import { apiRequest } from "./apiClient.js";

export const getPayrollUsers = () => apiRequest("/api/payroll/users");
export const createPayrollHire = (payload) => apiRequest("/api/payroll/users/hires", {
  method: "POST", body: JSON.stringify(payload)
});
export const importPayrollHires = (file, mode = "preview") => {
  const form = new FormData();
  form.append("file", file);
  form.append("mode", mode);
  return apiRequest("/api/payroll/users/hires/import", { method: "POST", headers: { "Content-Type": undefined }, body: form });
};
export const exportStaffWorkbook = async () => {
  const token = sessionStorage.getItem("authToken");
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/api/hr/staff/export/excel`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) throw new Error("Unable to export staff records.");
  return response.blob();
};
export const updateActivationRequest = (requestId, payload) => apiRequest(`/api/payroll/users/activation-requests/${requestId}`, {
  method: "PUT", body: JSON.stringify(payload)
});
export const reviewActivationRequest = (requestId, action, reason = "") => apiRequest(`/api/payroll/users/activation-requests/${requestId}/${action}`, {
  method: "POST", body: JSON.stringify({ reason })
});
export const resendAccountSetup = ({ userId }) => apiRequest(`/api/payroll/users/${userId}/resend-setup`, { method: "POST" });
export const deleteManagedPayrollUser = (userId, note = "") => apiRequest(`/api/settings/managed-users/${userId}`, { method: "DELETE", body: JSON.stringify({ note }) });
export const deleteUserAccountByHR = (userId, password) => apiRequest(`/api/hr/users/${userId}/account`, { method: "DELETE", body: JSON.stringify({ password }) });

