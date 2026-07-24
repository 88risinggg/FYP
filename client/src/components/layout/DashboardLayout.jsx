import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  Check,
  ChevronRight,
  ExternalLink,
  FileBarChart,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  PanelLeftOpen,
  Search,
  Settings,
  Shield,
  Users,
  X
} from "lucide-react";

import Sidebar from "./Sidebar.jsx";
import VanidayLogo from "../branding/VanidayLogo.jsx";
import payNivoLogo from "../../assets/paynivo-logo.png";
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
  homePath,
  searchPlaceholder = "Search invoices, users, settings...",
  profileName,
  profileRole,
  onSearch,
  searchEndpoint,
  notifications = [],
  notificationBadgeCount,
  notificationsPath,
  profilePath,
  onMarkNotificationRead,
  onMarkAllRead,
  theme,
  moduleClassName = "",
  hideSidebar = false
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const roleProfile = roleProfiles[user?.role];
  const displayName = profileName || user?.name || roleProfile?.name || "User";
  const displayRole = profileRole || roleProfile?.role || user?.role || "User";
  const displayEmail = user?.email || "No email available";
  const avatarUrl = user?.avatarUrl || user?.avatar_url || user?.profilePhoto || "";
  const showModuleSelectorLink = Array.isArray(user?.allowedModules)
    ? user.allowedModules.length > 1
    : ["Admin", "Finance"].includes(user?.role);
  const displayInitials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);
  const [fetchedNotifications, setFetchedNotifications] = useState(null);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readStoredSidebarCollapsed);
  const classes = {
    page: "app-dashboard-shell relative min-h-screen overflow-hidden bg-[#fff8f5] text-[#251E1F]",
    grid: "app-dashboard-grid pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(243,137,120,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(243,137,120,0.08)_1px,transparent_1px)] bg-[size:72px_72px] opacity-20",
    header: "app-dashboard-header sticky top-0 z-10 flex h-20 items-center gap-4 border-b border-[#f2d5cc] bg-[#fff8f5]/85 px-4 shadow-xl shadow-[#f2b5a9]/10 backdrop-blur-2xl sm:px-6",
    iconButton: "flex h-10 w-10 items-center justify-center rounded-lg text-[#6f4f47] transition hover:bg-[#FDD9CD]/45 hover:text-[#F38978] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F38978]/45",
    title: "min-w-0 flex-1 truncate text-base font-semibold text-[#251E1F] sm:text-lg",
    searchWrap: "hidden w-full max-w-sm items-center gap-2 rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 shadow-lg shadow-[#F38978]/10 backdrop-blur lg:flex",
    searchIcon: "text-[#F38978]",
    searchInput: "w-full bg-transparent text-sm text-[#251E1F] outline-none placeholder:text-[#9c7b72]",
    mutedButton: "text-[#6f4f47] hover:text-[#F38978]",
    badge: "absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#F38978] text-[9px] font-bold text-white ring-2 ring-[#fff8f5]",
    dropdown: "app-dashboard-popover absolute right-0 top-12 z-30 w-80 rounded-xl border border-[#f0d2ca] bg-white shadow-2xl shadow-[#f2b5a9]/30",
    dropdownWide: "app-dashboard-popover absolute right-0 top-14 z-30 w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#f0d2ca] bg-white shadow-2xl shadow-[#f2b5a9]/35",
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
    profileSubtext: "text-[#7b6660]"
  };

  function openSettings(section = "") {
    const currentLocation = `${location.pathname}${location.search}`;
    const previousLocation = location.pathname === "/dashboard/settings"
      ? location.state?.from
      : currentLocation;
    navigate(`/dashboard/settings${section ? `?section=${section}` : ""}`, {
      state: { from: previousLocation || "/module-selection" }
    });
  }

  const usesManagedNotifications = notifications.length > 0 || typeof notificationBadgeCount === "number";
  const displayNotifications = fetchedNotifications || notifications;
  const unreadCount = typeof notificationBadgeCount === "number"
    ? notificationBadgeCount
    : displayNotifications.filter((notification) => !(
        notification.is_read === 1 || notification.is_read === true || notification.read
      )).length;
  const searchEnabled = typeof onSearch === "function" || Boolean(searchEndpoint);

  useEffect(() => {
    if (!showProfileMenu) return undefined;

    function closeProfileMenuOnOutsideInteraction(event) {
      if (!profileMenuRef.current?.contains(event.target)) {
        setShowProfileMenu(false);
      }
    }

    function closeProfileMenuOnEscape(event) {
      if (event.key === "Escape") setShowProfileMenu(false);
    }

    document.addEventListener("pointerdown", closeProfileMenuOnOutsideInteraction);
    document.addEventListener("keydown", closeProfileMenuOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeProfileMenuOnOutsideInteraction);
      document.removeEventListener("keydown", closeProfileMenuOnEscape);
    };
  }, [showProfileMenu]);

  useEffect(() => {
    if (!searchEndpoint || !searchQuery.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return undefined;
    }

    let active = true;
    setSearchLoading(true);
    const timeoutId = window.setTimeout(async () => {
      try {
        const separator = searchEndpoint.includes("?") ? "&" : "?";
        const data = await apiRequest(`${searchEndpoint}${separator}q=${encodeURIComponent(searchQuery.trim())}`);
        if (active) {
          setSearchResults(Array.isArray(data) ? data : data?.results || []);
          setSearchOpen(true);
        }
      } catch {
        if (active) {
          setSearchResults([]);
          setSearchOpen(true);
        }
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [searchEndpoint, searchQuery]);

  function getSearchResultDetails(result) {
    const employeeId = result.employee_id || result.employee_code || result.staff_id;
    const title = result.title || result.name || result.staff_name || employeeId || result.id || "Search result";
    const subtitle = result.subtitle || [result.email, result.department_name, result.status]
      .filter(Boolean)
      .join(" • ");
    const href = result.href || (employeeId
      ? `/dashboard/payroll/hr/staff?highlight=${encodeURIComponent(employeeId)}`
      : "");
    return { href, subtitle, title };
  }

  function selectSearchResult(result) {
    const { href } = getSearchResultDetails(result);
    setSearchOpen(false);
    if (href) navigate(href);
  }

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
    setShowProfileMenu(false);
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

    apiRequest("/api/notifications/read-all", {
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
    const actionPath = notification.action_path || notification.actionPath;

    if (isDeletionRequest) {
      setShowNotifications(false);
      navigate("/dashboard/settings?section=danger");
    } else if (actionPath) {
      setShowNotifications(false);
      navigate(actionPath);
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
          showModuleSelectorLink={showModuleSelectorLink}
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

          {homePath ? (
            <Link
              to={homePath}
              aria-label="Go to dashboard"
              title="Go to dashboard"
              className="shrink-0 rounded-md outline-none transition-opacity hover:opacity-75 focus-visible:ring-2 focus-visible:ring-[#F38978]/45"
            >
              <VanidayLogo
                compact
                className="border-r border-[#f0d2ca] pr-4"
              />
            </Link>
          ) : (
            <VanidayLogo
              compact
              className="shrink-0 border-r border-[#f0d2ca] pr-4"
            />
          )}

          <h1 className={classes.title}>
            {pageTitle}
          </h1>

          {/* Search */}
          {searchEnabled ? <div className={`${classes.searchWrap} relative`}>
            <Search size={16} className={classes.searchIcon} />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(Boolean(e.target.value.trim()));
                if (onSearch) onSearch(e.target.value);
              }}
              onFocus={() => { if (searchQuery.trim()) setSearchOpen(true); }}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              className={classes.searchInput}
            />
            {searchQuery && (
              <button type="button" aria-label="Clear search" onClick={() => { setSearchQuery(""); setSearchResults([]); setSearchOpen(false); if (onSearch) onSearch(""); }} className={classes.mutedButton}>
                <X size={14} />
              </button>
            )}
            {searchEndpoint && searchOpen ? (
              <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 overflow-hidden rounded-xl border border-[#f0d2ca] bg-white shadow-2xl shadow-[#f2b5a9]/30">
                {searchLoading ? (
                  <div className="flex items-center justify-center gap-2 px-4 py-5 text-sm text-[#7b6660]"><Loader2 size={16} className="animate-spin" /> Searching...</div>
                ) : searchResults.length ? (
                  <div className="max-h-72 overflow-y-auto py-1">
                    {searchResults.map((result, index) => {
                      const details = getSearchResultDetails(result);
                      return (
                        <button
                          key={`${result.type || "result"}-${result.id || result.employee_id || index}`}
                          type="button"
                          onClick={() => selectSearchResult(result)}
                          className="block w-full px-4 py-3 text-left hover:bg-[#fff3ee]"
                        >
                          <span className="block truncate text-sm font-semibold text-[#251E1F]">{details.title}</span>
                          {details.subtitle ? <span className="mt-0.5 block truncate text-xs text-[#7b6660]">{details.subtitle}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-4 py-5 text-center text-sm text-[#7b6660]">No matching records found.</div>
                )}
              </div>
            ) : null}
          </div> : null}

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

          <div ref={profileMenuRef} className="relative flex items-center gap-3 rounded-lg px-2 py-1.5">
            <button
              type="button"
              onClick={() => {
                setShowNotifications(false);
                setShowProfileMenu(!showProfileMenu);
              }}
              className={classes.profileButton}
              aria-label="Open account menu"
              aria-haspopup="menu"
              aria-expanded={showProfileMenu}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-[#F38978]/20" />
              ) : (
                <div className={`${classes.avatar} text-sm font-bold`} aria-hidden="true">{displayInitials}</div>
              )}
              <div className="hidden leading-tight sm:block">
                <p className={`text-sm font-semibold ${classes.profileText}`}>{displayName}</p>
                <p className={`text-xs ${classes.profileSubtext}`}>{displayRole}</p>
              </div>
            </button>

            {/* Profile Dropdown Menu */}
            {showProfileMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowProfileMenu(false)} />
                <div className={classes.dropdownWide} role="menu" aria-label="Account menu">
                  <div className="account-menu__brand relative flex items-center justify-between overflow-hidden bg-gradient-to-br from-[#251E1F] to-[#3a2d2f] px-5 py-4 text-white">
                    <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full border border-white/10 bg-white/[0.03]" />
                    <div className="relative flex min-w-0 items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-lg shadow-black/20">
                        <img src={payNivoLogo} alt="" className="h-10 w-10 object-contain" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold tracking-wide">PayNivo</p>
                        <p className="mt-0.5 truncate text-[11px] text-white/60">Business workspace</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setShowProfileMenu(false); handleLogout(); }}
                      className="account-menu__signout relative ml-3 inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-2 text-xs font-semibold text-white/75 transition hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                    >
                      <LogOut size={13} aria-hidden="true" />
                      Sign out
                    </button>
                  </div>

                  <div className="account-menu__identity border-b border-[#f0d2ca] bg-gradient-to-br from-white via-white to-[#fff8f5] px-5 py-5">
                    <div className="flex items-start gap-4">
                      <div className="relative shrink-0">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover ring-4 ring-[#FDD9CD]/65" />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#F38978] to-[#C55245] text-xl font-bold text-white shadow-lg shadow-[#F38978]/25" aria-hidden="true">
                            {displayInitials}
                          </div>
                        )}
                        <span className="account-menu__presence absolute bottom-0 right-0 h-4 w-4 rounded-full border-[3px] border-white bg-emerald-500" aria-label="Account active" title="Account active" />
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="truncate text-lg font-bold leading-6 text-[#251E1F]">{displayName}</p>
                        <p className="mt-0.5 truncate text-sm text-[#7b6660]">{displayEmail}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="account-menu__role inline-flex rounded-full bg-[#FDD9CD]/70 px-2.5 py-1 text-[11px] font-semibold text-[#6f4f47]">
                            {displayRole}
                          </span>
                          <button
                            type="button"
                            onClick={() => { setShowProfileMenu(false); openSettings("profile"); }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#C55245] transition hover:text-[#F38978] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F38978]/35"
                          >
                            View account
                            <ExternalLink size={12} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="account-menu__actions space-y-2 p-3">
                    <button
                      type="button"
                      onClick={() => { setShowProfileMenu(false); openSettings(); }}
                      className="account-menu__primary-action group flex w-full items-center gap-3 rounded-xl border border-[#f0d2ca] bg-[#fff8f5] px-3.5 py-3 text-left text-sm font-semibold text-[#251E1F] shadow-sm transition hover:-translate-y-0.5 hover:border-[#F38978]/45 hover:bg-[#FDD9CD]/45 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F38978]/35"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#F38978] shadow-sm">
                        <Settings size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block">Settings</span>
                        <span className="block truncate text-xs font-normal text-[#7b6660]">Manage your account and preferences</span>
                      </span>
                      <ChevronRight size={17} className="text-[#9c7b72] transition-transform group-hover:translate-x-0.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowProfileMenu(false); openSettings("security"); }}
                      className="account-menu__secondary-action group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm text-[#6f4f47] transition hover:bg-[#fff3ee] hover:text-[#251E1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F38978]/35"
                    >
                      <Shield size={17} className="text-[#F38978]" />
                      <span className="flex-1">Security &amp; privacy</span>
                      <ChevronRight size={16} className="text-[#9c7b72] transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        <main className={`px-4 py-6 sm:px-6 ${moduleClassName}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
