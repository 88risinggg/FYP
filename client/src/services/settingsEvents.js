/**
 * EVALUATION HEADER
 * FEATURE: SETTINGS - SHARED
 * PURPOSE: Provides reusable settings Events business or integration operations.
 * LAYER: Frontend service - calls backend APIs or manages browser-side application state.
 * FIND RELATED CODE: Search the API path in server/src/routes to continue into the backend.
 */
export const SETTINGS_SAVE_RESULT_EVENT = "paynivo:settings-save-result";

export function reportSettingsSaveResult(success) {
  window.dispatchEvent(new CustomEvent(SETTINGS_SAVE_RESULT_EVENT, { detail: { success } }));
}
