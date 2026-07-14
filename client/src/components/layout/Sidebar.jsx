import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown, ClipboardList } from "lucide-react";

export default function Sidebar({
  sections,
  title = "Automated Invoicing & Payroll System"
}) {
  const location = useLocation();
  const [openItems, setOpenItems] = useState({});

  useEffect(() => {
    const activeGroups = {};

    sections.forEach((section) => {
      section.items.forEach((item) => {
        if (item.children?.some((child) => location.pathname === child.path)) {
          activeGroups[item.label] = true;
        }
      });
    });

    if (Object.keys(activeGroups).length) {
      setOpenItems((current) => ({ ...current, ...activeGroups }));
    }
  }, [location.pathname, sections]);

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-[#f2d5cc] bg-gradient-to-b from-[#fff8f5] via-[#fff3ee] to-[#FDD9CD]/80 shadow-2xl shadow-[#f2b5a9]/20 backdrop-blur-2xl lg:flex lg:flex-col">
      <div className="flex h-20 items-center gap-3 border-b border-[#f2d5cc] px-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F38978]/15 text-[#F38978] ring-1 ring-[#F38978]/25 shadow-lg shadow-[#F38978]/15">
          <ClipboardList size={23} strokeWidth={2.2} />
        </div>
        <p className="text-sm font-semibold leading-5 text-[#251E1F]">
          {title}
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-5">
        {sections.map((section) => (
          <div key={section.label} className="mb-7">
            <p className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-wide text-[#b06b5f]">
              {section.label}
            </p>
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const hasChildren = Boolean(item.children?.length);
                const isChildActive = hasChildren && item.children.some((child) => location.pathname === child.path);

                if (hasChildren) {
                  const isOpen = openItems[item.label] || isChildActive;

                  return (
                    <div key={item.label}>
                      <button
                        type="button"
                        onClick={() => setOpenItems((current) => ({
                          ...current,
                          [item.label]: !isOpen
                        }))}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                          isChildActive || location.pathname === item.path
                            ? "bg-[#FDD9CD] text-[#F38978] shadow-lg shadow-[#F38978]/10"
                            : "text-[#6f4f47] hover:bg-[#FDD9CD]/45 hover:text-[#F38978] hover:shadow-lg hover:shadow-[#F38978]/10"
                        }`}
                      >
                        <Icon size={17} />
                        <span className="min-w-0 flex-1 text-left">{item.label}</span>
                        <ChevronDown size={15} className={isOpen ? "rotate-180 transition" : "transition"} />
                      </button>

                      {isOpen ? (
                        <div className="mt-1 space-y-1 pl-8">
                          {item.children.map((child) => (
                            <NavLink
                              key={child.label}
                              to={child.path}
                              end={child.end}
                              className={({ isActive }) =>
                                `flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium transition ${
                                  isActive
                                    ? "bg-white/70 text-[#F38978]"
                                    : "text-[#6f4f47] hover:bg-white/60 hover:text-[#F38978]"
                                }`
                              }
                            >
                              {child.label}
                            </NavLink>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                }

                return (
                  <NavLink
                    key={item.label}
                    to={item.path}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                        isActive
                          ? "bg-[#FDD9CD] text-[#F38978] shadow-lg shadow-[#F38978]/10"
                          : "text-[#6f4f47] hover:bg-[#FDD9CD]/45 hover:text-[#F38978] hover:shadow-lg hover:shadow-[#F38978]/10"
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
