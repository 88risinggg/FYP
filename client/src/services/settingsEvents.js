export const SETTINGS_SAVE_RESULT_EVENT = "vaniday:settings-save-result";

export function reportSettingsSaveResult(success) {
  window.dispatchEvent(new CustomEvent(SETTINGS_SAVE_RESULT_EVENT, { detail: { success } }));
}
