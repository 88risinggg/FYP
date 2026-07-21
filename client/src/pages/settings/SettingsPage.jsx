import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Bell,
  Building2,
  CreditCard,
  Eye,
  FileText,
  Globe,
  Key,
  Link2,
  Lock,
  LogOut,
  Monitor,
  Palette,
  Phone,
  Shield,
  Smartphone,
  Trash2,
  User,
  Users,
  Wallet
} from "lucide-react";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { getStoredSession } from "../../services/sessionService.js";

import ProfileSection from "./sections/ProfileSection.jsx";
import SecuritySection from "./sections/SecuritySection.jsx";
import ConnectedAccountsSection from "./sections/ConnectedAccountsSection.jsx";
import NotificationsSection from "./sections/NotificationsSection.jsx";
import InvoiceSettingsSection from "./sections/InvoiceSettingsSection.jsx";
import PayrollSettingsSection from "./sections/PayrollSettingsSection.jsx";
import CompanySettingsSection from "./sections/CompanySettingsSection.jsx";
import RolesPermissionsSection from "./sections/RolesPermissionsSection.jsx";
import SessionsSection from "./sections/SessionsSection.jsx";
import AuditLogsSection from "./sections/AuditLogsSection.jsx";
import ApiIntegrationsSection from "./sections/ApiIntegrationsSection.jsx";
import AppearanceSection from "./sections/AppearanceSection.jsx";
import LanguageSection from "./sections/LanguageSection.jsx";
import DataPrivacySection from "./sections/DataPrivacySection.jsx";
import DangerZoneSection from "./sections/DangerZoneSection.jsx";

const settingsMenu = [
  { id: "profile", label: "Profile", icon: User },
  { id: "security", label: "Account Security", icon: Shield },
  { id: "connected", label: "Connected Accounts", icon: Link2 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "invoice", label: "Invoice Settings", icon: FileText },
  { id: "payroll", label: "Payroll Settings", icon: Wallet },
  { id: "company", label: "Company Settings", icon: Building2 },
  { id: "roles", label: "Roles & Permissions", icon: Users },
  { id: "sessions", label: "Login Sessions", icon: Monitor },
  { id: "audit", label: "Audit Logs", icon: Activity },
  { id: "api", label: "API & Integrations", icon: Key },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "language", label: "Language", icon: Globe },
  { id: "privacy", label: "Data & Privacy", icon: Lock },
  { id: "danger", label: "Danger Zone", icon: AlertTriangle }
];

const sidebarSections = [
  {
    label: "SETTINGS",
    items: [
      { label: "Settings", icon: User, path: "/dashboard/settings", end: true }
    ]
  }
];

export default function SettingsPage() {
  const session = getStoredSession();
  const [activeSection, setActiveSection] = useState("profile");
  const [settingsSearch, setSettingsSearch] = useState("");
  const visibleSettings = settingsMenu.filter((item) =>
    item.label.toLowerCase().includes(settingsSearch.trim().toLowerCase())
  );

  function renderSection() {
    switch (activeSection) {
      case "profile":
        return <ProfileSection />;
      case "security":
        return <SecuritySection />;
      case "connected":
        return <ConnectedAccountsSection />;
      case "notifications":
        return <NotificationsSection />;
      case "invoice":
        return <InvoiceSettingsSection />;
      case "payroll":
        return <PayrollSettingsSection />;
      case "company":
        return <CompanySettingsSection />;
      case "roles":
        return <RolesPermissionsSection />;
      case "sessions":
        return <SessionsSection />;
      case "audit":
        return <AuditLogsSection />;
      case "api":
        return <ApiIntegrationsSection />;
      case "appearance":
        return <AppearanceSection />;
      case "language":
        return <LanguageSection />;
      case "privacy":
        return <DataPrivacySection />;
      case "danger":
        return <DangerZoneSection />;
      default:
        return <ProfileSection />;
    }
  }

  return (
    <DashboardLayout
      pageTitle="Settings"
      user={session?.user}
      sidebarSections={sidebarSections}
      sidebarTitle="Automated Invoicing & Payroll System"
      searchPlaceholder="Search settings..."
      onSearch={setSettingsSearch}
    >
      <section className="flex flex-col gap-6 lg:flex-row">
        {/* Settings Sidebar */}
        <nav className="w-full shrink-0 lg:w-64">
          <div className="app-panel rounded-2xl p-3">
            <div className="space-y-0.5">
              {visibleSettings.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                const isDanger = item.id === "danger";
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSection(item.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? isDanger
                          ? "bg-rose-500/15 text-rose-700 shadow-lg shadow-rose-500/10"
                          : "bg-gradient-to-r from-[#FDD9CD] to-[#fff3ee] text-[#251E1F] shadow-lg shadow-[#f2b5a9]/20"
                        : isDanger
                          ? "text-rose-500/70 hover:bg-rose-500/10 hover:text-rose-700"
                          : "text-[#7b6660] hover:bg-[#FDD9CD]/45 hover:text-[#251E1F]"
                    }`}
                  >
                    <Icon size={16} className={isActive && !isDanger ? "text-[#F38978]" : ""} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
              {visibleSettings.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-[#7b6660]">No settings sections match your search.</p>
              ) : null}
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <div className="min-w-0 flex-1">
          {renderSection()}
        </div>
      </section>
    </DashboardLayout>
  );
}
