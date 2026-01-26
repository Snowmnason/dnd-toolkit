import { logger } from "../utils/logger";
// Import directly from storage modules to avoid circular dependency with index.ts
// index.ts exports updateStorageCache, and this file needs storage functions
import { getStorageBackend } from "./privacy";

// Define STORAGE_KEYS locally to avoid importing from index.ts (which would create a cycle)
const STORAGE_KEYS = {
  USER_DATA: "dnd:auth:user_data",
  CONNECTED_WORLDS: "dnd:app:connected_worlds",
} as const;

/**
 * Storage Cache Update Service
 *
 * Refreshes SecureStorage with fresh data from database.
 * Called when auth-state detects stale cache or settings "Refresh" button is pressed.
 *
 * DOES NOT verify access - just updates cache with fresh database data.
 */
export const updateStorageCache = {
  /**
   * Refresh all world access cache
   *
   * If one world is stale, all worlds are stale - refresh everything at once.
   * World data is minimal (4 values), so refreshing all is efficient.
   *
   * Flow:
   * 1. Gets userId from SecureStorage (userId never stale)
   * 2. Calls worldsDB.getMyWorlds(userId) (existing database function)
   * 3. Updates SecureStorage with fresh data for ALL worlds
   *
   * Used by:
   * - auth-state when detecting stale world cache
   * - Settings "Refresh App Data" button
   */
  async refreshAllWorldsCache(): Promise<void> {
    try {
      // Get userId from SecureStorage (never stale)
      const backend = getStorageBackend(STORAGE_KEYS.USER_DATA);
      const userData = await backend.getJSON<{ id: string }>(
        STORAGE_KEYS.USER_DATA
      );
      const userId = userData?.id;

      if (!userId) {
        logger.warn(
          "storage",
          "No userId in SecureStorage, skipping cache refresh"
        );
        return;
      }

      logger.info("storage", `Refreshing all worlds cache for user ${userId}`);

      // Call existing database function (no new Supabase query)
      const { worldsDB } = await import("../database/worlds");
      const userWorlds = await worldsDB.getMyWorlds(userId);

      logger.info(
        "storage",
        `Fetched ${userWorlds.length} worlds from database`
      );

      // Update SecureStorage for each world in parallel
      const timestamp = Date.now();
      await Promise.all(
        userWorlds.map(async (world) => {
          const cacheKey = `world_access_${world.world_id}`;
          const metaKey = `world_access_meta_${world.world_id}`;

          const worldBackend = getStorageBackend(cacheKey);
          await worldBackend.setJSON(cacheKey, true);
          await worldBackend.setJSON(metaKey, {
            timestamp,
            source: "supabase",
          });
        })
      );

      logger.info("storage", `Updated cache for ${userWorlds.length} worlds`);
    } catch (error) {
      logger.error("storage", "Error refreshing all worlds cache:", error);
      throw error;
    }
  },

  /**
   * Refresh user profile cache
   *
   * Fetches latest user profile from Supabase and updates SecureStorage.
   * Does NOT verify admin status - just syncs the cache.
   *
   * Used by:
   * - getCurrentUserProfile() when cache is stale (4+ hours)
   * - Settings "Refresh App Data" button
   *
   * NOTE: Admin panel NEVER uses this - always calls with forceRefresh=true
   */
  async refreshUserProfile(): Promise<void> {
    try {
      logger.info("storage", "Refreshing user profile cache");

      // Import Supabase directly for this critical operation
      const { supabase, isSupabaseConfigured } =
        await import("../database/supabase");

      if (!isSupabaseConfigured()) {
        logger.warn(
          "storage",
          "Supabase not configured, skipping user profile refresh"
        );
        return;
      }

      // Get current session to get auth_id
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        logger.error("storage", "Error getting session:", sessionError);
        throw sessionError;
      }

      if (!session?.user?.id) {
        logger.warn(
          "storage",
          "No active session, skipping user profile refresh"
        );
        return;
      }

      // Fetch fresh user profile from Supabase
      const { data: userProfile, error: profileError } = await supabase
        .from("users")
        .select("*")
        .eq("auth_id", session.user.id)
        .single();

      if (profileError) {
        logger.error("storage", "Error fetching user profile:", profileError);
        throw profileError;
      }

      if (!userProfile) {
        logger.warn("storage", "User profile not found for auth_id");
        return;
      }

      // Update SecureStorage cache with fresh profile
      const userDataBackend = getStorageBackend(STORAGE_KEYS.USER_DATA);
      await userDataBackend.setJSON(STORAGE_KEYS.USER_DATA, userProfile);

      // Update metadata with fresh timestamp
      const userDataMetaKey = `${STORAGE_KEYS.USER_DATA}_meta`;
      const metaBackend = getStorageBackend(userDataMetaKey);
      await metaBackend.setJSON(userDataMetaKey, {
        timestamp: Date.now(),
        source: "supabase",
      });

      logger.info(
        "storage",
        `User profile cache updated for user ${userProfile.id}`
      );
    } catch (error) {
      logger.error("storage", "Error refreshing user profile cache:", error);
      throw error;
    }
  },

  /**
   * Refresh all caches
   *
   * Calls all cache refresh functions to update everything at once.
   * Used by: Settings "Refresh App Data" button
   */
  async refreshEverything(): Promise<void> {
    try {
      logger.info("storage", "Refreshing all caches");

      await Promise.all([
        updateStorageCache.refreshAllWorldsCache(),
        updateStorageCache.refreshUserProfile(),
      ]);

      logger.info("storage", "All caches refreshed successfully");
    } catch (error) {
      logger.error("storage", "Error refreshing all caches:", error);
      throw error;
    }
  },
};
