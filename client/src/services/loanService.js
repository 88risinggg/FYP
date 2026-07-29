/**
 * EVALUATION HEADER
 * FEATURE: SHARED / APPLICATION CORE
 * PURPOSE: Provides reusable loan Service business or integration operations.
 * LAYER: Frontend service - calls backend APIs or manages browser-side application state.
 * FIND RELATED CODE: Search the API path in server/src/routes to continue into the backend.
 */
import { apiRequest } from "./apiClient.js";

// ─── Staff Functions ─────────────────────────────────────────────────────────

export function createLoanRequest(data) {
  return apiRequest(data instanceof FormData ? "/api/payroll-requests" : "/api/hr/loan-requests", {
    method: "POST",
    headers: data instanceof FormData ? { "Content-Type": undefined } : undefined,
    body: data instanceof FormData ? data : JSON.stringify(data)
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
