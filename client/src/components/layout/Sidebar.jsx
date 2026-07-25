import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ArrowLeft, ChevronDown, LayoutGrid, PanelLeftClose, X } from "lucide-react";

function isPathActive(pathname, item) {
  if (!item?.path) return false;
  if (item.end) return pathname === item.path;
  if (item.exact) return pathname === item.path;
  return pathname === item.path || pathname.startsWith(`${item.path}/`);
}

export default function Sidebar({
  sections,
  mobileOpen = false,
  onClose,
  desktopCollapsed = false,
  onToggleDesktop,
  showModuleSelectorLink = false
}) {
  const location = useLocation();
  const [openItems, setOpenItems] = useState({});
  const classes = {
    aside: "app-sidebar fixed inset-y-0 left-0 z-30 w-60 border-r border-[#f2d5cc]/80 bg-gradient-to-b from-[#fff9f7] via-[#fff5f1] to-[#FDD9CD]/60 shadow-xl shadow-[#f2b5a9]/10 backdrop-blur-2xl transition-transform duration-200 ease-out lg:flex lg:flex-col",
    headerBorder: "border-[#f2d5cc]/70",
    toggleButton: "ml-auto hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#6f4f47]/80 transition hover:bg-[#FDD9CD]/40 hover:text-[#F38978] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F38978]/45 lg:inline-flex",
    sectionLabel: "mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-[#b06b5f]/80",
    itemBase: "flex min-h-[2.375rem] w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium outline-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-[#F38978]/45",
    activeItem: "app-sidebar-active bg-[#FDD9CD]/90 text-[#E8573D] shadow-sm shadow-[#F38978]/8",
    expandedItem: "app-sidebar-expanded bg-[#FDD9CD]/40 text-[#5a3f39]",
    inactiveItem: "app-sidebar-inactive text-[#5a3f39] hover:bg-[#FDD9CD]/35 hover:text-[#E8573D]",
    childBase: "flex min-h-[2rem] w-full items-center rounded-md px-2.5 py-1.5 text-[12.5px] font-medium outline-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-[#F38978]/35",
    activeChild: "app-sidebar-active bg-white/90 text-[#E8573D] shadow-sm shadow-[#F38978]/5",
    inactiveChild: "text-[#6f4f47] hover:bg-white/50 hover:text-[#E8573D]"
  };

  useEffect(() => {
    const activeGroups = {};

    sections.forEach((section) => {
      section.items.forEach((item) => {
        if (item.children?.some((child) => isPathActive(location.pathname, child))) {
          activeGroups[item.label] = true;
        }
      });
    });

    if (Object.keys(activeGroups).length) {
      setOpenItems((current) => ({ ...current, ...activeGroups }));
    }
  }, [location.pathname, sections]);

  return (
    <aside
      className={`${classes.aside} ${mobileOpen ? "translate-x-0" : "-translate-x-full"} ${desktopCollapsed ? "lg:pointer-events-none lg:invisible lg:-translate-x-full" : "lg:visible lg:translate-x-0"}`}
    >
      <div className={`flex h-14 items-center gap-2 border-b px-3 ${classes.headerBorder}`}>
        {showModuleSelectorLink ? (
          <Link
            to="/module-selection"
            onClick={onClose}
            aria-label="Back to module selector"
            title="Back to module selector"
            className="group flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium text-[#5a3f39] outline-none transition hover:bg-[#FDD9CD]/35 hover:text-[#E8573D] focus-visible:ring-2 focus-visible:ring-[#F38978]/45"
          >
            <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/90 shadow-sm">
              <LayoutGrid size={15} className="transition-opacity group-hover:opacity-0" aria-hidden="true" />
              <ArrowLeft size={15} className="absolute opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
            </span>
            <span className="truncate">Modules</span>
          </Link>
        ) : (
          <span className="min-w-0 flex-1" aria-hidden="true" />
        )}
        {onToggleDesktop ? (
          <button
            type="button"
            onClick={onToggleDesktop}
            className={classes.toggleButton}
            aria-label="Hide sidebar"
            aria-expanded={!desktopCollapsed}
            title="Hide sidebar"
          >
            <PanelLeftClose size={18} aria-hidden="true" />
          </button>
        ) : null}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-[#7b6660] hover:bg-[#FDD9CD]/35 hover:text-[#251E1F] lg:hidden"
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        {sections.map((section, index) => (
          <div key={section.label || `section-${index}`} className={`${index > 0 ? "mt-5 border-t border-[#f2d5cc]/50 pt-4" : ""}`}>
            {section.label ? (
              <p className={classes.sectionLabel}>
                {section.label}
              </p>
            ) : null}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const hasChildren = Boolean(item.children?.length);
                const isItemActive = isPathActive(location.pathname, item);
                const isChildActive = hasChildren && item.children.some((child) => isPathActive(location.pathname, child));

                if (hasChildren) {
                  const isOpen = openItems[item.label] || isChildActive;
                  const parentClasses = isChildActive
                    ? classes.expandedItem
                    : isItemActive
                      ? classes.activeItem
                      : classes.inactiveItem;

                  return (
                    <div key={item.label}>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setOpenItems((current) => ({
                          ...current,
                          [item.label]: isChildActive ? true : !isOpen
                        }))}
                        className={`${classes.itemBase} ${parentClasses}`}
                      >
                        <Icon size={16} className="shrink-0" />
                        <span className="min-w-0 flex-1 text-left">{item.label}</span>
                        <ChevronDown size={14} className={`shrink-0 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`} />
                      </button>

                      <div className={`overflow-hidden transition-[max-height,opacity] duration-150 ${isOpen ? "max-h-64 opacity-100" : "max-h-0 opacity-0"}`}>
                        <div className="mt-0.5 space-y-0.5 border-l border-[#f2d5cc]/60 ml-5 pl-3">
                          {item.children.map((child) => (
                            <NavLink
                              key={child.label}
                              to={child.path}
                              end={child.end}
                              onClick={onClose}
                              className={({ isActive }) =>
                                `${classes.childBase} ${
                                  isActive ? classes.activeChild : classes.inactiveChild
                                }`
                              }
                            >
                              <span className="min-w-0 truncate">{child.label}</span>
                            </NavLink>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <NavLink
                    key={item.label}
                    to={item.path}
                    end={item.end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `${classes.itemBase} ${
                        isActive ? classes.activeItem : classes.inactiveItem
                      }`
                    }
                  >
                    <Icon size={16} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
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
