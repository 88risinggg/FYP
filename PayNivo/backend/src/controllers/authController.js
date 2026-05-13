// Future auth logic belongs here: register, login, logout, refresh token, password reset.
// Keep password hashing in this layer or a dedicated auth service using bcrypt.

export function loginPlaceholder(_req, res) {
  res.json({
    message: "Login endpoint placeholder. Add JWT and bcrypt authentication here."
  });
}

export function profilePlaceholder(req, res) {
  res.json({
    message: "Authenticated profile placeholder.",
    user: req.user || null
  });
}
