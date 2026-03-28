import { getUserRepository, getWorldAccessRepository } from "@/lib/database";
import { clearAllUserData, getAllSecureStorageKeys, getPrivacyStorageBackend } from "@/lib/middleware/storage";
import { StorageManager } from "@/lib/storage";
import { logger } from "@/lib/utils";
import { STORAGE_KEYS } from "@/maps";
import { classifyCacheAge } from "@/pure-algo-immutables";

// In-memory flag: signals that data sync should run after appReady.
// Set by performPostAuthSetup (login or stale re-auth). Not persisted — resets on launch.
let _pendingSyncRequired = false;

/**
 * Helper: determine whether a session indicates an email-confirmed user.
 * Centralizes provider-specific checks (Supabase or other providers' shapes).
 */
export function isEmailConfirmed(session: any | null): boolean {
  if (!session) return false;
  // Support multiple session shapes: supabase (session.user) or wrapped/raw session
  const user = (session.user ?? session.raw?.user) as any | undefined;
  if (!user) return false;
  // Supabase uses `email_confirmed_at`. Some providers may use `confirmed_at`.
  return Boolean(user.email_confirmed_at ?? user.confirmed_at);
}

// Cache dynamic imports to prevent re-importing modules on every auth check
let authManagerCache: any = null;

/**
 * Lazy-load auth-manager and cache it to avoid repeated dynamic imports.
 * Auth-state uses auth-manager for all auth operations (restoreSession, getCurrentSession, signOut).
 */
async function getAuthManager() {
  if (!authManagerCache) {
    authManagerCache = await import("./auth-manager");
  }
  return authManagerCache;
}

/**
 * Check if auth backend is configured and available.
 * Uses the middleware (lib/services) — never imports adapter directly.
 */
function isBackendConfigured(): boolean {
  // Dynamic import cached at module level to avoid repeated imports
  // Uses isAuthConfigured from middleware which checks isServiceReady('auth')
  const { isAuthConfigured } = require("@/lib/middleware/services/auth-service");
  return isAuthConfigured();
}

/**
 * Application-level auth state (provider-agnostic).
 * Tracks whether the authenticated user has an account in our system.
 */
export interface AuthState {
  hasAccount: boolean;
}

export interface CacheMetadata {
  timestamp: number; // When cache was last updated
  source: "supabase" | "local"; // Where data came from
}

export const AuthStateManager = {

  // ─── Post-auth sync signalling ─────────────────────────────────────────────
  // markSyncRequired / isSyncRequired / clearSyncRequired coordinate the
  // UIBlocker sync splash (useSyncSplash) that runs after appReady.
  // Called from performPostAuthSetup on every login or stale re-auth.
  markSyncRequired(): void { _pendingSyncRequired = true; },
  isSyncRequired(): boolean { return _pendingSyncRequired; },
  clearSyncRequired(): void { _pendingSyncRequired = false; },

  // Get current auth state
  // IMPORTANT: Always returns an object with hasAccount as a boolean (never null/undefined)
  // - undefined/first init → hasAccount: false (go to welcome)
  // - null/deleted → hasAccount: false (go to welcome)
  // - false/logout → hasAccount: false (go to welcome)
  // - true/logged in → hasAccount: true (continue)
  async getAuthState(): Promise<AuthState> {
    try {
      const storageKey = STORAGE_KEYS.HAS_ACCOUNT;
      const authState =
        await StorageManager.get<AuthState>(storageKey);
      // Explicitly handle all falsy cases: null, undefined, or false
      // All of these should result in hasAccount: false for consistent auth routing
      return { hasAccount: authState?.hasAccount === true };
    } catch (error) {
      logger.category('auth').error("Error getting auth state:", error);
      return { hasAccount: false };
    }
  },

  // Set user has created/logged into account
  async setHasAccount(hasAccount: boolean): Promise<void> {
    try {
      const newState: AuthState = { hasAccount };
      const storageKey = STORAGE_KEYS.HAS_ACCOUNT;
      await StorageManager.set(storageKey, newState);
    } catch (error) {
      logger.category('auth').error("Error setting hasAccount:", error);
    }
  },

  // Mark that user has an account when a session exists.
  // NOTE: Session persistence is handled by the system-level Supabase client
  // onAuthStateChange listener (supabase-client.ts). Do NOT call SessionAdapter.saveSession()
  // here — the normalized Session uses camelCase fields (accessToken, userId) while
  // SessionAdapter expects snake_case (access_token, user.id), causing a corrupt overwrite.
  async setSession(session: any): Promise<void> {
    try {
      if (!session) {
        logger.category('auth').warn("⚠️ setSession received null/undefined session - not saving");
        return;
      }

      // Update auth state — session is already persisted by Supabase's onAuthStateChange
      await this.setHasAccount(true);
    } catch (error) {
      logger.category('auth').error("Error saving auth state:", error);
    }
  },

  // Clear all auth state (logout)
  async clearAuthState(): Promise<void> {
    try {
      // Clear the saved auth session first
      // This ensures Supabase and storage are in sync
      const { SessionAdapter } = await import("@/system/Services");
      await SessionAdapter.clearSession();

      // Clear query cache (all user-specific cached queries)
      const { QueryCache } = await import("@/lib/middleware/storage");
      await QueryCache.clearAll();

      // Clear FastCache (in-memory session cache)
      // CRITICAL: FastCache holds temporary session data like user info, world metadata
      // Must be cleared or next user will see stale data
      try {
        const { FastCache } = await import("@/system/Storage");
        await FastCache.clear();
        logger.category('auth').debug("Cleared FastCache (in-memory cache)");
      } catch (err) {
        logger.category('auth').warn("Failed to clear FastCache:", err);
        // Continue - FastCache clear is non-critical
      }

      // CRITICAL: Set hasAccount to FALSE (not remove it)
      // If we remove it, the check becomes null which can be interpreted as "unknown"
      // By explicitly setting to false, we ensure the user is treated as logged out
      await this.setHasAccount(false);

      // Clear user-specific data (but keep storage keys for reuse by next user)
      // Clear LAST_LOGGED_IN by setting to empty string (will fail !lastLoggedInStr check)
      await Promise.all([
        (async () => {
          const backend = getPrivacyStorageBackend(STORAGE_KEYS.USER_DATA);
          await backend.removeItem(STORAGE_KEYS.USER_DATA);
        })(),
        (async () => {
          const backend = getPrivacyStorageBackend(
            STORAGE_KEYS.CONNECTED_WORLDS,
          );
          await backend.removeItem(STORAGE_KEYS.CONNECTED_WORLDS);
        })(),
        (async () => {
          const backend = getPrivacyStorageBackend(STORAGE_KEYS.LAST_LOGGED_IN);
          await backend.setItem(STORAGE_KEYS.LAST_LOGGED_IN, "");
        })(),
        (async () => {
          const backend = getPrivacyStorageBackend(
            STORAGE_KEYS.SESSION_USER_EMAIL,
          );
          await backend.removeItem(STORAGE_KEYS.SESSION_USER_EMAIL);
        })(),
      ]);

      // Clear world access cache entries (pattern-based)
      // These keys follow patterns: world_access_* and world_access_meta_*
      try {
        const allStorageKeys = await getAllSecureStorageKeys();
        const worldAccessKeys = allStorageKeys.filter(
          (key) =>
            key.startsWith("world_access_") ||
            key.startsWith("world_access_meta_"),
        );
        await Promise.all(
          worldAccessKeys.map((key) => StorageManager.remove(key)),
        );

        if (worldAccessKeys.length > 0) {
          logger.category('auth').debug(`Cleared ${worldAccessKeys.length} world access cache entries`);
        }
      } catch (error) {
        logger.category('auth').warn("Could not clear world access cache entries:", error);
        // Continue even if this fails - world access cache is non-critical
      }

      logger.category('auth').debug("Cleared all auth storage keys and user-specific caches");
    } catch (error) {
      logger.category('auth').error("Error clearing auth state:", error);
    }
  },

  // Get stored user ID (convenience method)
  async getUserId(): Promise<string | undefined> {
    try {
      const backend = getPrivacyStorageBackend(STORAGE_KEYS.USER_DATA);
      const userData = await backend.getJSON<{ id: string }>(
        STORAGE_KEYS.USER_DATA,
      );
      const userId = userData?.id;
      // Set context stack with userId for all subsequent logs
      if (userId) {
        logger.setContext({ userId });
      }
      return userId;
    } catch (error) {
      logger.category('auth').error("Error getting user ID:", error);
      return undefined;
    }
  },

  // Get stored user data (full profile)
  async getUserData(): Promise<any> {
    try {
      const backend = getPrivacyStorageBackend(STORAGE_KEYS.USER_DATA);
      const userData = await backend.getJSON(STORAGE_KEYS.USER_DATA);
      
      if (userData) {
        // (A) Set context for userId if available
        if (userData.id) {
          logger.setContext({ userId: userData.id });
        }
        logger.category('auth').debug("📖 getUserData returning from storage:", {
          id: userData.id,
          id_length: userData.id?.length,
          auth_id: userData.auth_id,
          auth_id_length: userData.auth_id?.length,
          username: userData.username,
          isFullProfile: userData.id && userData.id.length === 36,
        });
      } else {
        logger.category('auth').debug("📖 getUserData: storage is empty (no user data)");
      }
      
      return userData;
    } catch (error) {
      logger.category('auth').error("Error getting user data:", error);
      return undefined;
    }
  },

  // Save user data to storage
  async saveUserData(userData: any): Promise<void> {
    try {
      if (!userData) {
        logger.category('auth').warn("saveUserData: received null/undefined userData");
        return;
      }

      logger.category('auth').info("💾 Saving user data to storage", {
        id: userData.id,
        auth_id: userData.auth_id,
        username: userData.username,
        is_admin: userData.is_admin,
        idLength: userData.id?.length,
      });

      const backend = getPrivacyStorageBackend(STORAGE_KEYS.USER_DATA);
      await backend.setJSON(STORAGE_KEYS.USER_DATA, userData);
      
      logger.category('auth').info("✅ User data saved successfully", {
        id: userData.id,
      });
    } catch (error) {
      logger.category('auth').error("Error saving user data:", error);
    }
  },

  // ==========================================
  // 🔒 AUTHENTICATION CHECK - Quick check for route guards
  // ==========================================
  async isAuthenticated(): Promise<boolean> {
    try {
      // Step 1: Quick local storage check (fast path)
      const authState = await this.getAuthState();

      if (!authState.hasAccount) {
        return false;
      }

      // Check if auth backend is available (middleware check, not direct adapter)
      if (!isBackendConfigured()) {
        logger.category('auth').warn("Auth not configured, using local auth state");
        return authState.hasAccount;
      }

      // Step 2: Try to get cached session with a short timeout
      // This prevents the auth guard from hanging on slow network
      try {
        const TIMEOUT_SENTINEL = Symbol('timeout');
        let timeoutId: ReturnType<typeof setTimeout>;

        const manager = await getAuthManager();
        const sessionPromise = manager.getCurrentSession();
        const timeoutPromise = new Promise<typeof TIMEOUT_SENTINEL>(
          (resolve) => {
            timeoutId = setTimeout(
              () => resolve(TIMEOUT_SENTINEL),
              2000,
            ); // 2 second timeout
          },
        );

        const result = await Promise.race([sessionPromise, timeoutPromise]);
        clearTimeout(timeoutId!); // ✅ Clean up the timer

        // If timed out, trust local storage — network may be slow
        if (result === TIMEOUT_SENTINEL) {
          logger.category('auth').warn("Session check timed out, trusting local auth state");
          return authState.hasAccount;
        }

        // If we got a session, verify it's confirmed
        if (isEmailConfirmed(result)) {
          return true;
        }

        // Session returned null (no session in Supabase cache) — stale local data
        // Clear the dead hasAccount flag so we don't keep bouncing around
        logger.category('auth').warn("No valid session found but hasAccount=true — clearing stale auth state");
        await this.setHasAccount(false);
        return false;
      } catch {
        // On any error, trust local storage
        return authState.hasAccount;
      }
    } catch (error) {
      logger.category('auth').error("Error checking authentication:", error);
      // On error, fall back to local auth state
      try {
        const authState = await this.getAuthState();
        return authState.hasAccount;
      } catch {
        return false;
      }
    }
  },

  // ==========================================
  // 🌍 WORLD ACCESS VERIFICATION - Lazy verification with cache-first approach
  // ==========================================
  async logout(): Promise<void> {
    try {
      logger.category('auth').info("🔓 Logging out...");

      // Sign out from auth-service if configured
      if (isBackendConfigured()) {
        try {
          const manager = await getAuthManager();
          await manager.confirmSignOut('auth-state-change');
          logger.category('auth').info("✅ Signed out from auth service");
        } catch (error) {
          logger.category('auth').error("Error signing out:", error);
        }
      }

      // Clear all user data per privacy policy (SENSITIVE and PII keys)
      await clearAllUserData();

      // Clear local auth state (includes all cache keys)
      await this.clearAuthState();

      // Reset theme to defaults (classic, dark mode) for next user
      const themeBackend = getPrivacyStorageBackend(
        STORAGE_KEYS.THEME_PREFERENCE,
      );
      const modeBackend = getPrivacyStorageBackend(STORAGE_KEYS.THEME_MODE);
      await Promise.all([
        themeBackend.setItem(STORAGE_KEYS.THEME_PREFERENCE, "classic"),
        modeBackend.setItem(STORAGE_KEYS.THEME_MODE, "dark"),
      ]);

      logger.category('auth').info("✅ Logout complete");
    } catch (error) {
      logger.category('auth').error("Error during logout:", error);
      // Don't throw - fail gracefully and ensure auth state is cleared
      try {
        await clearAllUserData();
        await this.clearAuthState();
      } catch (clearError) {
        logger.category('auth').error(
          "Failed to clear auth state during error recovery:",
          clearError,
        );
      }
    }
  },

  // ==========================================
  // 🌍 WORLD ACCESS VERIFICATION - Cache-first verification with updateStorageCache service
  // ==========================================
  /**
   * Verify world access against cache first, then updateStorageCache service for stale cache
   *
   * Flow:
   * 1. Check SecureStorage cache - instant
   * 2. Check cache age:
   *    - Fresh (<4 hours): Trust cache, let user in immediately (no database call)
   *    - Stale (4+ hours): Refresh via updateStorageCache.refreshAllWorldsCache() then check again
   * 3. updateStorageCache service handles the Supabase verification and cache updates
   * 4. Handle network errors gracefully (don't boot user on network fail)
   */
  async verifyWorldAccessWithDatabase(
    worldId: string,
    onAccessRevoked?: (reason: string) => void,
    options?: { forceFresh?: boolean },
  ): Promise<{
    hasAccess: boolean;
    fromCache: boolean;
    isVerifying: boolean;
  }> {
    logger.category('auth').info(`[VERIFY:START] Verifying world ${worldId}, forceFresh=${options?.forceFresh}`);

    // Cache freshness: uses shared classifyCacheAge for consistent freshness classification.
    // Fresh (<4h): trust cache. Stale (≥4h): refresh via updateStorageCache service.
    // Dead tier disabled (Infinity) — world access only needs fresh vs stale.
    const WORLD_ACCESS_FRESH_MS = 4 * 60 * 60 * 1000; // 4 hours
    const cacheKey = `world_access_${worldId}`;
    const metaKey = `world_access_meta_${worldId}`;

    try {
      // If forceFresh is true, skip cache and refresh from database
      if (options?.forceFresh) {
        logger.category('auth').info(`[VERIFY:FORCE] Force fresh check for world ${worldId}`);

        // Refresh all worlds cache (if one is stale, all are stale)
        const { updateStorageCache } =
          await import("../storage/sync/update-storage-cache");
        await updateStorageCache.refreshAllWorldsCache();

        // Now check cache - it's been refreshed
        const backend = getPrivacyStorageBackend(cacheKey);
        const freshCached = await backend.getJSON<boolean>(cacheKey);
        logger.category('auth').info(`[VERIFY:FORCE-RESULT] hasAccess=${freshCached}`);

        return {
          hasAccess: freshCached === true,
          fromCache: false,
          isVerifying: false,
        };
      }

      // Step 1: Check SecureStorage cache
      const backend = getPrivacyStorageBackend(cacheKey);
      const cached = await backend.getJSON<boolean>(cacheKey);
      const cacheMeta = await backend.getJSON<CacheMetadata>(metaKey);

      const cacheAge = cacheMeta ? Date.now() - cacheMeta.timestamp : Infinity;
      const freshness = classifyCacheAge(cacheAge, {
        freshThresholdMs: WORLD_ACCESS_FRESH_MS,
        deadThresholdMs: Infinity,
      });

      logger.category('auth').info(`[VERIFY:CACHE] world=${worldId}, hasCache=${cached !== null}, ageMs=${cacheAge}, freshness=${freshness}`);

      // Step 2: If cache is fresh AND exists, trust it
      if (freshness === "fresh" && cached !== null) {
        logger.category('auth').info(`[VERIFY:FRESH] Cache fresh for world ${worldId}, trusting cache, hasAccess=${cached}`);
        return {
          hasAccess: cached === true,
          fromCache: true,
          isVerifying: false,
        };
      }

      // Step 3: Cache is stale or missing - refresh all worlds then check again
      // If one world is stale, all worlds are stale - refresh everything at once
      logger.category('auth').info(`[VERIFY:STALE] Cache ${cached === null ? "missing" : "stale"}, refreshing all worlds from database`);

      // Refresh all worlds cache (userId from SecureStorage never stale)
      const { updateStorageCache } =
        await import("../storage/sync/update-storage-cache");
      await updateStorageCache.refreshAllWorldsCache();

      // Now check cache again - it's been refreshed
      const freshCached = await backend.getJSON<boolean>(cacheKey);
      logger.category('auth').info(`[VERIFY:FRESH-RESULT] hasAccess=${freshCached}`);

      return {
        hasAccess: freshCached === true,
        fromCache: false,
        isVerifying: false,
      };
    } catch (error) {
      logger.category('auth').error(`[VERIFY:ERROR] Cache check failed:`, error);
      // Fallback: refresh all worlds cache and try again
      try {
        const { updateStorageCache } =
          await import("../storage/sync/update-storage-cache");
        await updateStorageCache.refreshAllWorldsCache();

        const freshCached = await StorageManager.get<boolean>(cacheKey);
        return {
          hasAccess: freshCached === true,
          fromCache: false,
          isVerifying: false,
        };
      } catch (dbError) {
        logger.category('auth').error(`[VERIFY:FAIL] Database refresh also failed:`, dbError);
        // On complete failure, deny access for security
        return {
          hasAccess: false,
          fromCache: false,
          isVerifying: false,
        };
      }
    }
  },

  /**
   * Batch verify world access for multiple worlds efficiently
   * 
   * Instead of verifying each world individually (which can spawn N parallel refreshes),
   * do ONE bulk refresh upfront, then verify all worlds from the refreshed cache.
   * This prevents the thundering herd problem.
   * 
   * @param worldIds - World IDs to verify
   * @returns Object with results Map and deferred flag
   */
  async batchVerifyWorldAccess(
    worldIds: string[],
  ): Promise<{ results: Map<string, boolean>; deferred: boolean }> {
    logger.category('auth').info(`[BATCH-VERIFY] Starting batch verification for ${worldIds.length} worlds`);

    // Do ONE bulk refresh to get all world access flags at once
    const { updateStorageCache } =
      await import("../storage/sync/update-storage-cache");
    let refreshResult: any = null;
    try {
      refreshResult = await updateStorageCache.refreshAllWorldsCache();
    } catch (error) {
      logger.category('auth').warn("[BATCH-VERIFY] Bulk refresh failed, falling back to per-world verification", error);
      logger.category('database').warn("[BATCH-VERIFY] Bulk refresh failed (updateStorageCache.refreshAllWorldsCache), falling back to per-world verification", error);
      // Fall back to per-world verification if bulk fails
      const results = new Map<string, boolean>();
      for (const worldId of worldIds) {
        const result = await this.verifyWorldAccessWithDatabase(worldId);
        results.set(worldId, result.hasAccess);
      }
      return { results, deferred: false };
    }

    // If refresh returned null (session not ready), signal deferred.
    // Callers must NOT treat deferred results as verified 0-world state.
    // Screens should listen to auth state changes and re-verify once session is ready.
    if (refreshResult === null) {
      logger.category("auth").info(
        "[BATCH-VERIFY] Refresh deferred (session not ready), denying access until verified",
      );
      logger.category("database").info(
        "[BATCH-VERIFY] Refresh deferred (session not ready) — deferred=true",
      );
      const results = new Map<string, boolean>();
      // Deny access for all worlds until session is ready and we can verify
      for (const worldId of worldIds) {
        results.set(worldId, false); // Deny access until session is ready
      }
      return { results, deferred: true };
    }

    // Now check cache for each world locally (no DB calls needed)
    const results = new Map<string, boolean>();
    const backend = getPrivacyStorageBackend("world_access_temp");

    for (const worldId of worldIds) {
      const cacheKey = `world_access_${worldId}`;
      try {
        const cached = await backend.getJSON<boolean>(cacheKey);
        results.set(worldId, cached === true);
        logger.category('auth').debug(`[BATCH-VERIFY] ${worldId}=${cached === true}`);
      } catch (error) {
        logger.category('auth').error(`[BATCH-VERIFY] Failed to check cache for ${worldId}`, error);
        // If we can't read cache, deny access for security
        results.set(worldId, false);
      }
    }

    logger.category('auth').info(`[BATCH-VERIFY] Complete: ${results.size} worlds verified`);
    logger.category('database').info(`[BATCH-VERIFY] Complete: ${results.size} worlds verified`);
    return { results, deferred: false };
  },

  /**
   * Check world access in Supabase database
   * This is the "slow" source of truth
   */
  async checkWorldAccessInSupabase(
    worldId: string,
  ): Promise<{ hasAccess: boolean; reason?: string }> {
    try {
      if (!isBackendConfigured()) {
        logger.category('auth').warn("[VERIFY] Auth not configured, allowing access");
        return { hasAccess: true };
      }

      const userId = await this.getUserId();

      if (!userId) {
        return { hasAccess: false, reason: "Not authenticated" };
      }

      logger.category('auth').debug(`[VERIFY:DB] Checking world access - worldId=${worldId}, userId=${userId}`);

      // Use repository to check access (checks both owner and member status)
      try {
        const hasAccess = await getWorldAccessRepository().isUserInWorld(worldId, userId);
        logger.category('auth').debug(`[VERIFY:DB] isUserInWorld result - worldId=${worldId}, userId=${userId}, hasAccess=${hasAccess}`);
        if (hasAccess) {
          return { hasAccess: true };
        } else {
          return { hasAccess: false, reason: "Not a member of this world" };
        }
      } catch (error) {
        logger.category('auth').debug(`[VERIFY] World access check failed (database layer):`, error);
        throw error;
      }
    } catch (error) {
      logger.category('auth').error(`[VERIFY] Supabase query failed:`, error);
      throw error; // Let caller handle
    }
  },

  // ==========================================
  // 🧭 ROUTING DECISION - Determine where to send user
  // ==========================================
  async getRoutingDecision(): Promise<{
    routingDecision: "welcome" | "login" | "main" | "complete-profile";
    profileId: string | null;
  }> {
    try {
      logger.category("security").debug("Evaluating routing decision");

      // First, get local auth flag
      const authState = await this.getAuthState();
      logger
        .category("security")
        .debug("Local auth state", { hasAccount: authState.hasAccount });

      // If auth backend isn't configured, fall back to local state
      if (!isBackendConfigured()) {
        logger.category('auth').warn("Auth not configured - defaulting to welcome");
        // If no account flag, go to welcome (covers undefined, null, false)
        if (!authState.hasAccount) {
          return { routingDecision: "welcome", profileId: null };
        }
      }

      // Ask auth-manager for current session
      const manager = await getAuthManager();
      const session = await manager.getCurrentSession();

      // If there's a Supabase session, ensure local auth state is synced
      if (session && !authState.hasAccount) {
        logger.category('auth').info("🔄 [getRoutingDecision] Found Supabase session but local hasAccount=false, syncing...");
        await this.setHasAccount(true);
      }

      // Try to fetch the user profile once (may fail)
      let userProfile: any = null;
      try {
        userProfile = await getUserRepository().getCurrentUser();
      } catch (dbError) {
        logger.category('auth').debug("Database error checking profile:", dbError);
        // If DB fails, allow user to continue to main (graceful degradation)
        if (session)
          return {
            routingDecision: "main",
            profileId: userProfile?.id || null,
          };
        // If no session but we can't query profile:
        // - If user has account but no session, go to login (needs to re-auth)
        // - If no account, go to welcome (new user or logged out)
        return {
          routingDecision: authState.hasAccount ? "login" : "welcome",
          profileId: null,
        };
      }

      // If there is an active Supabase session
      if (session) {
        // Sanity-check profile identity: prefer auth_id match, fallback to id
        const matchesAuth =
          !!userProfile &&
          (userProfile.auth_id === session.user.id ||
            userProfile.id === session.user.id);

        // If profile missing or mismatch -> force complete-profile path
        if (!matchesAuth) {
          logger
            .category("security")
            .info("Routing to complete-profile: profile mismatch", {
              hasProfile: !!userProfile,
              profileId: userProfile?.id,
              sessionUserId: session.user.id,
            });
          return {
            routingDecision: "complete-profile",
            profileId: userProfile.id,
          };
        }

        // If username is missing or blank -> complete-profile
        if (!userProfile.username || userProfile.username.trim().length === 0) {
          logger
            .category("security")
            .info("Routing to complete-profile: missing username", {
              profileId: userProfile.id,
            });
          return {
            routingDecision: "complete-profile",
            profileId: userProfile.id,
          };
        }

        // Session and profile valid -> main
        logger
          .category("security")
          .debug("Routing to main: valid session and profile", {
            profileId: userProfile.id,
          });
        return { routingDecision: "main", profileId: userProfile.id };
      }

      // No active session
      if (authState.hasAccount) {
        // User has an account but no active session -> prompt login
        logger
          .category("security")
          .debug("Routing to login: has account but no session");
        return { routingDecision: "login", profileId: null };
      }

      // No account and no session -> welcome
      // This covers: hasAccount=false/null/undefined (all falsy states)
      logger
        .category("security")
        .debug("Routing to welcome: no account or session");
      return { routingDecision: "welcome", profileId: null };
    } catch (error) {
      logger.category('auth').error("Error determining routing decision:", error);
      // On any error, default to welcome (safest redirect)
      return { routingDecision: "welcome", profileId: null };
    }
  },
};
