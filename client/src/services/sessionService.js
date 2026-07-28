const TOKEN_KEY = "authToken";
const USER_KEY = "authUser";

function clearLegacyPersistentSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem("rememberMe");
}

export function getCompanyScopedKey(baseKey, companyId) {
  return companyId ? `${baseKey}:${companyId}` : baseKey;
}

export function saveSession(token, user) {
  const moduleDefaults = {
    Admin: ["invoicing", "payroll"],
    Finance: ["invoicing", "payroll"],
    HR: ["payroll"],
    Staff: ["payroll"]
    ,PlatformOperator: ["platform"]
  };
  const normalizedUser = {
    ...user,
    allowedModules: Array.isArray(user?.allowedModules) ? user.allowedModules : (moduleDefaults[user?.role] || [])
  };
  clearLegacyPersistentSession();
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
}

export function getPostAuthDestination(user) {
  if (user?.role === "PlatformOperator") return "/platform/companies";
  if (user?.role === "HR") return "/module-selection";
  if (user?.role === "Staff") return "/dashboard/payroll/staff";
  return "/module-selection";
}

export function getStoredSession() {
  clearLegacyPersistentSession();
  const token = sessionStorage.getItem(TOKEN_KEY);
  const userValue = sessionStorage.getItem(USER_KEY);

  if (!token || !userValue) {
    return null;
  }

  try {
    return {
      token,
      user: JSON.parse(userValue)
    };
  } catch (error) {
    clearSession();
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  sessionStorage.removeItem("rememberMe");
  clearLegacyPersistentSession();
}

export function enterSupportSession(token, company, supportContext, expiresAt) {
  const current = getStoredSession();
  if (!current) throw new Error("The platform session is unavailable.");
  sessionStorage.setItem("platformReturnSession", JSON.stringify(current));
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify({ ...current.user, role: "Admin", allowedModules: ["invoicing", "payroll"], company, supportContext: { ...supportContext, expiresAt } }));
}

export function leaveSupportSession() {
  const value = sessionStorage.getItem("platformReturnSession");
  if (!value) return false;
  const session = JSON.parse(value);
  sessionStorage.setItem(TOKEN_KEY, session.token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(session.user));
  sessionStorage.removeItem("platformReturnSession");
  return true;
}
