import { apiRequest } from "./apiClient.js";
import { getStoredSession } from "./sessionService.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export const CLAIM_TYPES = ["Medical", "Transport", "Meal", "Internet", "Office Purchase", "Business Travel", "Other"];

export function getClaims() {
  return apiRequest("/api/claims");
}

export function submitClaim(formData) {
  return apiRequest("/api/claims", { method: "POST", headers: { "Content-Type": undefined }, body: formData });
}

export function reviewClaimByHr(id, action, comments) {
  return apiRequest(`/api/claims/${id}/hr/${action}`, {
    method: "PUT",
    body: JSON.stringify({ comments })
  });
}

export function processClaimByFinance(id, action, payload) {
  return apiRequest(`/api/claims/${id}/finance/${action}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function openClaimProof(id) {
  const token = getStoredSession()?.token;
  const response = await fetch(`${API_BASE_URL}/api/claims/${id}/proof`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "Unable to open proof");
  }
  const url = URL.createObjectURL(await response.blob());
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
