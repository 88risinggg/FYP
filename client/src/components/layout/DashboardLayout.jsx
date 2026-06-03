import {
  Bell,
  FileBarChart,
  LayoutDashboard,
  Menu,
  Search,
  Settings,
  Shield,
  UserCog,
  Users,
  X
} from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router-dom";

import Sidebar from "./Sidebar.jsx";

const defaultSidebarSections = [
  {
    label: "MAIN",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard/invoicing/admin", end: true },
      { label: "Users", icon: Users, path: "/dashboard/invoicing/admin" },
      { label: "Roles", icon: Shield, path: "/dashboard/invoicing/admin" }
    ]
  },
  {
    label: "INVOICING",
    items: [
      { label: "Invoice Settings", icon: Settings, path: "/dashboard/invoicing/admin" },
      { label: "Reminder Settings", icon: Bell, path: "/dashboard/invoicing/admin" }
    ]
  },
  {
    label: "MONITORING",
    items: [{ label: "Audit Logs", icon: FileBarChart, path: "/dashboard/invoicing/admin" }]
  },
  {
    label: "REPORTS",
    items: [{ label: "Reports", icon: FileBarChart, path: "/dashboard/invoicing/admin" }]
  }
];

const roleProfiles = {
  Admin: {
    name: "Admin User",
    role: "Administrator"
  },
  Finance: {
    name: "Finance User",
    role: "Finance Manager"
  },
  HR: {
    name: "HR User",
    role: "Human Resources"
  },
  Staff: {
    name: "Staff User",
    role: "Staff"
  }
};

export default function DashboardLayout({
  children,
  pageTitle,
  user,
  sidebarSections = defaultSidebarSections,
  sidebarTitle,
  searchPlaceholder = "Search invoices, users, settings...",
  profileName,
  profileRole
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const roleProfile = roleProfiles[user?.role];
  const displayName = profileName || user?.name || roleProfile?.name || "User";
  const displayRole = profileRole || roleProfile?.role || user?.role || "User";

  return (
    <div className="neon-page relative overflow-hidden">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:72px_72px] opacity-20" />
      <Sidebar sections={sidebarSections} title={sidebarTitle} />

      <div className="relative z-10 lg:pl-64">
        <header className="sticky top-0 z-10 flex h-20 items-center gap-4 border-b border-white/10 bg-[#090014]/70 px-4 shadow-xl shadow-purple-950/20 backdrop-blur-2xl sm:px-6">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[#d8c6e8] hover:bg-white/10 hover:text-white"
            aria-label="Open menu"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen(true)}
          >
            <Menu size={21} />
          </button>

          <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-white sm:text-lg">
            {pageTitle}
          </h1>

          <div className="hidden w-full max-w-sm items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 shadow-lg shadow-[#9D4EDD]/10 backdrop-blur lg:flex">
            <Search size={16} className="text-[#C77DFF]" />
            <input
              type="search"
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#d8c6e8]/60"
            />
          </div>

          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-lg text-[#d8c6e8] hover:bg-white/10 hover:text-white"
            aria-label="Notifications"
            aria-expanded={isNotificationsOpen}
            onClick={() => setIsNotificationsOpen((current) => !current)}
          >
            <Bell size={20} />
            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#FF4DDB] ring-2 ring-[#090014]" />
          </button>
          {isNotificationsOpen ? (
            <div className="absolute right-4 top-16 w-80 rounded-2xl border border-white/10 bg-[#140821]/95 p-4 shadow-2xl shadow-purple-950/40 backdrop-blur-2xl sm:right-6">
              <p className="text-sm font-semibold text-white">Notifications</p>
              <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-[#d8c6e8]">
                No unread payroll notifications.
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C77DFF]/15 text-[#C77DFF] ring-1 ring-[#C77DFF]/25">
              <UserCog size={20} />
            </div>
            <div className="hidden leading-tight sm:block">
              <p className="text-sm font-semibold text-white">{displayName}</p>
              <p className="text-xs text-[#d8c6e8]/75">{displayRole}</p>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>

      {isMenuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[#090014]/80"
            aria-label="Close menu"
            onClick={() => setIsMenuOpen(false)}
          />
          <aside className="relative flex h-full w-72 max-w-[86vw] flex-col border-r border-white/10 bg-[#090014] shadow-2xl shadow-purple-950/50">
            <div className="flex h-20 items-center justify-between gap-3 border-b border-white/10 px-5">
              <p className="text-sm font-semibold leading-5 text-white">{sidebarTitle || "Automated Invoicing & Payroll System"}</p>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-[#d8c6e8] hover:bg-white/10 hover:text-white"
                aria-label="Close menu"
                onClick={() => setIsMenuOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-4 py-5">
              {sidebarSections.map((section) => (
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
                          onClick={() => setIsMenuOpen(false)}
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
        </div>
      ) : null}
    </div>
  );
}
