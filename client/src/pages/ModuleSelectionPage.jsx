import { useNavigate } from "react-router-dom";

import { clearSession, getStoredSession } from "../services/sessionService.js";

const moduleDetails = {
  invoicing: {
    title: "Invoicing System",
    description: "Manage billing, invoice records, PDF generation, and reports."
  },
  payroll: {
    title: "Payroll System",
    description: "Manage payroll processing, staff records, payslips, and exports."
  }
};

export default function ModuleSelectionPage() {
  const navigate = useNavigate();
  const session = getStoredSession();
  const user = session?.user;
  const allowedModules = user?.allowedModules || [];

  function handleLogout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  function handleModuleSelection(moduleKey) {
    if (moduleKey === "invoicing" && user?.role === "Admin") {
      navigate("/dashboard/invoicing/admin");
      return;
    }

    if (moduleKey === "invoicing" && user?.role === "Finance") {
      navigate("/dashboard/invoicing/finance");
      return;
    }

    if (moduleKey === "payroll" && user?.role === "Admin") {
      navigate("/dashboard/payroll/admin");
      return;
    }

    if (moduleKey === "payroll" && user?.role === "Finance") {
      navigate("/dashboard/payroll/finance");
      return;
    }

    if (moduleKey === "payroll" && user?.role === "HR") {
      navigate("/dashboard/payroll/hr");
      return;
    }

    if (moduleKey === "payroll" && user?.role === "Staff") {
      navigate("/dashboard/payroll/staff");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-brand-700">{user?.role}</p>
            <h1 className="mt-1 text-2xl font-semibold">Module Selection</h1>
            <p className="mt-1 text-sm text-slate-500">Signed in as {user?.name}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
          >
            Logout
          </button>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          {allowedModules.map((moduleKey) => (
            <button
              key={moduleKey}
              type="button"
              onClick={() => handleModuleSelection(moduleKey)}
              className="rounded-xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-brand-300 hover:shadow-md"
            >
              <h2 className="text-lg font-semibold text-slate-950">
                {moduleDetails[moduleKey].title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {moduleDetails[moduleKey].description}
              </p>
            </button>
          ))}
        </section>
      </div>
    </main>
  );
}
