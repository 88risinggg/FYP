import {
  Bell,
  ChevronDown,
  FileBarChart,
  LayoutDashboard,
  Menu,
  Search,
  Settings,
  Shield,
  X,
  UserCog,
  Users
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import Sidebar from "./Sidebar.jsx";
import { clearSession } from "../../services/sessionService.js";

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
  profileRole,
  profilePath,
  notificationsPath,
  notificationBadgeCount,
  notificationItems = [
    "Your latest payslip is ready.",
    "Profile changes were saved successfully.",
    "Payroll info was updated today."
  ]
}) {
  const roleProfile = roleProfiles[user?.role];
  const displayName = profileName || user?.name || roleProfile?.name || "User";
  const displayRole = profileRole || roleProfile?.role || user?.role || "User";
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  function handleLogout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <div className="neon-page relative overflow-hidden">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:72px_72px] opacity-20" />
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      <Sidebar
        sections={sidebarSections}
        title={sidebarTitle}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <div className="relative z-10 lg:pl-64">
        <header className="sticky top-0 z-10 flex h-20 items-center gap-4 border-b border-white/10 bg-[#090014]/70 px-4 shadow-xl shadow-purple-950/20 backdrop-blur-2xl sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#d8c6e8] hover:bg-white/10 hover:text-white lg:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={21} /> : <Menu size={21} />}
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
            onClick={() => {
              setNotificationsOpen((value) => !value);
              setProfileOpen(false);
            }}
            className="relative flex h-10 w-10 items-center justify-center rounded-lg text-[#d8c6e8] hover:bg-white/10 hover:text-white"
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
          >
            <Bell size={20} />
            {notificationBadgeCount === undefined ? (
              <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#FF4DDB] ring-2 ring-[#090014]" />
            ) : notificationBadgeCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-[#090014]">
                {notificationBadgeCount > 9 ? '9+' : notificationBadgeCount}
              </span>
            ) : null}
          </button>

          {notificationsOpen ? (
            <div className="absolute right-4 top-20 z-30 w-72 overflow-hidden rounded-xl border border-white/10 bg-[#12071f]/95 shadow-2xl shadow-purple-950/40 backdrop-blur-xl sm:right-6">
              <div className="border-b border-white/10 px-4 py-3">
                <p className="text-sm font-semibold text-white">Notifications</p>
                <p className="text-xs text-[#d8c6e8]/75">Recent staff updates</p>
              </div>
              <div className="space-y-1 p-2">
                {notificationItems.map((item) => (
                  <div key={item} className="rounded-lg px-3 py-2 text-sm text-[#f4e9ff] transition hover:bg-white/10">
                    {item}
                  </div>
                ))}
              </div>
              {notificationsPath ? (
                <Link
                  to={notificationsPath}
                  onClick={() => setNotificationsOpen(false)}
                  className="block border-t border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  View all notifications
                </Link>
              ) : null}
            </div>
          ) : null}

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setProfileOpen((value) => !value);
                setNotificationsOpen(false);
              }}
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-white/10"
              aria-label="Open profile menu"
              aria-expanded={profileOpen}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C77DFF]/15 text-[#C77DFF] ring-1 ring-[#C77DFF]/25">
                <UserCog size={20} />
              </div>
              <div className="hidden leading-tight sm:block">
                <p className="text-sm font-semibold text-white">{displayName}</p>
                <p className="text-xs text-[#d8c6e8]/75">{displayRole}</p>
              </div>
              <ChevronDown size={16} className="text-[#d8c6e8]/70" />
            </button>

            {profileOpen && profilePath ? (
              <div className="absolute right-0 top-12 z-30 w-56 overflow-hidden rounded-xl border border-white/10 bg-[#12071f]/95 shadow-2xl shadow-purple-950/40 backdrop-blur-xl">
                <Link
                  to={profilePath}
                  onClick={() => setProfileOpen(false)}
                  className="block px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  Profile
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center px-4 py-3 text-left text-sm font-medium text-white transition hover:bg-white/10"
                >
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
