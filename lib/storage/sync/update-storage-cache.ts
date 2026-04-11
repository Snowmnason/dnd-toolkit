import { logger } from "@/lib/utils";
// Import directly from storage modules to avoid circular dependency with index.ts
// index.ts exports updateStorageCache, and this file needs storage functions
import { getPrivacyStorageBackend } from "@/middleware/storage/helpers/privacy";

// Import STORAGE_KEYS consistently
// Note: We import directly from storage-config to avoid circular dependency

// Re-export commonly used keys for this module
const STORAGE_KEYS = {
  USER_DATA: "sno:auth:user_data",
  CONNECTED_WORLDS: "dnd:app:connected_worlds",
  CONNECTED_WORLDS_METADATA: "dnd:app:connected_worlds_metadata",
} as const;

/**
 * Rich cache structure for connected worlds
 * Stores role-based breakdown and counts to support threshold-based verification
 * Prevents accidental cache loss on transient DB failures
 */
export interface ConnectedWorldsCache {
  list: string[]; // Flattened list for quick UI access
  roleMap: {
    dm: string[];
    player: string[];
    gm: string[];
    spectator: string[];
    observer: string[];
  };
  counts: {
    dm: number;
    player: number;
    gm: number;
    spectator: number;
    observer: number;
    total: number;
  };
  lastVerifiedAt: number; // Timestamp of last successful verification
}

/**
 * Storage Cache Update Service
 *
 * Refreshes SecureStorage with fresh data from database.
 * Called when auth-state detects stale cache or settings "Refresh" button is pressed.
 *
 * DOES NOT verify access - just updates cache with fresh database data.
 */

// Module-level lock to deduplicate in-flight refreshAllWorldsCache() calls
// Prevents thundering herd: if 5 parallel verifications all detect stale cache,
// they all share one DB call instead of making 5 redundant refreshes
// Stores { promise, timestamp } so we can detect stale locks and clean them up
let inFlightRefresh: {
  promise: Promise<ConnectedWorldsCache | null>;
  timestamp: number;
} | null = null;

const INBOUND_REFRESH_TIMEOUT_MS = 30 * 1000; // 30 seconds - max time to wait for in-flight refresh before treating as stale

export const updateStorageCache = {
  /**
   * Refresh all world access cache with role-based structure
   *
   * If one world is stale, all worlds are stale - refresh everything at once.
   * World data is minimal (4 values), so refreshing all is efficient.
   *
   * Writes rich cache structure including:
   * - Flattened world ID list (for quick UI access)
   * - Role-based breakdown (dm, player, gm, spectator, observer)
   * - Counts for threshold-based verification
   * - lastVerifiedAt timestamp
   *
   * Flow:
   * 1. Gets userId from SecureStorage (userId never stale)
   * 2. Calls worldsDB.getMyWorlds(userId) (existing database function)
   * 3. Updates SecureStorage with fresh data for ALL worlds
   * 4. Writes rich metadata for staged verification
   *
   * Used by:
   * - auth-state when detecting stale world cache
   * - Settings "Refresh App Data" button
   */
  async refreshAllWorldsCache(): Promise<ConnectedWorldsCache | null> {
    // Deduplicate in-flight calls: if a fresh refresh is already in progress, return that promise
    // But check if the lock is stale (> 30s old) - if so, clear it and start a new request
    if (inFlightRefresh) {
      const lockAgeMsec = Date.now() - inFlightRefresh.timestamp;
      if (lockAgeMsec < INBOUND_REFRESH_TIMEOUT_MS) {
        logger.category('storage').debug(
          `World cache refresh already in flight (${lockAgeMsec}ms old), sharing in-flight request`,
        );
        return inFlightRefresh.promise;
      } else {
        logger.category('storage').warn(
          `Stale in-flight refresh lock detected (${lockAgeMsec}ms old), clearing and starting fresh`,
        );
        inFlightRefresh = null;
      }
    }

    // Create the refresh promise and store it with timestamp
    const refreshPromise = (async () => {
      try {
        // Check if auth session is ready before attempting world query
        // Without a valid session, RLS policies will block access and return 0 worlds
        const { isAuthSessionReady } = await import("@/lib/auth");
        if (!(await isAuthSessionReady())) {
          logger.category('storage').info(
            "Session not ready yet, deferring world cache refresh",
          );
          return null; // Return null to signal "not ready, try again later"
        }

        // Get userId from SecureStorage (never stale)
        const backend = getPrivacyStorageBackend(STORAGE_KEYS.USER_DATA);
        const userData = await backend.getJSON<{ id: string }>(
          STORAGE_KEYS.USER_DATA,
        );
        const userId = userData?.id;

        if (!userId) {
          logger.category('storage').warn(
            "No userId in SecureStorage, skipping cache refresh",
          );
          return null;
        }

        logger.category('storage').info(`Refreshing all worlds cache for user ${userId}`);

        // Call existing database function (no new Supabase query)
        const { worldsDB } = await import("../../database/worlds");
        const userWorlds = await worldsDB.getMyWorlds(userId);

        logger.category('database').info(
          `worldsDB.getMyWorlds returned ${userWorlds.length} worlds for user ${userId}`,
        );

        // Build rich cache structure with role breakdown
        const timestamp = Date.now();
        const roleMap = {
          dm: [] as string[],
          player: [] as string[],
          gm: [] as string[],
          spectator: [] as string[],
          observer: [] as string[],
        };
        const worldList: string[] = [];

        for (const world of userWorlds) {
          worldList.push(world.world_id);
          const role = world.user_role || "player";
          if (role in roleMap) {
            roleMap[role as keyof typeof roleMap].push(world.world_id);
          }
        }

        // Create rich cache with counts
        const richCache: ConnectedWorldsCache = {
          list: worldList,
          roleMap,
          counts: {
            dm: roleMap.dm.length,
            player: roleMap.player.length,
            gm: roleMap.gm.length,
            spectator: roleMap.spectator.length,
            observer: roleMap.observer.length,
            total: worldList.length,
          },
          lastVerifiedAt: timestamp,
        };

        // Write rich cache to storage
        const cacheBackend = getPrivacyStorageBackend(
          STORAGE_KEYS.CONNECTED_WORLDS_METADATA,
        );
        await cacheBackend.setJSON(
          STORAGE_KEYS.CONNECTED_WORLDS_METADATA,
          richCache,
        );

        // Also write flattened list to CONNECTED_WORLDS for backward compatibility
        const listBackend = getPrivacyStorageBackend(STORAGE_KEYS.CONNECTED_WORLDS);
        await listBackend.setJSON(STORAGE_KEYS.CONNECTED_WORLDS, worldList);

        // Update per-world session cache entries
        await Promise.all(
          userWorlds.map(async (world) => {
            const cacheKey = `world_access_${world.world_id}`;
            const metaKey = `world_access_meta_${world.world_id}`;

            const worldBackend = getPrivacyStorageBackend(cacheKey);
            await worldBackend.setJSON(cacheKey, true);
            await worldBackend.setJSON(metaKey, {
              timestamp,
              source: "remote",
            });
          }),
        );

        logger.category('storage').info(
          `Updated cache for ${worldList.length} worlds (DM: ${roleMap.dm.length}, Player: ${roleMap.player.length})`,
        );

        return richCache;
      } catch (error) {
        logger.category('storage').error("Error refreshing all worlds cache", error);
        throw error;
      } finally {
        // Always clear the in-flight lock, whether success or failure
        inFlightRefresh = null;
      }
    })();

    // Store promise with timestamp for staleness detection
    inFlightRefresh = { promise: refreshPromise, timestamp: Date.now() };
    return refreshPromise;
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
      logger.category('storage').info("Refreshing user profile cache");

      // Use centralized DB layer instead of direct Supabase query
      // This ensures consistent error handling, retries, and deduplication
      const { usersDB } = await import("../../database/users");

      // Fetch fresh user profile via DB layer
      const userProfile = await usersDB.getCurrentUser();

      if (!userProfile) {
        logger.category('storage').warn("User profile not found");
        return;
      }

      // Update SecureStorage cache with fresh profile
      const userDataBackend = getPrivacyStorageBackend(STORAGE_KEYS.USER_DATA);
      await userDataBackend.setJSON(STORAGE_KEYS.USER_DATA, userProfile);

      // Update metadata with fresh timestamp
      const userDataMetaKey = `${STORAGE_KEYS.USER_DATA}_meta`;
      const metaBackend = getPrivacyStorageBackend(userDataMetaKey);
      await metaBackend.setJSON(userDataMetaKey, {
        timestamp: Date.now(),
        source: "db_refresh",
      });

      logger.category('storage').info(
        `User profile cache updated for user ${userProfile.id}`,
      );
    } catch (error) {
      logger.category('storage').error("Error refreshing user profile cache:", error);
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
      logger.category('storage').info("Refreshing all caches");

      await Promise.all([
        updateStorageCache.refreshAllWorldsCache(),
        updateStorageCache.refreshUserProfile(),
      ]);

      logger.category('storage').info("All caches refreshed successfully");
    } catch (error) {
      logger.category('storage').error("Error refreshing all caches:", error);
      throw error;
    }
  },
};
