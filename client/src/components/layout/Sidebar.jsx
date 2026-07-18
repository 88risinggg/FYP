import { NavLink } from "react-router-dom";
import { ClipboardList, X } from "lucide-react";

export default function Sidebar({
  sections,
  title = "Automated Invoicing & Payroll System",
  mobileOpen = false,
  onClose
}) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 w-64 border-r border-[#f0d2ca] bg-[#fff8f5]/95 shadow-2xl shadow-[#f2b5a9]/20 backdrop-blur-2xl transition-transform duration-300 lg:flex lg:flex-col ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
    >
      <div className="flex h-20 items-center gap-3 border-b border-[#f0d2ca] px-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F38978]/10 text-[#F38978] ring-1 ring-[#F38978]/25 shadow-lg shadow-[#F38978]/20">
          <ClipboardList size={23} strokeWidth={2.2} />
        </div>
        <p className="text-sm font-semibold leading-5 text-[#251E1F]">{title}</p>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#7b6660] hover:bg-[#FDD9CD]/45 hover:text-[#251E1F] lg:hidden"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-5">
        {sections.map((section, index) => (
          <div key={section.label || `section-${index}`} className="mb-7">
            <p className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-wide text-[#F38978]/70">
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
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                        isActive
                          ? "bg-gradient-to-r from-[#2D7C83] to-[#F38978] text-[#251E1F] shadow-lg shadow-[#F38978]/30"
                          : "text-[#7b6660] hover:bg-[#FDD9CD]/45 hover:text-[#251E1F] hover:shadow-lg hover:shadow-[#F38978]/10"
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
