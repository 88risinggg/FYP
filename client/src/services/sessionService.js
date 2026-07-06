const TOKEN_KEY = "authToken";
const USER_KEY = "authUser";

export function saveSession(token, user, rememberMe) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem("rememberMe", rememberMe ? "true" : "false");
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

