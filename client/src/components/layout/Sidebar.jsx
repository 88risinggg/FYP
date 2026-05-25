import { NavLink } from "react-router-dom";
import { ClipboardList } from "lucide-react";

export default function Sidebar({
  sections,
  title = "Automated Invoicing & Payroll System"
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-slate-200 bg-white lg:flex lg:flex-col">
      <div className="flex h-20 items-center gap-3 border-b border-slate-200 px-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
          <ClipboardList size={23} strokeWidth={2.2} />
        </div>
        <p className="text-sm font-semibold leading-5 text-slate-950">
          {title}
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-5">
        {sections.map((section) => (
          <div key={section.label} className="mb-7">
            <p className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {section.label}
            </p>
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.label}
                    to={item.path}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                        isActive
                          ? "bg-brand-600 text-white shadow-sm"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                      }`
                    }
                  >
                    <Icon size={17} />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
