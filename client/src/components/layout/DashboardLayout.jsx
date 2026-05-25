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
          >
            <Bell size={20} />
            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#FF4DDB] ring-2 ring-[#090014]" />
          </button>

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
    </div>
  );
}
