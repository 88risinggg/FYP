import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Check,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftOpen,
  Search,
  Settings,
  Shield,
  User,
  UserCog,
  Users,
  X
} from "lucide-react";

import Sidebar from "./Sidebar.jsx";
import VanidayLogo from "../branding/VanidayLogo.jsx";
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

const SIDEBAR_COLLAPSED_KEY = "admin-sidebar-collapsed";

function readStoredSidebarCollapsed() {
  try {
    const value = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return value === "true";
  } catch {
    return false;
  }
}

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
  onMarkNotificationRead,
  onMarkAllRead,
  theme,
  hideSidebar = false
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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readStoredSidebarCollapsed);
  const classes = {
    page: "relative min-h-screen overflow-hidden bg-[#fff8f5] text-[#251E1F]",
    grid: "pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(243,137,120,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(243,137,120,0.08)_1px,transparent_1px)] bg-[size:72px_72px] opacity-20",
    header: "sticky top-0 z-10 flex h-20 items-center gap-4 border-b border-[#f2d5cc] bg-[#fff8f5]/85 px-4 shadow-xl shadow-[#f2b5a9]/10 backdrop-blur-2xl sm:px-6",
    iconButton: "flex h-10 w-10 items-center justify-center rounded-lg text-[#6f4f47] transition hover:bg-[#FDD9CD]/45 hover:text-[#F38978] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F38978]/45",
    title: "min-w-0 flex-1 truncate text-base font-semibold text-[#251E1F] sm:text-lg",
    searchWrap: "hidden w-full max-w-sm items-center gap-2 rounded-lg border border-[#f0d2ca] bg-white/800 px-3 py-2 shadow-lg shadow-[#F38978]/10 backdrop-blur lg:flex",
    searchIcon: "text-[#F38978]",
    searchInput: "w-full bg-transparent text-sm text-[#251E1F] outline-none placeholder:text-[#9c7b72]",
    mutedButton: "text-[#6f4f47] hover:text-[#F38978]",
    badge: "absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#F38978] text-[9px] font-bold text-white ring-2 ring-[#fff8f5]",
    dropdown: "absolute right-0 top-12 z-30 w-80 rounded-xl border border-[#f0d2ca] bg-white shadow-2xl shadow-[#f2b5a9]/30",
    dropdownWide: "absolute right-0 top-14 z-30 w-56 rounded-xl border border-[#f0d2ca] bg-white shadow-2xl shadow-[#f2b5a9]/30",
    dropdownBorder: "border-[#f0d2ca]",
    dropdownTitle: "text-[#251E1F]",
    dropdownMuted: "text-[#7b6660]",
    dropdownAction: "text-[#F38978] hover:bg-[#FDD9CD]/45",
    notificationHover: "cursor-pointer border-b border-[#f0d2ca] px-4 py-3 transition hover:bg-[#fff3ee]",
    unreadBg: "bg-[#FDD9CD]/35",
    notificationTitle: "font-semibold text-[#251E1F]",
    notificationRead: "text-[#7b6660]",
    notificationSubtle: "text-[#7b6660]/70",
    notificationDate: "text-[#7b6660]/50",
    profileButton: "flex items-center gap-3 rounded-lg transition hover:bg-[#FDD9CD]/45",
    avatar: "flex h-10 w-10 items-center justify-center rounded-full bg-[#F38978]/15 text-[#F38978] ring-1 ring-[#F38978]/25",
    profileText: "text-[#251E1F]",
    profileSubtext: "text-[#7b6660]",
    menuItem: "flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#6f4f47] transition hover:bg-[#FDD9CD]/45 hover:text-[#251E1F]"
  };

  const usesManagedNotifications = notifications.length > 0 || typeof notificationBadgeCount === "number";
  const displayNotifications = fetchedNotifications || notifications;
  const unreadCount = typeof notificationBadgeCount === "number"
    ? notificationBadgeCount
    : displayNotifications.filter((notification) => !(
        notification.is_read === 1 || notification.is_read === true || notification.read
      )).length;

  function toggleDesktopSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // Ignore storage failures; the in-memory toggle still works.
      }
      return next;
    });
  }

  useEffect(() => {
    if (!mobileSidebarOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setMobileSidebarOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileSidebarOpen]);

  // Admin, HR and payroll Finance pages use the shared notification API.
  // Pages with their own polling service can continue supplying notification props.
  useEffect(() => {
    if (usesManagedNotifications) return undefined;

    const session = getStoredSession();
    const userId = session?.user?.userId;
    const token = session?.token;
    if (!userId || !token) return undefined;

    let active = true;
    const loadNotifications = async () => {
      try {
        const data = await apiRequest(`/api/notifications/user/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (active) setFetchedNotifications(Array.isArray(data) ? data : []);
      } catch {
        if (active) setFetchedNotifications([]);
      }
    };

    loadNotifications();
    const pollingId = window.setInterval(loadNotifications, 30000);
    return () => {
      active = false;
      window.clearInterval(pollingId);
    };
  }, [usesManagedNotifications, user?.userId]);

  // Fetch notifications from API when dropdown is opened
  async function handleBellClick() {
    const newShow = !showNotifications;
    setShowNotifications(newShow);

    // If notifications are provided via props (e.g. Finance polling), skip API fetch
    if (usesManagedNotifications) {
      return;
    }

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
    // Use dedicated prop if provided (Finance notification system)
    if (onMarkAllRead) {
      onMarkAllRead();
      setFetchedNotifications(prev => prev ? prev.map(n => ({ ...n, is_read: 1 })) : []);
      return;
    }

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

  function handleNotificationClick(notification) {
    const notificationId = notification.notification_id || notification.id;
    const isRead = notification.is_read === 1 || notification.is_read === true || notification.read;
    const isDeletionRequest = notification.type === "account_deletion_request";

    if (isDeletionRequest) {
      setShowNotifications(false);
      navigate("/dashboard/settings?section=danger");
    }

    if (isRead || !notificationId) return;

    if (onMarkNotificationRead) {
      onMarkNotificationRead(notificationId);
      return;
    }

    apiRequest(`/api/notifications/${notificationId}/read`, { method: "PUT" })
      .then(() => {
        setFetchedNotifications((current) => (current || []).map((item) =>
          (item.notification_id || item.id) === notificationId
            ? { ...item, is_read: 1, read: true }
            : item
        ));
      })
      .catch(() => {});
  }

  return (
    <div className={classes.page}>
      <div className={classes.grid} />
      {!hideSidebar && mobileSidebarOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-20 bg-[#251E1F]/35 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      ) : null}
      {!hideSidebar ? (
        <Sidebar
          sections={sidebarSections}
          title={sidebarTitle}
          theme={theme}
          mobileOpen={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
          desktopCollapsed={sidebarCollapsed}
          onToggleDesktop={toggleDesktopSidebar}
        />
      ) : null}

      <div className={`relative z-10 transition-[padding-left] duration-200 ease-out ${hideSidebar || sidebarCollapsed ? "lg:pl-0" : "lg:pl-64"}`}>
        <header className={classes.header}>
          {!hideSidebar ? (
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className={`${classes.iconButton} lg:hidden`}
              aria-label="Open menu"
            >
              <Menu size={21} />
            </button>
          ) : null}
          {!hideSidebar && sidebarCollapsed ? (
            <button
              type="button"
              onClick={toggleDesktopSidebar}
              className="hidden h-10 w-10 items-center justify-center rounded-lg text-[#6f4f47] transition hover:bg-[#FDD9CD]/45 hover:text-[#F38978] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F38978]/45 lg:flex"
              aria-label="Show sidebar"
              aria-expanded={!sidebarCollapsed}
              title="Show sidebar"
            >
              <PanelLeftOpen size={21} aria-hidden="true" />
            </button>
          ) : null}

          <VanidayLogo
            compact
            className="shrink-0 border-r border-[#f0d2ca] pr-4"
          />

          <h1 className={classes.title}>
            {pageTitle}
          </h1>

          {/* Search */}
          <div className={classes.searchWrap}>
            <Search size={16} className={classes.searchIcon} />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (onSearch) onSearch(e.target.value);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              className={classes.searchInput}
            />
            {searchQuery && (
              <button type="button" onClick={() => { setSearchQuery(""); if (onSearch) onSearch(""); }} className={classes.mutedButton}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              type="button"
              onClick={handleBellClick}
              className={`relative ${classes.iconButton}`}
              aria-label="Notifications"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className={classes.badge}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowNotifications(false)} />
                <div className={classes.dropdown}>
                  <div className={`flex items-center justify-between border-b px-4 py-3 ${classes.dropdownBorder}`}>
                    <h3 className={`text-sm font-semibold ${classes.dropdownTitle}`}>Notifications</h3>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${classes.dropdownMuted}`}>{unreadCount} unread</span>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold ${classes.dropdownAction}`}
                        >
                          <Check size={12} />
                          Mark all read
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {loadingNotifications ? (
                      <div className={`px-4 py-8 text-center text-sm ${classes.dropdownMuted}`}>
                        Loading...
                      </div>
                    ) : displayNotifications.length === 0 ? (
                      <div className={`px-4 py-8 text-center text-sm ${classes.dropdownMuted}`}>
                        No notifications yet
                      </div>
                    ) : (
                      displayNotifications.slice(0, 10).map((notif, index) => {
                        const isRead = notif.is_read === 1 || notif.is_read === true || notif.read;
                        return (
                          <div
                            key={notif.notification_id || notif.id || index}
                            onClick={() => handleNotificationClick(notif)}
                            className={`${classes.notificationHover} ${!isRead ? classes.unreadBg : ""}`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm ${!isRead ? classes.notificationTitle : classes.notificationRead}`}>
                                {notif.title || notif.message}
                              </p>
                              {notif.message && notif.title && (
                                <p className={`mt-0.5 text-xs ${classes.notificationSubtle}`}>{notif.message}</p>
                              )}
                              {notif.created_at && (
                                <p className={`mt-1 text-xs ${classes.notificationDate}`}>
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
              className={classes.profileButton}
            >
              <div className={classes.avatar}>
                <UserCog size={20} />
              </div>
              <div className="hidden leading-tight sm:block">
                <p className={`text-sm font-semibold ${classes.profileText}`}>{displayName}</p>
                <p className={`text-xs ${classes.profileSubtext}`}>{displayRole}</p>
              </div>
            </button>

            {/* Profile Dropdown Menu */}
            {showProfileMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowProfileMenu(false)} />
                <div className={classes.dropdownWide}>
                  <div className={`border-b px-4 py-3 ${classes.dropdownBorder}`}>
                    <p className={`text-sm font-semibold ${classes.profileText}`}>{displayName}</p>
                    <p className={`text-xs ${classes.dropdownMuted}`}>{displayRole}</p>
                  </div>
                  <div className="py-1.5">
                    <button
                      type="button"
                      onClick={() => { setShowProfileMenu(false); navigate("/dashboard/settings"); }}
                      className={classes.menuItem}
                    >
                      <User size={15} />
                      My Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowProfileMenu(false); navigate("/dashboard/settings"); }}
                      className={classes.menuItem}
                    >
                      <Settings size={15} />
                      Settings
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowProfileMenu(false); navigate("/dashboard/settings"); }}
                      className={classes.menuItem}
                    >
                      <Shield size={15} />
                      Security
                    </button>
                  </div>
                  <div className={`border-t py-1.5 ${classes.dropdownBorder}`}>
                    <button
                      type="button"
                      onClick={() => { setShowProfileMenu(false); handleLogout(); }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-rose-400 transition hover:bg-rose-500/10 hover:text-rose-700"
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
