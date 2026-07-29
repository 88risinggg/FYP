/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - SHARED
 * PURPOSE: Provides reusable leave Service business or integration operations.
 * LAYER: Frontend service - calls backend APIs or manages browser-side application state.
 * FIND RELATED CODE: Search the API path in server/src/routes to continue into the backend.
 */
import { apiRequest } from "./apiClient.js";

// ─── Staff Functions ─────────────────────────────────────────────────────────

export function applyLeave({ leave_type_id, start_date, end_date, reason, attachment }) {
  const formData = new FormData();
  formData.append("leave_type_id", leave_type_id);
  formData.append("start_date", start_date);
  formData.append("end_date", end_date);
  formData.append("reason", reason);
  if (attachment) {
    formData.append("attachment", attachment);
  }

  return apiRequest("/api/leave/apply", {
    method: "POST",
    headers: { "Content-Type": undefined },
    body: formData
  });
}

export function getMyBalance() {
  return apiRequest("/api/leave/my-balance");
}

export function getMyApplications() {
  return apiRequest("/api/leave/my-applications");
}

export function cancelLeave(applicationId) {
  return apiRequest(`/api/leave/applications/${applicationId}/cancel`, {
    method: "PUT"
  });
}

export function getLeaveTypes() {
  return apiRequest("/api/leave/types");
}

// ─── HR Functions ────────────────────────────────────────────────────────────

export function getPendingApplications() {
  return apiRequest("/api/leave/applications/pending");
}

export function getAllApplications({ page = 1, pageSize = 50 } = {}) {
  return apiRequest(`/api/leave/applications/all?page=${page}&pageSize=${pageSize}`);
}

export function updateLeaveStatus(applicationId, { status, hr_comment }) {
  return apiRequest(`/api/leave/applications/${applicationId}/status`, {
    method: "PUT",
    body: JSON.stringify({ status, hr_comment })
  });
}

export function getAllBalances() {
  return apiRequest("/api/leave/balances/all");
}

export function updateLeaveType(typeId, { default_entitlement, carry_forward_cap, requires_attachment }) {
  return apiRequest(`/api/leave/types/${typeId}`, {
    method: "PUT",
    body: JSON.stringify({ default_entitlement, carry_forward_cap, requires_attachment })
  });
}

export function runCarryForward({ from_year }) {
  return apiRequest("/api/leave/carry-forward", {
    method: "POST",
    body: JSON.stringify({ from_year })
  });
}
