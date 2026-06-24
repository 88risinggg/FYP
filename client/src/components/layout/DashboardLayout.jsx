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
  X,
  UserCog,
  Users,
  X
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { NavLink } from "react-router-dom";

import { NavLink, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import { clearSession } from "../../services/sessionService.js";
import { getStoredSession } from "../../services/sessionService.js";

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
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
  const session = getStoredSession();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchWrapRef = useRef(null);

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
                // [HR BRANCH - Steven] HR-specific search result formatting — safe to keep for other roles (no visual impact)
                subtitle: [item.employee_id || item.staff_id, item.email, item.department_id]
                  .filter(Boolean)
                  .join(" • "),
                href: `/dashboard/payroll/hr/staff?highlight=${encodeURIComponent(item.employee_id || item.staff_id || item.name || "")}`
              }))
            : []
        );
      } catch (_err) {
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

  const hasSearchResults = searchQuery.trim().length >= 2 && searchResults.length > 0;

  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);

  useEffect(() => {
    if (!notifOpen || !session?.token) return;
    let cancelled = false;
    setNotifLoading(true);
    fetch(`${window.__API_BASE_URL__ || (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000")}/api/hr/notifications`, {
      headers: { Authorization: `Bearer ${session.token}` }
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (!cancelled) setNotifications(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setNotifications([]); })
      .finally(() => { if (!cancelled) setNotifLoading(false); });
    return () => { cancelled = true; };
  }, [notifOpen, session?.token]);

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
            onClick={() => setMobileOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[#d8c6e8] hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Open menu"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen(true)}
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
                  <div className="px-4 py-3 text-sm text-[#d8c6e8]">No results for “{searchQuery.trim()}”.</div>
                )}
              </div>
            )}
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
            {/* [STAFF BRANCH - Steven] notificationBadgeCount prop added for Staff unread payslip badge (FR6) */}
            {/* Other roles do not pass this prop — defaults to undefined, existing behavior unchanged */}
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
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotifOpen((s) => !s)}
              className="relative flex h-10 w-10 items-center justify-center rounded-lg text-[#d8c6e8] hover:bg-white/10 hover:text-white"
              aria-label="Notifications"
            >
              <Bell size={20} />
              <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#FF4DDB] ring-2 ring-[#090014]" />
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-lg bg-[#0b0710] border border-white/10 shadow-lg z-50">
                <div className="p-3">
                  <p className="text-sm font-semibold text-white">Notifications</p>
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {notifLoading ? (
                    <div className="px-4 py-3 text-sm text-[#d8c6e8]">Loading…</div>
                  ) : notifications.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-[#d8c6e8]">No notifications yet.</div>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.notif_id ?? n.id} className={`px-4 py-3 border-t border-white/5 ${!n.read ? "bg-white/[0.02]" : ""}`}>
                        <p className="text-sm text-white font-medium">{n.title ?? n.type ?? "Notification"}</p>
                        <p className="text-xs text-[#d8c6e8]">{n.message ?? n.body ?? ""}</p>
                        {n.timestamp ? <p className="mt-1 text-xs text-[#d8c6e8]/50">{new Date(n.timestamp).toLocaleString()}</p> : null}
                      </div>
                    ))
                  )}
                </div>
                <div className="p-3 border-t border-white/5 text-center">
                  <button className="text-sm text-[#C77DFF]">View all</button>
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((s) => !s)}
              className="flex items-center gap-3 rounded-lg px-2 py-1.5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C77DFF]/15 text-[#C77DFF] ring-1 ring-[#C77DFF]/25">
                <UserCog size={20} />
              </div>
              <div className="hidden leading-tight sm:block">
                <p className="text-sm font-semibold text-white">{displayName}</p>
                <p className="text-xs text-[#d8c6e8]/75">{displayRole}</p>
              </div>
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-lg bg-[#0b0710] border border-white/10 shadow-lg z-50">
                <div className="p-2">
                  <button className="w-full text-left px-3 py-2 rounded hover:bg-white/5 text-sm text-white">Profile</button>
                  <button
                    className="w-full text-left px-3 py-2 rounded hover:bg-white/5 text-sm text-white"
                    onClick={() => { clearSession(); navigate('/login'); }}
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>
        
        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-40">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
            <div className="relative h-full w-64 bg-[#090014]/95 border-r border-white/10">
              <div className="flex items-center justify-between p-4">
                <div className="text-white font-semibold">{sidebarTitle}</div>
                <button className="p-2 text-[#d8c6e8]" onClick={() => setMobileOpen(false)} aria-label="Close">
                  <X />
                </button>
              </div>
              <nav className="px-3 py-4">
                {sidebarSections.map((section) => (
                  <div key={section.label} className="mb-4">
                    <p className="mb-2 px-2 text-xs uppercase text-[#C77DFF]/70">{section.label}</p>
                    <div className="space-y-1">
                      {section.items.map((item) => (
                        <NavLink key={item.label} to={item.path} onClick={() => setMobileOpen(false)} className="block rounded px-3 py-2 text-sm text-[#d8c6e8] hover:bg-white/5">
                          <div className="flex items-center gap-3"><item.icon size={16} />{item.label}</div>
                        </NavLink>
                      ))}
                    </div>
                  </div>
                ))}
              </nav>
            </div>
          </div>
        )}
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
