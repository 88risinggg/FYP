export const DEFAULT_APPEARANCE = {
  theme: "system",
  accent_color: "#F38978",
  compact_mode: false,
  font_size: "medium",
  language: "en"
};

const STORAGE_KEY = "vanidayAppearance";
const VALID_THEMES = new Set(["light", "dark", "system"]);
const VALID_FONT_SIZES = new Set(["small", "medium", "large"]);
const VALID_ACCENTS = new Set(["#F38978", "#E87562", "#C55245", "#FDD9CD", "#2D7C83", "#7B6660"]);

export function normalizeAppearance(value = {}) {
  const requestedAccent = String(value.accent_color || "").toUpperCase();
  const accent = VALID_ACCENTS.has(requestedAccent) ? requestedAccent : DEFAULT_APPEARANCE.accent_color;

  return {
    ...DEFAULT_APPEARANCE,
    ...value,
    theme: VALID_THEMES.has(value.theme) ? value.theme : DEFAULT_APPEARANCE.theme,
    accent_color: accent,
    compact_mode: value.compact_mode === true || value.compact_mode === 1 || value.compact_mode === "1",
    font_size: VALID_FONT_SIZES.has(value.font_size) ? value.font_size : DEFAULT_APPEARANCE.font_size,
    language: String(value.language || DEFAULT_APPEARANCE.language)
  };
}

export function readCachedAppearance() {
  try {
    return normalizeAppearance(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"));
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function applyAppearance(value, { persist = true } = {}) {
  const settings = normalizeAppearance(value);
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const resolvedTheme = settings.theme === "system" ? (prefersDark ? "dark" : "light") : settings.theme;
  const root = document.documentElement;

  root.dataset.theme = resolvedTheme;
  root.dataset.themePreference = settings.theme;
  root.dataset.compact = String(settings.compact_mode);
  root.dataset.fontSize = settings.font_size;
  root.style.setProperty("--app-accent", settings.accent_color);

  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Appearance still applies for the current page if storage is unavailable.
    }
  }

  window.dispatchEvent(new CustomEvent("vaniday:appearance-change", { detail: settings }));
  return settings;
}
