import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/admin", label: "Admin" },
  { to: "/finance", label: "Finance" },
  { to: "/hr", label: "HR" },
  { to: "/staff", label: "Staff" },
  { to: "/customer", label: "Customer" }
];

export default function AppLayout() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-brand-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <NavLink to="/login" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-600 text-sm font-black text-white shadow-lg shadow-brand-600/20">
              PN
            </span>
            <span>
              <span className="block text-2xl font-black leading-none text-plum-900">PayNivo</span>
              <span className="text-xs font-medium text-slate-500">Payroll and invoicing workspace</span>
            </span>
          </NavLink>

          <nav className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                      : "text-slate-600 hover:bg-brand-50 hover:text-brand-700"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
