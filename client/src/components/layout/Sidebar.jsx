import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ArrowLeft, ChevronDown, LayoutGrid, PanelLeftClose, X } from "lucide-react";

function isPathActive(pathname, item) {
  if (!item?.path) return false;
  if (item.end) return pathname === item.path;
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
    aside: "fixed inset-y-0 left-0 z-30 w-64 border-r border-[#f2d5cc] bg-gradient-to-b from-[#fff8f5] via-[#fff3ee] to-[#FDD9CD]/80 shadow-2xl shadow-[#f2b5a9]/20 backdrop-blur-2xl transition-transform duration-200 ease-out lg:flex lg:flex-col",
    headerBorder: "border-[#f2d5cc]",
    toggleButton: "ml-auto hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#6f4f47] transition hover:bg-[#FDD9CD]/45 hover:text-[#F38978] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F38978]/45 lg:inline-flex",
    sectionLabel: "mb-3 px-2 text-[11px] font-bold uppercase tracking-wide text-[#b06b5f]",
    itemBase: "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[#F38978]/45",
    activeItem: "bg-[#FDD9CD] text-[#F38978] shadow-lg shadow-[#F38978]/10",
    expandedItem: "bg-[#FDD9CD]/55 text-[#6f4f47]",
    inactiveItem: "text-[#6f4f47] hover:bg-[#FDD9CD]/45 hover:text-[#F38978] hover:shadow-lg hover:shadow-[#F38978]/10",
    childBase: "flex min-h-9 w-full items-center rounded-lg px-3 py-2 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-[#F38978]/35",
    activeChild: "bg-white/80 text-[#F38978] shadow-sm",
    inactiveChild: "text-[#6f4f47] hover:bg-white/60 hover:text-[#F38978]"
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
      <div className={`flex h-20 items-center gap-3 border-b px-5 ${classes.headerBorder}`}>
        {showModuleSelectorLink ? (
          <Link
            to="/module-selection"
            onClick={onClose}
            aria-label="Back to module selector"
            title="Back to module selector"
            className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-semibold text-[#6f4f47] outline-none transition hover:bg-[#FDD9CD]/45 hover:text-[#F38978] focus-visible:ring-2 focus-visible:ring-[#F38978]/45"
          >
            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80 shadow-sm">
              <LayoutGrid size={17} className="transition-opacity group-hover:opacity-0" aria-hidden="true" />
              <ArrowLeft size={17} className="absolute opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
            </span>
            <span className="truncate">Back to modules</span>
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
            <PanelLeftClose size={21} aria-hidden="true" />
          </button>
        ) : null}
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

      <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 pr-5">
        {sections.map((section, index) => (
          <div key={section.label || `section-${index}`} className="mb-7">
            <p className={classes.sectionLabel}>
              {section.label}
            </p>
            <div className="space-y-1">
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
                        <Icon size={17} className="shrink-0" />
                        <span className="min-w-0 flex-1 text-left">{item.label}</span>
                        <ChevronDown size={15} className={`shrink-0 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`} />
                      </button>

                      <div className={`overflow-hidden transition-[max-height,opacity] duration-150 ${isOpen ? "max-h-64 opacity-100" : "max-h-0 opacity-0"}`}>
                        <div className="mt-1 space-y-1 pl-8">
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
                    <Icon size={17} className="shrink-0" />
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
