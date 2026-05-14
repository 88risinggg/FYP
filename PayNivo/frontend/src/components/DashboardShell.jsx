export default function DashboardShell({ role, title, description, sections, children }) {
  const roleBadgeStyles = {
    Admin: "bg-red-100 text-red-800",
    Finance: "bg-green-100 text-green-800",
    HR: "bg-blue-100 text-blue-800",
    Staff: "bg-gray-100 text-gray-800"
  };

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3 mb-3">
          <span className={`px-3 py-1 rounded-full text-sm font-bold ${roleBadgeStyles[role] || "bg-gray-100"}`}>
            {role}
          </span>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Role Badge</p>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">{title}</h1>
        {description && (
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            {description}
          </p>
        )}
      </div>

      {children ? (
        <>{children}</>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections?.map((section) => (
            <article key={section.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-950">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{section.text}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
