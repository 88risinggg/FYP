import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Check,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  Shield,
  UserCog,
  Users,
  X
} from "lucide-react";

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
  onSearch,
  notifications = [],
  onMarkNotificationRead
}) {
  const navigate = useNavigate();
  const roleProfile = roleProfiles[user?.role];
  const displayName = profileName || user?.name || roleProfile?.name || "User";
  const displayRole = profileRole || roleProfile?.role || user?.role || "User";
  const [searchQuery, setSearchQuery] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  function handleSearchKeyDown(event) {
    if (event.key === "Enter" && onSearch) {
      onSearch(searchQuery.trim());
    }
  }

  function handleLogout() {
    clearSession();
    navigate("/login");
  }

  function handleMarkAllRead() {
    if (onMarkNotificationRead) {
      notifications.forEach((n) => {
        if (!n.read) onMarkNotificationRead(n.id);
      });
    }
  }

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

          {/* Search */}
          <div className="hidden w-full max-w-sm items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 shadow-lg shadow-[#9D4EDD]/10 backdrop-blur lg:flex">
            <Search size={16} className="text-[#C77DFF]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (onSearch) onSearch(e.target.value);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#d8c6e8]/60"
            />
            {searchQuery && (
              <button type="button" onClick={() => { setSearchQuery(""); if (onSearch) onSearch(""); }} className="text-[#d8c6e8] hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative flex h-10 w-10 items-center justify-center rounded-lg text-[#d8c6e8] hover:bg-white/10 hover:text-white"
              aria-label="Notifications"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#FF4DDB] text-[9px] font-bold text-white ring-2 ring-[#090014]">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowNotifications(false)} />
                <div className="absolute right-0 top-12 z-30 w-80 rounded-xl border border-white/10 bg-[#120022] shadow-2xl shadow-purple-950/40">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <h3 className="text-sm font-semibold text-white">Notifications</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#d8c6e8]/60">{unreadCount} unread</span>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-[#C77DFF] hover:bg-white/10"
                        >
                          <Check size={12} />
                          Mark all read
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-[#d8c6e8]/60">
                        No notifications yet
                      </div>
                    ) : (
                      notifications.slice(0, 10).map((notif, index) => (
                        <div
                          key={notif.id || index}
                          className={`border-b border-white/5 px-4 py-3 transition hover:bg-white/[0.04] ${!notif.read ? "bg-[#C77DFF]/5" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm ${!notif.read ? "font-semibold text-white" : "text-[#d8c6e8]/80"}`}>
                                {notif.title || notif.message}
                              </p>
                              {notif.description && (
                                <p className="mt-0.5 text-xs text-[#d8c6e8]/60">{notif.description}</p>
                              )}
                              <p className="mt-1 text-xs text-[#d8c6e8]/40">{notif.time || "Just now"}</p>
                            </div>
                            {!notif.read && onMarkNotificationRead && (
                              <button
                                type="button"
                                onClick={() => onMarkNotificationRead(notif.id)}
                                className="mt-0.5 shrink-0 rounded p-1 text-[#d8c6e8]/50 hover:bg-white/10 hover:text-[#C77DFF]"
                                aria-label="Mark as read"
                              >
                                <Check size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C77DFF]/15 text-[#C77DFF] ring-1 ring-[#C77DFF]/25">
              <UserCog size={20} />
            </div>
            <div className="hidden leading-tight sm:block">
              <p className="text-sm font-semibold text-white">{displayName}</p>
              <p className="text-xs text-[#d8c6e8]/75">{displayRole}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#d8c6e8] hover:bg-rose-500/15 hover:text-rose-300"
              aria-label="Logout"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
