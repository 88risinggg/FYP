const TOKEN_KEY = "authToken";
const USER_KEY = "authUser";

export function saveSession(token, user, rememberMe) {
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
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
  localStorage.setItem("rememberMe", rememberMe ? "true" : "false");
}

export function getPostAuthDestination(user) {
  if (user?.role === "PlatformOperator") return "/platform/companies";
  if (user?.role === "HR") return "/dashboard/payroll/hr";
  if (user?.role === "Staff") return "/dashboard/payroll/staff";
  return "/module-selection";
}

export function getStoredSession() {
  const token = localStorage.getItem(TOKEN_KEY);
  const userValue = localStorage.getItem(USER_KEY);

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
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem("rememberMe");
}

export function enterSupportSession(token, company, supportContext, expiresAt) {
  const current = getStoredSession();
  if (!current) throw new Error("The platform session is unavailable.");
  sessionStorage.setItem("platformReturnSession", JSON.stringify(current));
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify({ ...current.user, role: "Admin", allowedModules: ["invoicing", "payroll"], company, supportContext: { ...supportContext, expiresAt } }));
}

export function leaveSupportSession() {
  const value = sessionStorage.getItem("platformReturnSession");
  if (!value) return false;
  const session = JSON.parse(value);
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  sessionStorage.removeItem("platformReturnSession");
  return true;
}
