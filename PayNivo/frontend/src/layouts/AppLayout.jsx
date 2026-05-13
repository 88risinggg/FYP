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
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <NavLink to="/login" className="text-2xl font-bold text-brand-700">
            PayNivo
          </NavLink>
          <nav className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${
                    isActive
                      ? "bg-brand-600 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
