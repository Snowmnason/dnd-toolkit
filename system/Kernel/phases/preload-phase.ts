/**
 * Phase 1: Preload Phase (MIXED: fonts non-critical, themes critical)
 * 
 * Responsibility: Initialize themes and load critical fonts
 * Called by: system/Kernel/app-kernel.ts
 * 
 * Timing: ~100-400ms, max 1000ms (defined in app-kernel)
 * Critical: PARTIAL
 *   - Theme preload: YES — themes must be initialized before rendering (styling breaks without them)
 *   - Font loading: NO — system fallback fonts available if load fails
 * Failure mode: 
 *   - If themes fail to preload: app continues but styling may be incomplete
 *   - If fonts fail to load: app continues with system fonts (visible but acceptable)
 * 
 * Does:
 * 1. Preload themes (CRITICAL — tokens/colors needed for rendering)
 * 2. Load platform-specific fonts (non-critical — fallbacks available)
 * 3. Mark fonts as ready when complete
 * 
 * What initializes:
 * - Themes: Dark/light theme tokens and colors (CRITICAL for styling)
 * - Fonts: GrenzeGotisch (text), platform-specific sans-serif (non-critical, fallback available)
 *
 * NOTE: Theme initialization is critical; font loading is non-critical.
 * Overall: ensure themes preload successfully; font failures are acceptable.
 */

/**
 * Execute preload phase
 * 
 * Loads critical fonts and themes. Platform-aware (web uses web fonts,
 * native uses expo-font). Preload failures don't block bootstrap or
 * affect capability degradation — they're logged as informational warnings.
 * 
 * @param state - Mutable kernel state
 */
export async function preloadPhase(signal: AbortSignal): Promise<void> {
  try {
    if (signal.aborted) return;
    const { Platform } = await import("react-native");
    const { preloadThemes } = await import("@/theme");
    const { logger } = await import("@/lib/utils");

    // Load platform-specific fonts
    if (Platform.OS === "web") {
      // ─── Inject Web Fonts ───────────────────────────────────────────
      // Loads fonts.css on web to make custom fonts available
      if (typeof document !== "undefined") {
        try {
          // Detect if running in Electron
          const isElectron = !!(window as any).electronAPI;
          const fontsHref = isElectron ? "app://fonts.css" : "/fonts.css";

          // Check if fonts.css is already loaded
          const existing =
            document.querySelector(`link[href="${fontsHref}"]`) ||
            document.querySelector('link[href="/fonts.css"]') ||
            document.querySelector('link[href="app://fonts.css"]');
          
          if (!existing) {
            // Create and inject the link tag
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = fontsHref;
            link.type = "text/css";

            // Add to head
            const head =
              document.head ||
              document.querySelector("head") ||
              document.documentElement;
            head.appendChild(link);

            logger
              .category("bootstrap")
              .debug(`Web fonts stylesheet injected from ${fontsHref}`);
          }
        } catch (fontError) {
          logger
            .category("bootstrap")
            .error("Failed to inject web fonts:", fontError);
        }
      }
    } else {
      try {
        const FontModule = await import("expo-font");
        const Font = FontModule.default || FontModule;
        const criticalFonts = {
          GrenzeGotisch: require("../../../assets/fonts/GrenzeGotisch.ttf"),
        };
        await Font.loadAsync(criticalFonts);
      } catch (fontError) {
        logger
          .category("bootstrap")
          .warn("Font loading failed (non-critical)", {
            error: (fontError as Error).message,
          });
      }
    }

    // Preload themes — critical for styling tokens and colors
    // This MUST complete successfully before UI renders
    try {
      await preloadThemes();
    } catch (themeError) {
      logger
        .category("bootstrap")
        .error("Theme preload failed (critical)", {
          error: (themeError as Error).message,
        });
      // Rethrow — theme preload is critical; don't continue without themes
      throw themeError;
    }
  } catch (error) {
    const { logger } = await import("@/lib/utils");
    const { reportPreloadBootstrapCrash } = await import(
      '@/system/Degrade/handlers/crash-handlers'
    );
    logger
      .category("bootstrap")
      .warn("Preload assets failed (non-critical)", {
        error: (error as Error).message,
      });
    reportPreloadBootstrapCrash(String(error));
    // Non-critical — app continues
  }
}
