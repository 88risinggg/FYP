import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { login } from "../services/authService.js";
import { saveSession } from "../services/sessionService.js";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const data = await login(email, password);
      saveSession(data.token, data.user, rememberMe);
      navigate("/module-selection", { replace: true });
    } catch (requestError) {
      setError("Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white px-6 py-10 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-2xl bg-white shadow-2xl shadow-slate-200 ring-1 ring-slate-200 md:grid-cols-[1fr_1.1fr]">
          <div className="hidden bg-brand-600 px-10 py-12 text-white md:flex md:flex-col md:justify-between">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-xl font-bold">
                PN
              </div>
              <h1 className="mt-8 text-3xl font-semibold leading-tight">
                Automated Invoicing & Payroll System
              </h1>
              <p className="mt-4 max-w-sm text-sm leading-6 text-blue-100">
                Secure access for finance, HR, admin, and staff workflows.
              </p>
            </div>
            <div className="rounded-xl bg-white/10 p-4 text-sm text-blue-50">
              Role-based access is applied after login.
            </div>
          </div>

          <div className="px-6 py-10 sm:px-10 lg:px-14">
            <div className="mb-8 flex items-center gap-3 md:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-base font-bold text-white">
                PN
              </div>
              <div>
                <p className="text-sm font-semibold">PayNivo</p>
                <p className="text-xs text-slate-500">Invoicing & Payroll</p>
              </div>
            </div>

            <div>
              <h2 className="text-3xl font-semibold tracking-normal text-slate-950">
                Welcome Back
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Login to access your account
              </p>
            </div>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 block w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
                  placeholder="name@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="password">
                  Password
                </label>
                <div className="mt-2 flex rounded-lg border border-slate-300 focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-100">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="min-w-0 flex-1 rounded-l-lg px-4 py-3 text-sm outline-none"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="rounded-r-lg px-4 text-sm font-medium text-brand-700 hover:bg-brand-50"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 text-sm">
                <label className="flex cursor-pointer items-center gap-2 text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
                  />
                  Remember me
                </label>
                <Link className="font-medium text-brand-700 hover:text-brand-600" to="/login">
                  Forgot password?
                </Link>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-300"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Logging in
                  </span>
                ) : (
                  "Login"
                )}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}

