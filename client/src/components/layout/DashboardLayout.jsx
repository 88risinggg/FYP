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
    <div className="relative min-h-screen overflow-hidden bg-[#fff8f5] text-[#251E1F]">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(243,137,120,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(243,137,120,0.08)_1px,transparent_1px)] bg-[size:72px_72px] opacity-20" />
      <Sidebar sections={sidebarSections} title={sidebarTitle} />

      <div className="relative z-10 lg:pl-64">
        <header className="sticky top-0 z-10 flex h-20 items-center gap-4 border-b border-[#f2d5cc] bg-[#fff8f5]/85 px-4 shadow-xl shadow-[#f2b5a9]/10 backdrop-blur-2xl sm:px-6">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[#6f4f47] hover:bg-[#FDD9CD]/45 hover:text-[#F38978]"
            aria-label="Open menu"
          >
            <Menu size={21} />
          </button>

          <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-[#251E1F] sm:text-lg">
            {pageTitle}
          </h1>

          <div className="hidden w-full max-w-sm items-center gap-2 rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 shadow-lg shadow-[#F38978]/10 backdrop-blur lg:flex">
            <Search size={16} className="text-[#F38978]" />
            <input
              type="search"
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm text-[#251E1F] outline-none placeholder:text-[#9c7b72]"
            />
          </div>

          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-lg text-[#6f4f47] hover:bg-[#FDD9CD]/45 hover:text-[#F38978]"
            aria-label="Notifications"
          >
            <Bell size={20} />
            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#F38978] ring-2 ring-[#fff8f5]" />
          </button>

          <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F38978]/15 text-[#F38978] ring-1 ring-[#F38978]/25">
              <UserCog size={20} />
            </div>
            <div className="hidden leading-tight sm:block">
              <p className="text-sm font-semibold text-[#251E1F]">{displayName}</p>
              <p className="text-xs text-[#7b6660]">{displayRole}</p>
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
