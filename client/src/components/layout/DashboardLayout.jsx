import { useEffect, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
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
import { Link, useNavigate } from "react-router-dom";

import Sidebar from "./Sidebar.jsx";
import { clearSession, getStoredSession } from "../../services/sessionService.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

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
  searchEndpoint = "",
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
  const navigate = useNavigate();
  const session = getStoredSession();
  const roleProfile = roleProfiles[user?.role];
  const displayName = profileName || user?.name || roleProfile?.name || "User";
  const displayRole = profileRole || roleProfile?.role || user?.role || "User";

  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchWrapRef = useRef(null);

  function handleLogout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(event.target)) {
        setSearchResults([]);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!searchEndpoint || query.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return undefined;
    }

    let cancelled = false;
    setSearchLoading(true);

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`${searchEndpoint}?q=${encodeURIComponent(query)}`, {
          headers: {
            ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {})
          }
        });

        if (!response.ok) {
          throw new Error("Search failed");
        }

        const data = await response.json();
        if (cancelled) return;

        setSearchResults(
          Array.isArray(data)
            ? data.map((item) => ({
                id: item.employee_id || item.staff_id || item.name,
                title: item.name || item.staff_name || item.employee_id || "Unknown",
                subtitle: [item.employee_id || item.staff_id, item.email, item.department_id]
                  .filter(Boolean)
                  .join(" | "),
                href: `/dashboard/payroll/hr/staff?highlight=${encodeURIComponent(
                  item.employee_id || item.staff_id || item.name || ""
                )}`
              }))
            : []
        );
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchEndpoint, searchQuery, session?.token]);

  useEffect(() => {
    if (!notificationsOpen || !session?.token) return undefined;

    let cancelled = false;
    setNotificationsLoading(true);
    fetch(`${API_BASE_URL}/api/hr/notifications`, {
      headers: { Authorization: `Bearer ${session.token}` }
    })
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => {
        if (!cancelled) setNotifications(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setNotifications([]);
      })
      .finally(() => {
        if (!cancelled) setNotificationsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [notificationsOpen, session?.token]);

  const hasSearchResults = searchQuery.trim().length >= 2 && searchResults.length > 0;
  const displayedNotifications = notifications.length
    ? notifications.map((notification) => notification.message || notification.title || "Notification")
    : notificationItems;

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

          <div ref={searchWrapRef} className="relative hidden w-full max-w-sm lg:block">
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 shadow-lg shadow-[#9D4EDD]/10 backdrop-blur">
              <Search size={16} className="text-[#C77DFF]" />
              <input
                type="search"
                aria-label="Global search"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#d8c6e8]/60"
              />
            </div>

            {(searchLoading || hasSearchResults || (searchQuery.trim().length >= 2 && !searchLoading)) && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-white/10 bg-[#0b0710] shadow-2xl shadow-black/40">
                {searchLoading ? (
                  <div className="px-4 py-3 text-sm text-[#d8c6e8]">Searching...</div>
                ) : hasSearchResults ? (
                  searchResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => {
                        setSearchQuery(result.title);
                        setSearchResults([]);
                        navigate(result.href);
                      }}
                      className="block w-full border-t border-white/5 px-4 py-3 text-left hover:bg-white/5 first:border-t-0"
                    >
                      <div className="text-sm font-medium text-white">{result.title}</div>
                      {result.subtitle ? <div className="mt-1 text-xs text-[#d8c6e8]">{result.subtitle}</div> : null}
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-[#d8c6e8]">No results for "{searchQuery.trim()}".</div>
                )}
              </div>
            )}
          </div>

          <div className="relative">
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
                  {notificationBadgeCount > 9 ? "9+" : notificationBadgeCount}
                </span>
              ) : null}
            </button>

            {notificationsOpen ? (
              <div className="absolute right-0 top-12 z-30 w-80 overflow-hidden rounded-xl border border-white/10 bg-[#12071f]/95 shadow-2xl shadow-purple-950/40 backdrop-blur-xl">
                <div className="border-b border-white/10 px-4 py-3">
                  <p className="text-sm font-semibold text-white">Notifications</p>
                  <p className="text-xs text-[#d8c6e8]/75">Recent updates</p>
                </div>
                <div className="max-h-64 space-y-1 overflow-y-auto p-2">
                  {notificationsLoading ? (
                    <div className="px-3 py-2 text-sm text-[#d8c6e8]">Loading...</div>
                  ) : displayedNotifications.length ? (
                    displayedNotifications.map((item) => (
                      <div key={item} className="rounded-lg px-3 py-2 text-sm text-[#f4e9ff] transition hover:bg-white/10">
                        {item}
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-[#d8c6e8]">No notifications yet.</div>
                  )}
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
          </div>

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

            {profileOpen ? (
              <div className="absolute right-0 top-12 z-30 w-56 overflow-hidden rounded-xl border border-white/10 bg-[#12071f]/95 shadow-2xl shadow-purple-950/40 backdrop-blur-xl">
                {profilePath ? (
                  <Link
                    to={profilePath}
                    onClick={() => setProfileOpen(false)}
                    className="block px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    Profile
                  </Link>
                ) : null}
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

        <main className="px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
