import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api.js";

const demoAccounts = [
  { label: "Admin", email: "admin@paynivo.com", path: "/admin" },
  { label: "Finance", email: "finance@paynivo.com", path: "/finance" },
  { label: "HR", email: "hr@paynivo.com", path: "/hr" },
  { label: "Staff", email: "staff@paynivo.com", path: "/staff" },
  { label: "Customer", email: "customer@paynivo.com", path: "/customer" }
];

const rolePath = {
  Admin: "/admin",
  Finance: "/finance",
  HR: "/hr",
  Staff: "/staff",
  Customer: "/customer"
};

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@paynivo.com");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await api.post("/auth/login", { email, password });
      localStorage.setItem("paynivo_token", response.data.token);
      localStorage.setItem("paynivo_user", JSON.stringify(response.data.user));
      navigate(rolePath[response.data.user.role] || "/login");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  function chooseAccount(account) {
    setEmail(account.email);
    setPassword("password");
    setError("");
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
      <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-white p-8 shadow-sm">
        <p className="text-sm font-black uppercase tracking-wide text-brand-600">Final Year Project</p>
        <h1 className="mt-3 text-4xl font-black leading-tight text-plum-900 sm:text-5xl">
          PayNivo workspace
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          Sign in with a demo role to inspect separate invoice and payroll workspaces.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {demoAccounts.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => chooseAccount(account)}
              className={`rounded-xl border p-4 text-left transition ${
                email === account.email
                  ? "border-brand-600 bg-brand-50"
                  : "border-brand-100 bg-white hover:border-brand-600 hover:bg-brand-50"
              }`}
            >
              <p className="font-bold text-plum-900">{account.label}</p>
              <p className="mt-1 text-sm leading-5 text-slate-600">{account.email}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-brand-100 bg-white p-6 shadow-sm">
        <p className="text-sm font-black uppercase tracking-wide text-brand-600">Demo sign in</p>
        <h2 className="mt-2 text-2xl font-black text-plum-900">Use password login</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          All demo accounts use the password <span className="font-bold text-plum-900">password</span>.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-bold text-slate-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-lg border border-brand-100 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
          </label>

          <label className="block">
            <span className="text-sm font-bold text-slate-700">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-brand-100 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
          </label>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </section>
  );
}
