import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyAppearance,
  DEFAULT_APPEARANCE,
  normalizeAppearance,
  readCachedAppearance
} from "./appearanceService.js";

describe("appearance service", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-preference");
    document.documentElement.removeAttribute("data-compact");
    document.documentElement.removeAttribute("data-font-size");
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  });

  it("normalizes database values and rejects invalid options", () => {
    expect(normalizeAppearance({
      theme: "invalid",
      accent_color: "not-a-colour",
      compact_mode: 1,
      font_size: "huge"
    })).toEqual({
      ...DEFAULT_APPEARANCE,
      compact_mode: true
    });
  });

  it("applies and caches theme, accent, density and font size", () => {
    const settings = applyAppearance({
      theme: "dark",
      accent_color: "#2d7c83",
      compact_mode: true,
      font_size: "large"
    });

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.compact).toBe("true");
    expect(document.documentElement.dataset.fontSize).toBe("large");
    expect(document.documentElement.style.getPropertyValue("--app-accent")).toBe("#2D7C83");
    expect(readCachedAppearance()).toEqual(settings);
  });

  it("resolves system theme from the operating-system preference", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    applyAppearance({ theme: "system" });

    expect(document.documentElement.dataset.themePreference).toBe("system");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
