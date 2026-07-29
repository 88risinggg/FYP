/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - FINANCE
 * PURPOSE: Implements the Finance Settings View screen and its page-level interactions.
 * LAYER: Frontend page - renders a complete screen and coordinates its user interactions.
 * FIND RELATED CODE: Trace its imports for UI components and frontend services used by this screen.
 */
/**
 * Finance Settings View
 *
 * Embedded settings view for Finance users within the Invoice Module.
 * Displays as a view inside FinanceInvoicingPage (not a standalone page).
 */

import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Globe,
  Lock,
  Palette,
  Save,
  Shield,
  User,
  X,
  Loader2,
  RotateCcw
} from "lucide-react";

import { SETTINGS_SAVE_RESULT_EVENT } from "../../services/settingsEvents.js";

import FinanceProfileSection from "../settings/finance-sections/FinanceProfileSection.jsx";
import FinanceSecuritySection from "../settings/finance-sections/FinanceSecuritySection.jsx";
import FinanceNotificationsSection from "../settings/finance-sections/FinanceNotificationsSection.jsx";
import FinanceAppearanceSection from "../settings/finance-sections/FinanceAppearanceSection.jsx";
import FinanceLanguageSection from "../settings/finance-sections/FinanceLanguageSection.jsx";
import FinanceDataPrivacySection from "../settings/finance-sections/FinanceDataPrivacySection.jsx";

const settingsMenu = [
  { id: "profile", label: "Profile", icon: User },
  { id: "security", label: "Account Security", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "language", label: "Language", icon: Globe },
  { id: "privacy", label: "Data & Privacy", icon: Lock }
];

const floatingSaveSections = new Set([
  "profile", "security", "notifications", "appearance", "language", "privacy"
]);

export default function FinanceSettingsView() {
  const [activeSection, setActiveSection] = useState("profile");
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

  useEffect(() => {
    function handleBeforeUnload(e) {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

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
      case "notifications": return <FinanceNotificationsSection {...props} />;
      case "appearance": return <FinanceAppearanceSection {...props} />;
      case "language": return <FinanceLanguageSection {...props} />;
      case "privacy": return <FinanceDataPrivacySection {...props} />;
      default: return <FinanceProfileSection {...props} />;
    }
  }

  return (
    <section className="flex flex-col gap-6 pb-24 lg:flex-row">
      {/* Settings Sidebar */}
      <nav className="w-full shrink-0 lg:w-64">
        <div className="app-panel rounded-2xl p-3">
          <div className="space-y-0.5">
            {settingsMenu.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectSection(item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-gradient-to-r from-[#FDD9CD] to-[#fff3ee] text-[#251E1F] shadow-lg shadow-[#f2b5a9]/20"
                      : "text-[#7b6660] hover:bg-[#FDD9CD]/45 hover:text-[#251E1F]"
                  }`}
                >
                  <Icon size={17} className={isActive ? "text-[#F38978]" : "text-[#7b6660]"} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Settings Content */}
      <div className="min-w-0 flex-1" ref={settingsContentRef}>
        {renderSection()}
      </div>

      {/* Floating Save Bar */}
      {floatingSaveSections.has(activeSection) && (
        <div className={`fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-[#f0d2ca] bg-white/95 px-5 py-3 shadow-2xl shadow-[#f2b5a9]/30 backdrop-blur-xl transition-all duration-300 ${
          floatingSaveReady || hasUnsavedChanges ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
        }`}>
          <button
            type="button"
            onClick={handleFloatingSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#F38978] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#F38978]/30 transition hover:bg-[#e87562] disabled:opacity-60"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Save Changes
          </button>
          <button
            type="button"
            onClick={() => discardChanges()}
            className="inline-flex items-center gap-2 rounded-xl border border-[#ead3cc] bg-white px-4 py-2.5 text-sm font-semibold text-[#7b6660] transition hover:bg-[#FDD9CD]/50 hover:text-[#251E1F]"
          >
            <X size={15} />
            Cancel
          </button>
          <button
            type="button"
            onClick={() => setSectionVersion((v) => v + 1)}
            className="inline-flex items-center gap-2 rounded-xl border border-[#ead3cc] bg-white px-4 py-2.5 text-sm font-semibold text-[#7b6660] transition hover:bg-[#FDD9CD]/50 hover:text-[#251E1F]"
          >
            <RotateCcw size={15} />
            Reset
          </button>
        </div>
      )}

      {/* Unsaved Changes Confirmation Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-[#f0d2ca] bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-[#251E1F]">Unsaved Changes</h3>
            <p className="mt-2 text-sm text-[#7b6660]">
              You have unsaved changes. Do you want to save them before leaving?
            </p>
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
                className="inline-flex items-center gap-2 rounded-xl bg-[#F38978] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#e87562]"
              >
                <Save size={14} />
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
    </section>
  );
}
