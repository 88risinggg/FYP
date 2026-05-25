import {
  Bell,
  FileBarChart,
  LayoutDashboard,
  Menu,
  Search,
  Settings,
  Shield,
  UserCog,
  Users
} from "lucide-react";

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

export default function DashboardLayout({
  children,
  pageTitle,
  user,
  sidebarSections = defaultSidebarSections,
  searchPlaceholder = "Search invoices, users, settings...",
  profileName,
  profileRole
}) {
  const displayName = profileName || user?.name || "Admin User";
  const displayRole = profileRole || user?.role || "Administrator";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Sidebar sections={sidebarSections} />

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-20 items-center gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Open menu"
          >
            <Menu size={21} />
          </button>

          <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-slate-950 sm:text-lg">
            {pageTitle}
          </h1>

          <div className="hidden w-full max-w-sm items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 lg:flex">
            <Search size={16} className="text-slate-400" />
            <input
              type="search"
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Notifications"
          >
            <Bell size={20} />
            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
          </button>

          <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700">
              <UserCog size={20} />
            </div>
            <div className="hidden leading-tight sm:block">
              <p className="text-sm font-semibold text-slate-950">{displayName}</p>
              <p className="text-xs text-slate-500">{displayRole}</p>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
