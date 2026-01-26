import { AuthStateManager } from "../auth/auth-state";
import {
  getSupabaseClientLazy,
  isSupabaseConfiguredLazy,
} from "../database/supabase-lazy";
import { getPrivacyStorageBackend, STORAGE_KEYS } from "../storage";
import { logger } from "../utils/logger";

/**
 * Signs out the current user and clears all local auth state, caches, and user-specific data
 *
 * This performs a complete cleanup:
 * 1. Signs out from Supabase (if configured)
 * 2. Clears all auth-related storage keys
 * 3. Clears QueryCache (user-specific cached queries)
 * 4. Clears world access verification cache
 * 5. Resets theme to classic/dark mode (for clean slate for next user)
 * 6. Preserves other preferences (scale, etc.) as app-level defaults
 *
 * @throws Error if sign out fails
 */
export async function signOutUser(): Promise<void> {
  try {
    logger.info(
      "auth",
      "🔓 Starting sign out process - clearing all user data and caches",
    );

    // Sign out from Supabase if configured
    if (await isSupabaseConfiguredLazy()) {
      const supabase = await getSupabaseClientLazy();
      try {
        await supabase.auth.signOut();
        logger.info("auth", "✅ Signed out from Supabase");
      } catch (error) {
        logger.error("auth", "Error signing out from Supabase:", error);
        // Continue with local cleanup even if Supabase logout fails
      }
    }

    // Clear all auth state (includes QueryCache, world access cache, and auth keys)
    // This is comprehensive and handles all user-specific data
    await AuthStateManager.clearAuthState();

    // Reset theme to defaults (classic, dark mode) for next user
    const themeBackend = getPrivacyStorageBackend(
      STORAGE_KEYS.THEME_PREFERENCE,
    );
    const modeBackend = getPrivacyStorageBackend(STORAGE_KEYS.THEME_MODE);
    await Promise.all([
      themeBackend.setItem(STORAGE_KEYS.THEME_PREFERENCE, "classic"),
      modeBackend.setItem(STORAGE_KEYS.THEME_MODE, "dark"),
    ]);

    logger.info(
      "auth",
      "✅ Sign out completed successfully - all user data and caches cleared",
    );
  } catch (error) {
    logger.error("auth", "❌ Sign out error:", error);
    // Try to clear local state even if error occurred
    try {
      await AuthStateManager.clearAuthState();
      logger.info(
        "auth",
        "⚠️ Supabase signout failed but local state was cleared",
      );
    } catch (clearError) {
      logger.error(
        "auth",
        "Failed to clear local state during error recovery:",
        clearError,
      );
    }
    throw new Error("Failed to sign out. Please try again.");
  }
}
