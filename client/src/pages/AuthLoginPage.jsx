import { useEffect, useState } from "react";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import AuthLayout from "../components/auth/AuthLayout.jsx";
import { completeFirstLogin, login } from "../services/authService.js";
import { startHealthCheck } from "../services/apiClient.js";
import { saveSession } from "../services/sessionService.js";

export default function AuthLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (location.state?.message) {
      setMessage(location.state.message);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  async function submitCredentials(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const data = await login(email, password);
      if (data.requiresPasswordChange) {
        setSetupToken(data.setupToken);
        setMessage("Create a permanent password before continuing.");
        return;
      }
      saveSession(data.token, data.user, true);
      startHealthCheck();
      navigate("/module-selection", { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Unable to log in.");
    } finally {
      setLoading(false);
    }
  }

  async function submitPasswordSetup(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    if (newPassword.length < 8) {
      setLoading(false);
      setError("Password must contain at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setLoading(false);
      setError("Passwords do not match.");
      return;
    }

    try {
      const data = await completeFirstLogin(setupToken, newPassword);
      saveSession(data.token, data.user, true);
      startHealthCheck();
      navigate("/module-selection", { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Unable to save your permanent password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title={setupToken ? "Create password" : "Log in"}
      description={setupToken ? "Set your permanent password before continuing." : "Use your existing work email and password."}
    >
      {setupToken ? (
        <form className="space-y-5" onSubmit={submitPasswordSetup}>
          <label className="block text-sm font-medium text-[#6f5b55]" htmlFor="new-password">
            New password
            <input
              id="new-password"
              type="password"
              minLength={8}
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="mt-2 w-full rounded-lg border border-[#f0d2ca] px-4 py-3 text-[#251E1F] outline-none focus:border-[#F38978] focus:ring-4 focus:ring-[#F38978]/15"
            />
          </label>
          <label className="block text-sm font-medium text-[#6f5b55]" htmlFor="confirm-new-password">
            Confirm password
            <input
              id="confirm-new-password"
              type="password"
              minLength={8}
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="mt-2 w-full rounded-lg border border-[#f0d2ca] px-4 py-3 text-[#251E1F] outline-none focus:border-[#F38978] focus:ring-4 focus:ring-[#F38978]/15"
            />
          </label>
          {message && <p className="text-sm text-[#355f63]">{message}</p>}
          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#F38978] px-4 py-3 font-semibold text-[#251E1F] transition hover:brightness-105 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Password"}
          </button>
        </form>
      ) : (
        <form className="space-y-5" onSubmit={submitCredentials}>
          <label className="block text-sm font-medium text-[#6f5b55]" htmlFor="login-email">
            Email
            <span className="mt-2 flex rounded-lg border border-[#f0d2ca] bg-white focus-within:border-[#F38978] focus-within:ring-4 focus-within:ring-[#F38978]/15">
              <Mail className="ml-3 self-center text-[#7b6660]" size={18} />
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="min-w-0 flex-1 bg-transparent px-3 py-3 text-[#251E1F] outline-none"
              />
            </span>
          </label>
          <label className="block text-sm font-medium text-[#6f5b55]" htmlFor="login-password">
            Password
            <span className="mt-2 flex rounded-lg border border-[#f0d2ca] bg-white focus-within:border-[#F38978] focus-within:ring-4 focus-within:ring-[#F38978]/15">
              <Lock className="ml-3 self-center text-[#7b6660]" size={18} />
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="min-w-0 flex-1 bg-transparent px-3 py-3 text-[#251E1F] outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="flex w-11 items-center justify-center text-[#7b6660] hover:text-[#251E1F]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
          <div className="flex items-center justify-between gap-4 text-sm">
            <Link to="/forgot-password" className="font-medium text-[#C55245] hover:underline">
              Forgot Password
            </Link>
            <Link to="/register" className="font-medium text-[#C55245] hover:underline">
              Create Account
            </Link>
          </div>
          {message && <p className="text-sm text-[#355f63]">{message}</p>}
          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#F38978] px-4 py-3 font-semibold text-[#251E1F] transition hover:brightness-105 disabled:opacity-50"
          >
            {loading ? "Checking..." : "Log In"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
