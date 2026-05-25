import { NavLink } from "react-router-dom";
import { ClipboardList } from "lucide-react";

export default function Sidebar({
  sections,
  title = "Automated Invoicing & Payroll System"
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-white/10 bg-[#090014]/80 shadow-2xl shadow-purple-950/40 backdrop-blur-2xl lg:flex lg:flex-col">
      <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#C77DFF]/10 text-[#C77DFF] ring-1 ring-[#C77DFF]/25 shadow-lg shadow-[#9D4EDD]/20">
          <ClipboardList size={23} strokeWidth={2.2} />
        </div>
        <p className="text-sm font-semibold leading-5 text-white">
          {title}
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-5">
        {sections.map((section) => (
          <div key={section.label} className="mb-7">
            <p className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-wide text-[#C77DFF]/70">
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
                          ? "bg-gradient-to-r from-[#7B2FF7] to-[#FF4DDB] text-white shadow-lg shadow-[#9D4EDD]/30"
                          : "text-[#d8c6e8] hover:bg-white/10 hover:text-white hover:shadow-lg hover:shadow-[#9D4EDD]/10"
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
