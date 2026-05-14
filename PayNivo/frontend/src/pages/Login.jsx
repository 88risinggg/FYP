import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api.js";

const demoAccounts = [
  { label: "Admin", email: "admin@paynivo.com" },
  { label: "Finance", email: "finance@paynivo.com" },
  { label: "HR", email: "hr@paynivo.com" },
  { label: "Staff", email: "staff@paynivo.com" },
  { label: "Customer", email: "customer@paynivo.com" }
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
      if (err.code === "ERR_NETWORK") {
        setError("Cannot connect to backend server. Start backend on http://localhost:5000 and try again.");
      } else {
        setError(err.response?.data?.message || "Unable to sign in.");
      }
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
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">PayNivo</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">Sign in</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
          Use one of the demo accounts to access the role-based workspace.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {demoAccounts.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => chooseAccount(account)}
              className={`rounded-lg border p-4 text-left transition ${
                email === account.email
                  ? "border-brand-600 bg-brand-50"
                  : "border-slate-200 bg-white hover:border-brand-600 hover:bg-brand-50"
              }`}
            >
              <p className="font-bold text-slate-950">{account.label}</p>
              <p className="mt-1 text-sm text-slate-600">{account.email}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Demo login</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-950">Use password login</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          All demo accounts use the password <span className="font-bold text-slate-950">password</span>.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
          </label>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </section>
  );
}
