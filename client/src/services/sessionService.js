const TOKEN_KEY = "authToken";
const USER_KEY = "authUser";

export function saveSession(token, user, rememberMe) {
  const moduleDefaults = {
    Admin: ["invoicing", "payroll"],
    Finance: ["invoicing", "payroll"],
    HR: ["payroll"],
    Staff: ["payroll"]
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
