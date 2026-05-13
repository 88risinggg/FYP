export default function Login() {
  return (
    <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
      <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-white p-8 shadow-sm">
        <p className="text-sm font-black uppercase tracking-wide text-brand-600">Final Year Project</p>
        <h1 className="mt-3 text-4xl font-black leading-tight text-plum-900 sm:text-5xl">
          PayNivo workspace
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          A clean prototype for keeping invoice settings with invoice workflows, and payroll settings with payroll workflows.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {[
            ["Invoice area", "CSV import, invoice creation, payment proof, reminders"],
            ["Payroll area", "CPF rates, Excel upload, calculation, payslip PDF"],
            ["Role access", "Admin, Finance, HR, Staff, Customer"],
            ["Audit ready", "Login, upload, email, approval, settings changes"]
          ].map(([title, text]) => (
            <div key={title} className="rounded-xl border border-brand-100 bg-white p-4">
              <p className="font-bold text-plum-900">{title}</p>
              <p className="mt-1 text-sm leading-5 text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-brand-100 bg-white p-6 shadow-sm">
        <p className="text-sm font-black uppercase tracking-wide text-brand-600">Demo sign in</p>
        <h2 className="mt-2 text-2xl font-black text-plum-900">Choose a role</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Authentication is still a prototype placeholder. Use the role tabs above to inspect each workspace.
        </p>

        <form className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-bold text-slate-700">Email</span>
            <input
              type="email"
              placeholder="admin@paynivo.com"
              className="mt-1 w-full rounded-lg border border-brand-100 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
          </label>

          <label className="block">
            <span className="text-sm font-bold text-slate-700">Password</span>
            <input
              type="password"
              placeholder="Prototype password"
              className="mt-1 w-full rounded-lg border border-brand-100 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
          </label>

          <button
            type="button"
            className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700"
          >
            Sign in placeholder
          </button>
        </form>
      </div>
    </section>
  );
}
