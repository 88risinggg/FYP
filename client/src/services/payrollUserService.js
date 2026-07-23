import { apiRequest } from "./apiClient.js";

export const getPayrollUsers = () => apiRequest("/api/payroll/users");
export const createPayrollHire = (payload) => apiRequest("/api/payroll/users/hires", {
  method: "POST", body: JSON.stringify(payload)
});
export const updateActivationRequest = (requestId, payload) => apiRequest(`/api/payroll/users/activation-requests/${requestId}`, {
  method: "PUT", body: JSON.stringify(payload)
});
export const reviewActivationRequest = (requestId, action, reason = "") => apiRequest(`/api/payroll/users/activation-requests/${requestId}/${action}`, {
  method: "POST", body: JSON.stringify({ reason })
});
