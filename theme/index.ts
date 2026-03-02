// 🔮 Central theme entry point — exports, registration & preload
import { logger } from "@/lib/utils/logger";
import { allThemes, ThemeFamilyName } from "./themeRegistry";

// 🧱 Theme registry (re-export)
export { allThemes, ThemeFamilyName } from "./themeRegistry";

// 🔁 Public exports
export * from "@/providers/ThemeProvider";
export * from "./families/Classic";
export * from "./families/Cyberpunk";
export * from "./tokens";
export * from "./ultils/colorUtils";
export * from "./ultils/sizing";
export * from "./ultils/tokens";

// 🎯 Dynamic sizing hook (re-export from provider)
export { useScale } from "@/providers";

/**
 * ⚡ Preload all theme assets (fonts, async color maps, etc.)
 * Runs in background after bootstrap - non-blocking
 */
export async function preloadThemes() {
  try {
    for (const [name, theme] of Object.entries(allThemes)) {
      if (typeof (theme as any).preload === "function") {
        await (theme as any).preload();
        logger.category('bootstrap').debug(`Preloaded assets for theme: ${name}`);
      }
    }
  } catch (error) {
    logger.category('bootstrap').warn("Theme preload error (non-critical):", error);
  }
}

/**
 * 🌈 Helper: safely fetch a theme family
 * falls back to "classic" if key not found.
 */
export function getThemeFamily(name?: string) {
  return allThemes[name as ThemeFamilyName] ?? allThemes.classic;
}
