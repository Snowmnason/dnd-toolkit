/**
 * Phase 1: Preload Phase (NON-CRITICAL)
 * 
 * Responsibility: Load critical fonts and platform assets
 * Called by: system/Kernel/app-kernel.ts
 * 
 * Timing: ~100-400ms, max 1000ms (defined in app-kernel)
 * Critical: NO — app renders without fonts (fallbacks available)
 * Failure mode: Logged as warning; non-critical fonts load asynchronously
 * 
 * Does:
 * 1. Load platform-specific fonts (web injects <link>, native uses RN Linking)
 * 2. Preload themes in background
 * 3. Mark fonts as ready when complete
 * 
 * What initializes:
 * - Fonts: GrenzeGotisch (text), platform-specific sans-serif
 * - Themes: Dark/light theme tokens
 *
 * NOTE: Non-critical; failures don't block app startup
 */

/**
 * Execute preload phase
 * 
 * Loads critical fonts and themes. Platform-aware (web uses web fonts,
 * native uses expo-font). Preload failures don't block bootstrap.
 * 
 * @param state - Mutable kernel state
 */
export async function preloadPhase(): Promise<void> {
  try {
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

    // Preload themes in background
    preloadThemes().catch(() => {
      // Silently fail — theme preload is background task
    });
  } catch (error) {
    const { logger } = await import("@/lib/utils");
    logger
      .category("bootstrap")
      .warn("Preload assets failed (non-critical)", {
        error: (error as Error).message,
      });
    // Non-critical — app continues
  }
}
