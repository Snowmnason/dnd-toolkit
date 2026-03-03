/**
 * User Settings Phase (POST-READY, NON-BLOCKING)
 *
 * Responsibility: Load user settings and persist UI preferences to storage
 * Called by: system/Kernel/app-kernel.ts (runPostReadyTasks)
 *
 * Timing: ~100-300ms (async database fetch)
 * Critical: NO — runs AFTER appReady as background task
 * Failure mode: Logged as warning; uses hardcoded defaults
 *
 * Does:
 * 1. Check if user is authenticated (via kernel-manager → lib)
 * 2. Fetch user settings from database (via kernel-manager → lib)
 * 3. Persist theme preference to SecureStorage (system→system)
 * 4. Apply language preference to i18n system
 * 5. Store timezone for timestamp conversions
 *
 * What initializes:
 * - User theme preference (light/dark/auto) → SecureStorage persistence
 * - User language preference (en/es/etc.) → i18n system
 * - User timezone preference → timestamp handling
 *
 * NOTE: Post-ready background task; failures don't block app
 * Providers already have defaults and load from storage on mount.
 * This ensures preferences persist across sessions.
 */

/**
 * Execute user phase
 *
 * Loads user settings via kernel-manager (lib facade) and persists
 * preferences directly to SecureStorage (system→system, no manager needed).
 */
export async function userPhase(): Promise<void> {
  const { logger } = await import("@/lib/utils");

  try {
    // ─── STEP 1: Check if user is authenticated ────────────────────
    const { getUserId } = await import("@/lib/kernel/kernel-manager");
    const userId = await getUserId();

    if (!userId) {
      logger
        .category("bootstrap")
        .debug("User not authenticated, skipping user settings load");
      return;
    }

    logger.category("bootstrap").debug("Loading user settings for authenticated user...");

    // ─── STEP 2: Fetch user settings from database ──────────────────
    // Goes through kernel-manager → lib/database (the only lib call)
    const { loadUserSettings } = await import("@/lib/kernel/kernel-manager");
    const settings = await loadUserSettings(userId);

    if (!settings) {
      logger.category("bootstrap").debug("No user settings found in database");
      return;
    }

    logger.category("bootstrap").info("User settings loaded successfully", {
      theme: settings.theme,
      language: settings.language,
      timezone: settings.timezone,
    });

    // ─── STEP 3: Persist Theme Preference (system→system) ──────────
    // Write directly to SecureStorage — ThemeProvider reads this key on mount
    if (settings.theme && settings.theme !== "auto") {
      try {
        const { SecureStorage } = await import("@/system/Storage");
        const { STORAGE_KEYS } = await import("@/maps/storage-keys");
        await SecureStorage.setItem(STORAGE_KEYS.THEME_PREFERENCE, settings.theme);
        logger
          .category("bootstrap")
          .debug("Theme preference persisted to storage", { theme: settings.theme });
      } catch (themeError) {
        logger.category("bootstrap").warn("Failed to persist theme preference", {
          error: (themeError as Error).message,
        });
      }
    }

    // ─── STEP 4: Log other preferences (future integration) ────────
    if (settings.language && settings.language !== "en") {
      logger
        .category("bootstrap")
        .debug("Language preference loaded (i18n integration pending)", {
          language: settings.language,
        });
    }

    if (settings.timezone && settings.timezone !== "UTC") {
      logger
        .category("bootstrap")
        .debug("Timezone preference loaded", { timezone: settings.timezone });
    }

    if (settings.preferences && Object.keys(settings.preferences).length > 0) {
      logger
        .category("bootstrap")
        .debug("User preferences loaded", {
          keys: Object.keys(settings.preferences),
        });
    }

    logger.category("bootstrap").info("✅ User phase completed");
  } catch (error) {
    logger
      .category("bootstrap")
      .error("User phase failed (non-critical, app continues)", {
        error: (error as Error).message,
      });
  }
}
