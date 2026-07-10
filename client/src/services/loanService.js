import { apiRequest } from "./apiClient.js";

// ─── Staff Functions ─────────────────────────────────────────────────────────

export function createLoanRequest(data) {
  return apiRequest("/api/hr/loan-requests", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export function getLoanRequests() {
  return apiRequest("/api/hr/loan-requests");
}

export function getLoanRequestById(id) {
  return apiRequest(`/api/hr/loan-requests/${id}`);
}

// ─── HR Functions ────────────────────────────────────────────────────────────

export function approveLoanRequest(id, data) {
  return apiRequest(`/api/hr/loan-requests/${id}/approve`, {
    method: "PUT",
    body: JSON.stringify(data)
  });
}

export function rejectLoanRequest(id, data) {
  return apiRequest(`/api/hr/loan-requests/${id}/reject`, {
    method: "PUT",
    body: JSON.stringify(data)
  });
}

export function markInstallmentPaid(loanId, installmentId) {
  return apiRequest(`/api/hr/loan-requests/${loanId}/installments/${installmentId}/pay`, {
    method: "PUT"
  });
}
