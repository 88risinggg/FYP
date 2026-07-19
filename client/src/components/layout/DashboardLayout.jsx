import { useEffect, useState } from "react";
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
  User,
  UserCog,
  Users,
  X
} from "lucide-react";

import Sidebar from "./Sidebar.jsx";
import { clearSession, getStoredSession } from "../../services/sessionService.js";
import { apiRequest } from "../../services/apiClient.js";

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
  notificationBadgeCount,
  notificationsPath,
  profilePath,
  onMarkNotificationRead
}) {
  const navigate = useNavigate();
  const roleProfile = roleProfiles[user?.role];
  const displayName = profileName || user?.name || roleProfile?.name || "User";
  const displayRole = profileRole || roleProfile?.role || user?.role || "User";
  const [searchQuery, setSearchQuery] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [fetchedNotifications, setFetchedNotifications] = useState(null);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  // Use notificationBadgeCount prop if provided, otherwise compute from notifications array
  const unreadCount = typeof notificationBadgeCount === 'number'
    ? notificationBadgeCount
    : notifications.filter((n) => !n.read).length;

  // Fetch notifications from API when dropdown is opened
  async function handleBellClick() {
    const newShow = !showNotifications;
    setShowNotifications(newShow);

    if (newShow && fetchedNotifications === null) {
      const session = getStoredSession();
      const userId = session?.user?.userId;
      const token = session?.token;
      if (!userId || !token) return;

      setLoadingNotifications(true);
      try {
        const data = await apiRequest(`/api/notifications/user/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setFetchedNotifications(Array.isArray(data) ? data : []);
      } catch {
        setFetchedNotifications([]);
      } finally {
        setLoadingNotifications(false);
      }
    }
  }

  // Re-fetch when badge count changes (new notification arrived)
  useEffect(() => {
    setFetchedNotifications(null);
  }, [notificationBadgeCount]);

  const displayNotifications = fetchedNotifications || notifications;

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
    const session = getStoredSession();
    const userId = session?.user?.userId;
    const token = session?.token;
    if (!userId || !token) return;

    apiRequest(`/api/notifications/user/${userId}/read-all`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` }
    }).then(() => {
      setFetchedNotifications(prev => prev ? prev.map(n => ({ ...n, is_read: 1 })) : []);
    }).catch(() => {});

    if (onMarkNotificationRead) {
      notifications.forEach((n) => {
        if (!n.read) onMarkNotificationRead(n.id);
      });
    }
  }

  return (
    <div className="app-page relative overflow-hidden">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(245,222,214,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(245,222,214,0.6)_1px,transparent_1px)] bg-[size:72px_72px] opacity-30" />
      <Sidebar sections={sidebarSections} title={sidebarTitle} />

      <div className="relative z-10 lg:pl-64">
        <header className="sticky top-0 z-10 flex h-20 items-center gap-4 border-b border-[#f0d2ca] bg-[#fff8f5]/95 px-4 shadow-xl shadow-[#f2b5a9]/15 backdrop-blur-2xl sm:px-6">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[#7b6660] hover:bg-[#FDD9CD]/45 hover:text-[#251E1F]"
            aria-label="Open menu"
          >
            <Menu size={21} />
          </button>

          <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-[#251E1F] sm:text-lg">
            {pageTitle}
          </h1>

          {/* Search */}
          <div className="hidden w-full max-w-sm items-center gap-2 rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 shadow-lg shadow-[#f2b5a9]/10 backdrop-blur lg:flex">
            <Search size={16} className="text-[#F38978]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (onSearch) onSearch(e.target.value);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm text-[#251E1F] outline-none placeholder:text-[#7b6660]/60"
            />
            {searchQuery && (
              <button type="button" onClick={() => { setSearchQuery(""); if (onSearch) onSearch(""); }} className="text-[#7b6660] hover:text-[#251E1F]">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              type="button"
              onClick={handleBellClick}
              className="relative flex h-10 w-10 items-center justify-center rounded-lg text-[#7b6660] hover:bg-[#FDD9CD]/45 hover:text-[#251E1F]"
              aria-label="Notifications"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#F38978] text-[9px] font-bold text-[#251E1F] ring-2 ring-[#fff8f5]">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowNotifications(false)} />
                <div className="absolute right-0 top-12 z-30 w-80 rounded-xl border border-[#f0d2ca] bg-[#fff8f5] shadow-2xl shadow-[#f2b5a9]/25">
                  <div className="flex items-center justify-between border-b border-[#f0d2ca] px-4 py-3">
                    <h3 className="text-sm font-semibold text-[#251E1F]">Notifications</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#7b6660]">{unreadCount} unread</span>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-[#F38978] hover:bg-[#FDD9CD]/45"
                        >
                          <Check size={12} />
                          Mark all read
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {loadingNotifications ? (
                      <div className="px-4 py-8 text-center text-sm text-[#7b6660]">
                        Loading...
                      </div>
                    ) : displayNotifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-[#7b6660]">
                        No notifications yet
                      </div>
                    ) : (
                      displayNotifications.slice(0, 10).map((notif, index) => {
                        const isRead = notif.is_read === 1 || notif.is_read === true || notif.read;
                        return (
                          <div
                            key={notif.notification_id || notif.id || index}
                            className={`border-b border-[#f0d2ca] px-4 py-3 transition hover:bg-[#fff3ee] ${!isRead ? "bg-[#FDD9CD]/35" : ""}`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm ${!isRead ? "font-semibold text-[#251E1F]" : "text-[#7b6660]"}`}>
                                {notif.title || notif.message}
                              </p>
                              {notif.message && notif.title && (
                                <p className="mt-0.5 text-xs text-[#7b6660]">{notif.message}</p>
                              )}
                              {notif.created_at && (
                                <p className="mt-1 text-xs text-[#7b6660]/60">
                                  {new Date(notif.created_at).toLocaleDateString("en-SG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="relative flex items-center gap-3 rounded-lg px-2 py-1.5">
            <button
              type="button"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-3 rounded-lg transition hover:bg-[#FDD9CD]/45"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FDD9CD]/70 text-[#F38978] ring-1 ring-[#f0d2ca]">
                <UserCog size={20} />
              </div>
              <div className="hidden leading-tight sm:block">
                <p className="text-sm font-semibold text-[#251E1F]">{displayName}</p>
                <p className="text-xs text-[#7b6660]">{displayRole}</p>
              </div>
            </button>

            {/* Profile Dropdown Menu */}
            {showProfileMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowProfileMenu(false)} />
                <div className="absolute right-0 top-14 z-30 w-56 rounded-xl border border-[#f0d2ca] bg-[#fff8f5] shadow-2xl shadow-[#f2b5a9]/25">
                  <div className="border-b border-[#f0d2ca] px-4 py-3">
                    <p className="text-sm font-semibold text-[#251E1F]">{displayName}</p>
                    <p className="text-xs text-[#7b6660]">{displayRole}</p>
                  </div>
                  <div className="py-1.5">
                    <button
                      type="button"
                      onClick={() => { setShowProfileMenu(false); navigate("/dashboard/settings"); }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#7b6660] transition hover:bg-[#FDD9CD]/45 hover:text-[#251E1F]"
                    >
                      <User size={15} />
                      My Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowProfileMenu(false); navigate("/dashboard/settings"); }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#7b6660] transition hover:bg-[#FDD9CD]/45 hover:text-[#251E1F]"
                    >
                      <Settings size={15} />
                      Settings
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowProfileMenu(false); navigate("/dashboard/settings"); }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#7b6660] transition hover:bg-[#FDD9CD]/45 hover:text-[#251E1F]"
                    >
                      <Shield size={15} />
                      Security
                    </button>
                  </div>
                  <div className="border-t border-white/10 py-1.5">
                    <button
                      type="button"
                      onClick={() => { setShowProfileMenu(false); handleLogout(); }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-rose-400 transition hover:bg-rose-500/10 hover:text-rose-300"
                    >
                      <LogOut size={15} />
                      Logout
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
