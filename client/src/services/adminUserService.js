import { apiRequest } from "./apiClient.js";
import { getStoredSession } from "./sessionService.js";

function authHeaders() {
  const session = getStoredSession();

  return session?.token
    ? {
        Authorization: `Bearer ${session.token}`
      }
    : {};
}

function toQueryString(params) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, value);
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

export function fetchAdminUsers(filters = {}) {
  return apiRequest(`/api/admin/users${toQueryString(filters)}`, {
    headers: authHeaders()
  });
}

export function fetchAdminUser(userId) {
  return apiRequest(`/api/admin/users/${userId}`, {
    headers: authHeaders()
  });
}

export function createAdminUser(payload) {
  return apiRequest("/api/admin/users", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
}

export function updateAdminUser(userId, payload) {
  return apiRequest(`/api/admin/users/${userId}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
}

export function updateAdminUserStatus(userId, status) {
  return apiRequest(`/api/admin/users/${userId}/status`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ status })
  });
}

export function resetAdminUserPassword(userId, password) {
  return apiRequest(`/api/admin/users/${userId}/reset-password`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ password })
  });
}
