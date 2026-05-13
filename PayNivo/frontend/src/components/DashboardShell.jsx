function StatusPill({ children, tone = "pink" }) {
  const tones = {
    pink: "bg-brand-50 text-brand-700 ring-brand-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    slate: "bg-slate-100 text-slate-700 ring-slate-200"
  };

  return (
    <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ${tones[tone]}`}>
      {children}
    </span>
  );
}

function MetricCard({ label, value, hint }) {
  return (
    <article className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-plum-900">{value}</p>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
    </article>
  );
}

function WorkspaceCard({ workspace }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
      <div className="border-b border-brand-100 bg-gradient-to-r from-brand-50 to-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <StatusPill tone={workspace.tone}>{workspace.type}</StatusPill>
            <h2 className="mt-3 text-xl font-black text-plum-900">{workspace.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{workspace.description}</p>
          </div>
          <div className="rounded-xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-brand-100">
            <p className="font-bold text-slate-500">Owner</p>
            <p className="mt-1 font-black text-plum-900">{workspace.owner}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[1.2fr_0.8fr]">
        <section>
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Feature actions</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {workspace.actions.map((action) => (
              <div key={action.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-bold text-plum-900">{action.title}</p>
                <p className="mt-1 text-sm leading-5 text-slate-600">{action.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Feature settings</h3>
          <div className="mt-3 space-y-3">
            {workspace.settings.map((setting) => (
              <div key={setting.label} className="rounded-xl border border-brand-100 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-plum-900">{setting.label}</p>
                  <StatusPill tone={setting.tone || "slate"}>{setting.value}</StatusPill>
                </div>
                {setting.hint && <p className="mt-2 text-sm leading-5 text-slate-600">{setting.hint}</p>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </article>
  );
}

export default function DashboardShell({ role, title, description, metrics = [], workspaces = [], checklist = [] }) {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-brand-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-brand-600">{role}</p>
            <h1 className="mt-2 text-3xl font-black text-plum-900 sm:text-4xl">{title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">{description}</p>
          </div>
          <div className="rounded-2xl bg-plum-900 p-5 text-white shadow-xl shadow-plum-900/10">
            <p className="text-sm font-bold text-brand-100">Workspace rule</p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-white/80">
              Invoice settings stay inside invoice workflows. Payroll settings stay inside payroll workflows.
            </p>
          </div>
        </div>
      </div>

      {metrics.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>
      )}

      <div className="grid gap-5">
        {workspaces.map((workspace) => (
          <WorkspaceCard key={workspace.title} workspace={workspace} />
        ))}
      </div>

      {checklist.length > 0 && (
        <section className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-plum-900">Implementation checklist</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {checklist.map((item) => (
              <div key={item} className="flex gap-3 rounded-xl bg-brand-50 p-3 text-sm text-slate-700">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-black text-white">✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
