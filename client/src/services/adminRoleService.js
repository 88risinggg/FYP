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

export function fetchAdminRoles(filters = {}) {
  return apiRequest(`/api/admin/roles${toQueryString(filters)}`, {
    headers: authHeaders()
  });
}

export function fetchAdminRole(roleId) {
  return apiRequest(`/api/admin/roles/${roleId}`, {
    headers: authHeaders()
  });
}

export function duplicateAdminRole(roleId) {
  return apiRequest(`/api/admin/roles/${roleId}/duplicate`, {
    method: "POST",
    headers: authHeaders()
  });
}

export function deactivateAdminRole(roleId) {
  return apiRequest(`/api/admin/roles/${roleId}/deactivate`, {
    method: "PATCH",
    headers: authHeaders()
  });
}
