import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api.js";

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
      navigate("/admin");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to sign in.");
    }
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-5xl gap-6 px-4 py-10 lg:grid-cols-[1fr_0.8fr] lg:items-center">
      <section>
        <p className="text-sm font-black uppercase tracking-wide text-brand-600">PayNivo</p>
        <h1 className="mt-2 text-4xl font-black text-slate-950">Admin workspace</h1>
        <p className="mt-3 text-slate-600">Use the demo admin account to manage users, settings, reports, audit logs, and notification logs.</p>
      </section>
      <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Email</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="mt-4 block">
          <span className="text-sm font-semibold text-slate-700">Password</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div>}
        <button className="mt-5 w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-black text-white hover:bg-brand-700">Sign in</button>
      </form>
    </main>
  );
}
