import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  Building2,
  FileText,
  Globe,
  Key,
  Link2,
  Lock,
  Monitor,
  Palette,
  Shield,
  Save,
  X,
  User,
  Users,
  Wallet
} from "lucide-react";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { getStoredSession } from "../../services/sessionService.js";
import { SETTINGS_SAVE_RESULT_EVENT } from "../../services/settingsEvents.js";

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

const floatingSaveSections = new Set([
  "profile", "security", "notifications", "invoice", "payroll", "company", "api", "appearance", "language", "privacy"
]);

export default function SettingsPage() {
  const session = getStoredSession();
  const requestedSection = new URLSearchParams(window.location.search).get("section");
  const [activeSection, setActiveSection] = useState(
    settingsMenu.some((item) => item.id === requestedSection) ? requestedSection : "profile"
  );
  const [floatingSaveReady, setFloatingSaveReady] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [pendingSection, setPendingSection] = useState(null);
  const [sectionVersion, setSectionVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const settingsContentRef = useRef(null);

  useEffect(() => {
    const content = settingsContentRef.current;
    if (!content || !floatingSaveSections.has(activeSection)) {
      setFloatingSaveReady(false);
      return undefined;
    }

    const updateState = () => {
      const target = content.querySelector("[data-settings-save]");
      setFloatingSaveReady(Boolean(target && !target.disabled));
    };
    const observer = new MutationObserver(updateState);
    observer.observe(content, { attributes: true, childList: true, subtree: true });
    updateState();
    return () => observer.disconnect();
  }, [activeSection]);

  useEffect(() => {
    const handleResult = (event) => {
      setSaving(false);
      if (event.detail?.success) {
        setHasUnsavedChanges(false);
        setConfirmAction(null);
      }
    };
    window.addEventListener(SETTINGS_SAVE_RESULT_EVENT, handleResult);
    return () => window.removeEventListener(SETTINGS_SAVE_RESULT_EVENT, handleResult);
  }, []);

  function handleFloatingSave() {
    setSaving(true);
    setConfirmAction(null);
    settingsContentRef.current?.querySelector("[data-settings-save]")?.click();
  }

  function discardChanges(nextSection = null) {
    setConfirmAction(null);
    setHasUnsavedChanges(false);
    setSectionVersion((value) => value + 1);
    if (nextSection) setActiveSection(nextSection);
    setPendingSection(null);
  }

  function selectSection(section) {
    if (section === activeSection) return;
    if (hasUnsavedChanges) {
      setPendingSection(section);
      setConfirmAction("navigate");
      return;
    }
    setActiveSection(section);
  }

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
      searchPlaceholder="Search settings..."
      hideSidebar
    >
      <section className="flex flex-col gap-6 pb-24 lg:flex-row">
        {/* Settings Sidebar */}
        <nav className="w-full shrink-0 lg:w-64">
          <div className="app-panel rounded-2xl p-3">
            <div className="space-y-0.5">
              {settingsMenu.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                const isDanger = item.id === "danger";
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectSection(item.id)}
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
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <div
          ref={settingsContentRef}
          onInputCapture={() => floatingSaveSections.has(activeSection) && setHasUnsavedChanges(true)}
          onChangeCapture={() => floatingSaveSections.has(activeSection) && setHasUnsavedChanges(true)}
          onClickCapture={(event) => {
            if (event.target.closest("[data-settings-control]") && !event.target.closest("[data-settings-control]").disabled) {
              setHasUnsavedChanges(true);
            }
          }}
          className="min-w-0 flex-1"
        >
          <div key={`${activeSection}-${sectionVersion}`}>{renderSection()}</div>
        </div>
      </section>

      {hasUnsavedChanges && floatingSaveSections.has(activeSection) ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-3 sm:bottom-5 sm:px-4">
          <div className="pointer-events-auto flex w-full max-w-md flex-col gap-2 rounded-2xl border border-[#ead3cc] bg-white/95 p-2.5 shadow-2xl backdrop-blur sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={() => setConfirmAction("save")}
            disabled={!floatingSaveReady || saving}
            className="settings-save-button inline-flex min-w-44 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={17} />
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button type="button" onClick={() => setConfirmAction("cancel")}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e6cbc4] bg-white px-5 py-3 text-sm font-semibold text-[#6f5b56] transition hover:bg-[#fff3ee]">
            <X size={17} /> Cancel
          </button>
          </div>
        </div>
      ) : null}

      {confirmAction ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#251E1F]/35 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="app-panel w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-[#251E1F]">
              {confirmAction === "save" ? "Save setting changes?" : "Discard unsaved changes?"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[#7b6660]">
              {confirmAction === "save"
                ? "Your changes to this settings page will be applied."
                : "Your edits will be removed and the last saved settings will be restored."}
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => { setConfirmAction(null); setPendingSection(null); }}
                className="rounded-xl border border-[#e6cbc4] bg-white px-4 py-2.5 text-sm font-semibold text-[#6f5b56] hover:bg-[#fff3ee]">
                Keep Editing
              </button>
              <button type="button"
                onClick={confirmAction === "save" ? handleFloatingSave : () => discardChanges(confirmAction === "navigate" ? pendingSection : null)}
                className={confirmAction === "save" ? "settings-save-button rounded-xl px-4 py-2.5 text-sm font-semibold" : "rounded-xl bg-[#d98686] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#c97575]"}>
                {confirmAction === "save" ? "Confirm Save" : "Discard Changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
