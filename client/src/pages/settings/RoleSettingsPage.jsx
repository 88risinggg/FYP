import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, Globe, LayoutGrid, Lock, Palette, Save, Shield, User, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { getStoredSession } from "../../services/sessionService.js";
import { SETTINGS_SAVE_RESULT_EVENT } from "../../services/settingsEvents.js";

import FinanceProfileSection from "./finance-sections/FinanceProfileSection.jsx";
import FinanceSecuritySection from "./finance-sections/FinanceSecuritySection.jsx";
import FinanceAppearanceSection from "./finance-sections/FinanceAppearanceSection.jsx";
import FinanceLanguageSection from "./finance-sections/FinanceLanguageSection.jsx";
import FinanceDataPrivacySection from "./finance-sections/FinanceDataPrivacySection.jsx";
import DangerZoneSection from "./sections/DangerZoneSection.jsx";
import RoleNotificationsSection from "./RoleNotificationsSection.jsx";

const roleConfig = {
  Finance: {
    title: "Finance Settings",
    fallbackPath: "/module-selection",
    allowedPrefixes: ["/dashboard/invoicing/finance", "/dashboard/payroll/finance"]
  },
  HR: {
    title: "HR Settings",
    fallbackPath: "/dashboard/payroll/hr",
    allowedPrefixes: ["/dashboard/payroll/hr"]
  },
  Staff: {
    title: "Staff Settings",
    fallbackPath: "/dashboard/payroll/staff",
    allowedPrefixes: ["/dashboard/payroll/staff"]
  }
};

const settingsMenu = [
  { id: "profile", label: "Profile", icon: User },
  { id: "security", label: "Account Security", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "language", label: "Language", icon: Globe },
  { id: "privacy", label: "Data & Privacy", icon: Lock },
  { id: "danger", label: "Danger Zone", icon: AlertTriangle }
];

const floatingSaveSections = new Set(["profile", "security", "notifications", "appearance", "language", "privacy"]);

function resolveRoleSettingsHomePath(from = "", role = "Staff") {
  const config = roleConfig[role] || roleConfig.Staff;
  return config.allowedPrefixes.some((prefix) => String(from).startsWith(prefix)) ? from : config.fallbackPath;
}

export default function RoleSettingsPage({ role = "Staff" }) {
  const session = getStoredSession();
  const location = useLocation();
  const config = roleConfig[role] || roleConfig.Staff;
  const homePath = resolveRoleSettingsHomePath(location.state?.from, role);
  const requestedSection = new URLSearchParams(location.search).get("section");
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
    const props = { key: sectionVersion, onDirty: () => setHasUnsavedChanges(true) };
    switch (activeSection) {
      case "profile": return <FinanceProfileSection {...props} />;
      case "security": return <FinanceSecuritySection {...props} />;
      case "notifications": return <RoleNotificationsSection {...props} role={role} />;
      case "appearance": return <FinanceAppearanceSection {...props} />;
      case "language": return <FinanceLanguageSection {...props} />;
      case "privacy": return <FinanceDataPrivacySection {...props} />;
      case "danger": return <DangerZoneSection />;
      default: return <FinanceProfileSection {...props} />;
    }
  }

  return (
    <DashboardLayout
      pageTitle={config.title}
      user={session?.user}
      searchPlaceholder="Search settings..."
      hideSidebar
      homePath={homePath}
    >
      <section className="flex flex-col gap-6 pb-24 lg:flex-row">
        <nav className="w-full shrink-0 lg:w-64">
          <div className="app-panel rounded-2xl p-3">
            <Link to="/module-selection" className="mb-2 flex items-center gap-3 rounded-xl border border-[#ead3cc] px-3 py-2.5 text-sm font-semibold text-[#5a3f39] transition hover:bg-[#FDD9CD]/35 hover:text-[#E8573D]">
              <LayoutGrid size={17} /> Modules
            </Link>
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
                    <Icon size={17} className={isActive && !isDanger ? "text-[#F38978]" : ""} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        <div className="min-w-0 flex-1 [&_[data-settings-save]]:hidden" ref={settingsContentRef}>
          {renderSection()}
        </div>
      </section>

      {floatingSaveSections.has(activeSection) && (
        <div className={`fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-[#f0d2ca] bg-white/95 px-5 py-3 shadow-2xl shadow-[#f2b5a9]/30 backdrop-blur-xl transition-all duration-300 ${
          hasUnsavedChanges ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
        }`}>
          <button
            type="button"
            onClick={handleFloatingSave}
            disabled={!floatingSaveReady || saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#F38978] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#F38978]/30 transition hover:bg-[#e87562] disabled:opacity-60"
          >
            <Save size={15} />
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={() => discardChanges()}
            className="inline-flex items-center gap-2 rounded-xl border border-[#ead3cc] bg-white px-4 py-2.5 text-sm font-semibold text-[#7b6660] transition hover:bg-[#FDD9CD]/50 hover:text-[#251E1F]"
          >
            <X size={15} />
            Cancel
          </button>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-[#f0d2ca] bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-[#251E1F]">Unsaved Changes</h3>
            <p className="mt-2 text-sm text-[#7b6660]">You have unsaved changes. Save or discard them before leaving this section.</p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  handleFloatingSave();
                  if (pendingSection) {
                    setTimeout(() => setActiveSection(pendingSection), 500);
                    setPendingSection(null);
                  }
                }}
                className="rounded-xl bg-[#F38978] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#e87562]"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => discardChanges(pendingSection)}
                className="rounded-xl border border-[#ead3cc] bg-white px-4 py-2.5 text-sm font-semibold text-[#7b6660] transition hover:bg-[#FDD9CD]/50"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => { setConfirmAction(null); setPendingSection(null); }}
                className="rounded-xl border border-[#ead3cc] bg-white px-4 py-2.5 text-sm font-semibold text-[#7b6660] transition hover:bg-[#FDD9CD]/50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
