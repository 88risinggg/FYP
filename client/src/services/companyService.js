import { apiRequest } from "./apiClient.js";

export const listPlatformCompanies = () => apiRequest("/api/company/platform/companies");
export const provisionPlatformCompany = (payload) => apiRequest("/api/company/platform/companies", { method: "POST", body: JSON.stringify(payload) });
export const onboardPlatformCompany = (workspaceId, payload) => apiRequest(`/api/company/platform/companies/${workspaceId}/onboard`, { method: "POST", body: JSON.stringify(payload) });
export const resendPlatformAdminSetup = (workspaceId) => apiRequest(`/api/company/platform/companies/${workspaceId}/resend-admin-setup`, { method: "POST" });
export const getCompanyProfile = () => apiRequest("/api/company/profile");
export const updateCompanyProfile = (payload) => apiRequest("/api/company/profile", { method: "PUT", body: JSON.stringify(payload) });
export const uploadCompanyLogo = (file) => { const body = new FormData(); body.append("logo", file); return apiRequest("/api/company/profile/logo", { method: "POST", headers: { "Content-Type": undefined }, body }); };
export const requestSupportAccess = (payload) => apiRequest("/api/company/platform/support-requests", { method: "POST", body: JSON.stringify(payload) });
export const getPlatformSupportRequests = () => apiRequest("/api/company/platform/support-requests");
export const activateSupportAccess = (id) => apiRequest(`/api/company/platform/support-requests/${id}/activate`, { method: "POST" });
export const getSupportRequests = () => apiRequest("/api/company/support-requests");
export const reviewSupportRequest = (id, payload) => apiRequest(`/api/company/support-requests/${id}/review`, { method: "POST", body: JSON.stringify(payload) });
export const revokeSupportRequest = (id) => apiRequest(`/api/company/support-requests/${id}/revoke`, { method: "POST" });
