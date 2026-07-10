import { apiRequest } from "./apiClient.js";

// ─── HR Functions ────────────────────────────────────────────────────────────

export function getPublicHolidays() {
  return apiRequest("/api/hr/public-holidays");
}

export function getPublicHolidayById(id) {
  return apiRequest(`/api/hr/public-holidays/${id}`);
}

export function createPublicHoliday(data) {
  return apiRequest("/api/hr/public-holidays", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updatePublicHoliday(id, data) {
  return apiRequest(`/api/hr/public-holidays/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deletePublicHoliday(id) {
  return apiRequest(`/api/hr/public-holidays/${id}`, {
    method: "DELETE",
  });
}
