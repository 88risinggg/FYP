import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api.js";

function IconBox({ children, tone = "blue" }) {
  const tones = { blue: "bg-blue-600", green: "bg-emerald-500", amber: "bg-orange-500", purple: "bg-violet-500", teal: "bg-cyan-500" };
  return <span className={`grid h-10 w-10 place-items-center rounded-lg text-xs font-black text-white ${tones[tone]}`}>{children}</span>;
}

function PreviewMetric({ label, value, tone, icon }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <IconBox tone={tone}>{icon}</IconBox>
        <div>
          <p className="text-xs font-bold text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
          <p className="mt-1 text-xs font-semibold text-emerald-600">Live workspace</p>
        </div>
      </div>
    </article>
  );
}

const demoCredentials = [
  { name: "Admin User", role: "Admin", email: "admin@paynivo.com" },
  { name: "Finance User", role: "Finance", email: "finance@paynivo.com" },
  { name: "HR User", role: "HR", email: "hr@paynivo.com" },
  { name: "Staff User", role: "Staff", email: "staff@paynivo.com" }
];

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@paynivo.com");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      const response = await api.post("/auth/login", { email, password });
      localStorage.setItem("paynivo_token", response.data.token);
      localStorage.setItem("paynivo_user", JSON.stringify(response.data.user));
      navigate("/admin");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to sign in.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <IconBox>PN</IconBox>
            <div>
              <p className="text-sm font-black leading-4 text-slate-950">Automated Invoicing</p>
              <p className="text-sm font-black leading-4 text-slate-950">& Payroll System</p>
            </div>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 ring-1 ring-blue-200">Admin Portal</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200">Demo Access</span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl gap-8 px-5 py-8 lg:grid-cols-[1fr_420px] lg:items-center">
        <section className="space-y-5">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-blue-600">PayNivo Workspace</p>
            <h1 className="mt-2 max-w-3xl text-4xl font-black leading-tight text-slate-950">Automated Invoicing System - Admin Dashboard</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Access the dashboard to manage users, payroll settings, invoice settings, reports, audit logs, and system notifications.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <PreviewMetric label="Users" value="128" tone="blue" icon="U" />
            <PreviewMetric label="Invoices" value="342" tone="green" icon="I" />
            <PreviewMetric label="Payroll" value="5" tone="purple" icon="P" />
            <PreviewMetric label="Audit Logs" value="86" tone="amber" icon="A" />
          </div>

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-black text-slate-950">Workspace Modules</h2>
                <p className="mt-1 text-sm text-slate-500">Role-based access for admin, finance, HR, and staff workflows.</p>
              </div>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {[
                ["User Management", "Create users, assign roles, and manage access."],
                ["Payroll Settings", "Configure CPF tiers and payroll rates."],
                ["Invoice Settings", "Manage invoice defaults and reminders."],
                ["Reports & Audit", "Export reports and review system activity."]
              ].map(([title, description], index) => (
                <div key={title} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <IconBox tone={["blue", "purple", "green", "amber"][index]}>{index + 1}</IconBox>
                  <div>
                    <p className="text-sm font-black text-slate-950">{title}</p>
                    <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>

        <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5">
            <h2 className="text-lg font-black text-slate-950">Sign in</h2>
            <p className="mt-1 text-sm text-slate-500">Use any demo account to continue.</p>
          </div>

          <div className="space-y-4 p-6">
            <label className="block">
              <span className="text-sm font-bold text-slate-700">Email</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">Password</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            </label>

            {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div>}

            <button className="h-11 w-full rounded-md bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700">Sign in</button>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <div className="flex items-center justify-between gap-3">
                <p className="font-black text-slate-950">Demo credentials</p>
                <p className="text-xs font-bold text-slate-500">Password: password</p>
              </div>
              <div className="mt-3 space-y-2">
                {demoCredentials.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => {
                      setEmail(account.email);
                      setPassword("password");
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-blue-300 hover:bg-blue-50"
                  >
                    <span>
                      <span className="block font-black text-slate-900">{account.name}</span>
                      <span className="block text-xs text-slate-500">{account.email}</span>
                    </span>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700 ring-1 ring-blue-200">{account.role}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
