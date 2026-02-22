import { type AuthProvider } from "../services";
import {
  clearAllUserData,
  getPrivacyStorageBackend,
  SecureStorage,
  STORAGE_KEYS,
} from "../storage";
import { logger } from "../utils/logger";

// Session schema version for future migrations
const AUTH_SESSION_VERSION = 1;

// Injected auth provider (set via configure())
let authProvider: AuthProvider | null = null;

// Cache dynamic imports to prevent re-importing modules on every auth check
let supabaseCache: any = null;
let isSupabaseConfiguredCache: any = null;
let usersDBCache: any = null;
let worldsDBCache: any = null;

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
  /**
   * Configure the auth provider to use for auth operations.
   * Call this once during app bootstrap before any auth methods are invoked.
   *
   * @param provider - The AuthProvider instance to use (Supabase by default)
   * @param options - Optional configuration (reserved for future use)
   */
  configure(provider: AuthProvider, options?: any): void {
    if (!provider) {
      logger.error('auth', 'AuthStateManager.configure: provider is null/undefined');
      throw new Error('AuthStateManager.configure: provider is required');
    }
    authProvider = provider;
    logger.info('auth', 'AuthStateManager configured with provider', {
      providerType: provider.constructor.name,
    });
  },

  /**
   * Get the configured auth provider.
   * Throws if configure() has not been called yet.
   * @internal
   */
  getProvider(): AuthProvider {
    if (!authProvider) {
      logger.error('auth', 'AuthStateManager.getProvider: provider not configured');
      throw new Error(
        'Auth provider not configured. Call AuthStateManager.configure() during app bootstrap.'
      );
    }
    return authProvider;
  },

  // Save the Supabase session to encrypted storage (web platform workaround)
  // Since web has persistSession=false for security, we manually save/restore the session
  async saveAuthSession(session: any): Promise<void> {
    try {
      if (!session) {
        logger.debug("auth", "saveAuthSession: null session, clearing");
        await this.clearAuthSession();
        return;
      }

      logger.info("auth", "📝 Saving auth session (SIGNED_IN event)", {
        auth_id: session.user?.id,
        hasAccessToken: !!session.access_token,
        hasRefreshToken: !!session.refresh_token,
        email: session.user?.email,
      });

      const key = STORAGE_KEYS.AUTH_SESSION;
      logger.debug("auth", "📍 Getting storage backend for key", { key });
      
      const backend = getPrivacyStorageBackend(key);
      if (!backend) {
        logger.error("auth", "❌ Failed to get storage backend - returned null");
        return;
      }
      
      // Save only the essential session data needed to restore
      const sessionData = {
        version: AUTH_SESSION_VERSION,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        expires_in: session.expires_in,
        token_type: session.token_type,
        user: {
          id: session.user?.id,
          email: session.user?.email,
        },
      };
      
      logger.debug("auth", "💾 Calling backend.setJSON...", { keyLength: key.length, dataSize: JSON.stringify(sessionData).length });
      await backend.setJSON(key, sessionData);
      
      logger.info(
        "auth",
        "✅ Successfully saved AUTH_SESSION to encrypted storage",
        { auth_id: session.user?.id },
      );
    } catch (error) {
      logger.error("auth", "❌ ERROR in saveAuthSession:", {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
    }
  },

  // Restore the session from encrypted storage via the auth provider (provider-agnostic)
  async restoreAuthSession(): Promise<void> {
    try {
      const key = STORAGE_KEYS.AUTH_SESSION;
      const backend = getPrivacyStorageBackend(key);
      const sessionData = await backend.getJSON<any>(key);

      if (!sessionData) {
        logger.debug("auth", "🔍 No AUTH_SESSION key in storage to restore");
        return;
      }

      // Check session schema version for future migrations
      const sessionVersion = sessionData.version || 0;
      if (sessionVersion !== AUTH_SESSION_VERSION) {
        logger.warn(
          "auth",
          `Session schema version mismatch (stored: ${sessionVersion}, current: ${AUTH_SESSION_VERSION}). Clearing stale session.`
        );
        // Clear incompatible session; user will need to re-authenticate
        await this.clearAuthSession();
        return;
      }

      logger.info("auth", "🔄 Restoring auth session from storage", {
        auth_id: sessionData.user?.id,
        hasAccessToken: !!sessionData.access_token,
        version: sessionVersion,
      });

      // Only restore on web platform (mobile uses provider's built-in async storage)
      if (typeof window === "undefined") {
        logger.debug(
          "auth",
          "Skipping manual session restore on mobile (uses platform-native storage)"
        );
        return;
      }

      // Get the configured auth provider and attempt to restore session
      const provider = this.getProvider();
      const success = await provider.restoreSession(sessionData);

      if (!success) {
        logger.warn(
          "auth",
          "❌ Auth provider failed to restore session (likely expired or invalid)"
        );
        // If restoration fails (e.g., token expired), clear the stale session
        await this.clearAuthSession();
        return;
      }

      logger.info(
        "auth",
        "✅ AUTH_SESSION restored! User should now be authenticated",
        { auth_id: sessionData.user?.id }
      );
    } catch (error) {
      logger.error("auth", "Error restoring auth session:", error);
      // Clear stale session on error
      try {
        await this.clearAuthSession();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_) {
        // Ignore errors during cleanup
      }
    }
  },

  // Clear the saved auth session
  async clearAuthSession(): Promise<void> {
    try {
      const key = STORAGE_KEYS.AUTH_SESSION;
      const backend = getPrivacyStorageBackend(key);
      await backend.removeItem(key);
      logger.debug("auth", "Cleared auth session from storage");
    } catch (error) {
      logger.error("auth", "Error clearing auth session:", error);
    }
  },

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
        await SecureStorage.getJSON<AuthState>(storageKey);
      // Explicitly handle all falsy cases: null, undefined, or false
      // All of these should result in hasAccount: false for consistent auth routing
      return { hasAccount: authState?.hasAccount === true };
    } catch (error) {
      logger.error("auth", "Error getting auth state:", error);
      return { hasAccount: false };
    }
  },

  // Set user has created/logged into account
  async setHasAccount(hasAccount: boolean): Promise<void> {
    try {
      const newState: AuthState = { hasAccount };
      const storageKey = STORAGE_KEYS.HAS_ACCOUNT;
      const backend = getPrivacyStorageBackend(storageKey);
      await backend.setJSON(storageKey, newState);
    } catch (error) {
      logger.error("auth", "Error setting hasAccount:", error);
    }
  },

  // Store session information or mark that user has an account when a session exists
  async setSession(session: any): Promise<void> {
    try {
      logger.info("auth", "🔐 setSession called with:", {
        hasSession: !!session,
        hasUser: !!session?.user,
        hasAccessToken: !!session?.access_token,
        hasRefreshToken: !!session?.refresh_token,
        auth_id: session?.user?.id,
        email: session?.user?.email,
      });

      if (!session) {
        logger.warn("auth", "⚠️ setSession received null/undefined session - not saving");
        return;
      }

      // Update auth state
      await this.setHasAccount(true);

      // Save the actual Supabase session (critical for web platform!)
      // This ensures the session persists across app restarts
      await this.saveAuthSession(session);

      // Optionally cache minimal session info (privacy-routed)
      if (session?.user?.email) {
        try {
          const key = STORAGE_KEYS.SESSION_USER_EMAIL;
          const backend = getPrivacyStorageBackend(key);
          await backend.setItem(key, session.user.email);
        } catch (error) {
          logger.error("auth", "Error caching session email:", error);
        }
      }
    } catch (error) {
      logger.error("auth", "Error saving auth state:", error);
    }
  },

  // Clear all auth state (logout)
  async clearAuthState(): Promise<void> {
    try {
      // Clear the saved auth session first
      // This ensures Supabase and storage are in sync
      await this.clearAuthSession();

      // Clear query cache (all user-specific cached queries)
      const { QueryCache } = await import("../cache/query-cache");
      await QueryCache.clearAll();

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
        const allStorageKeys = await SecureStorage.getAllKeys();
        const worldAccessKeys = allStorageKeys.filter(
          (key) =>
            key.startsWith("world_access_") ||
            key.startsWith("world_access_meta_"),
        );
        await Promise.all(
          worldAccessKeys.map((key) => SecureStorage.removeItem(key)),
        );

        if (worldAccessKeys.length > 0) {
          logger.debug(
            "auth",
            `Cleared ${worldAccessKeys.length} world access cache entries`,
          );
        }
      } catch (error) {
        logger.warn(
          "auth",
          "Could not clear world access cache entries:",
          error,
        );
        // Continue even if this fails - world access cache is non-critical
      }

      logger.debug(
        "auth",
        "Cleared all auth storage keys and user-specific caches",
      );
    } catch (error) {
      logger.error("auth", "Error clearing auth state:", error);
    }
  },

  // Get stored user ID (convenience method)
  async getUserId(): Promise<string | undefined> {
    try {
      const backend = getPrivacyStorageBackend(STORAGE_KEYS.USER_DATA);
      const userData = await backend.getJSON<{ id: string }>(
        STORAGE_KEYS.USER_DATA,
      );
      return userData?.id;
    } catch (error) {
      logger.error("auth", "Error getting user ID:", error);
      return undefined;
    }
  },

  // Get stored user data (full profile)
  async getUserData(): Promise<any> {
    try {
      const backend = getPrivacyStorageBackend(STORAGE_KEYS.USER_DATA);
      const userData = await backend.getJSON(STORAGE_KEYS.USER_DATA);
      
      if (userData) {
        logger.debug("auth", "📖 getUserData returning from storage:", {
          id: userData.id,
          id_length: userData.id?.length,
          auth_id: userData.auth_id,
          auth_id_length: userData.auth_id?.length,
          username: userData.username,
          isFullProfile: userData.id && userData.id.length === 36,
        });
      } else {
        logger.debug("auth", "📖 getUserData: storage is empty (no user data)");
      }
      
      return userData;
    } catch (error) {
      logger.error("auth", "Error getting user data:", error);
      return undefined;
    }
  },

  // Save user data to storage
  async saveUserData(userData: any): Promise<void> {
    try {
      if (!userData) {
        logger.warn("auth", "saveUserData: received null/undefined userData");
        return;
      }

      logger.info("auth", "💾 Saving user data to storage", {
        id: userData.id,
        auth_id: userData.auth_id,
        username: userData.username,
        is_admin: userData.is_admin,
        idLength: userData.id?.length,
      });

      const backend = getPrivacyStorageBackend(STORAGE_KEYS.USER_DATA);
      await backend.setJSON(STORAGE_KEYS.USER_DATA, userData);
      
      logger.info("auth", "✅ User data saved successfully", {
        id: userData.id,
      });
    } catch (error) {
      logger.error("auth", "Error saving user data:", error);
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

      // Use cached supabase import to avoid re-loading modules
      if (!supabaseCache) {
        const imported = await import("../database/supabase");
        supabaseCache = imported.supabase;
        isSupabaseConfiguredCache = imported.isSupabaseConfigured;
      }

      // If Supabase isn't configured (like on GitHub Pages without env vars),
      // fall back to local auth state
      if (!isSupabaseConfiguredCache()) {
        logger.warn("auth", "Supabase not configured, using local auth state");
        return authState.hasAccount;
      }

      // Step 2: Try to get cached session with a short timeout
      // This prevents the auth guard from hanging on slow network
      try {
        let timeoutId: ReturnType<typeof setTimeout>;

        const sessionPromise = supabaseCache.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null } }>(
          (resolve) => {
            timeoutId = setTimeout(
              () => resolve({ data: { session: null } }),
              2000,
            ); // 2 second timeout
          },
        );

        const {
          data: { session },
        } = await Promise.race([sessionPromise, timeoutPromise]);
        clearTimeout(timeoutId!); // ✅ Clean up the timer

        // If we got a session, verify it's confirmed
        if (session?.user && session.user.email_confirmed_at) {
          return true;
        }

        // If session check timed out or returned null, trust local storage
        // The background session restore will update this later
        return authState.hasAccount;
      } catch {
        // On any error, trust local storage
        return authState.hasAccount;
      }
    } catch (error) {
      logger.error("auth", "Error checking authentication:", error);
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
      logger.info("auth", "🔓 Logging out...");

      // Use cached supabase import
      if (!supabaseCache) {
        const imported = await import("../database/supabase");
        supabaseCache = imported.supabase;
        isSupabaseConfiguredCache = imported.isSupabaseConfigured;
      }

      // Sign out from Supabase if configured
      if (isSupabaseConfiguredCache()) {
        try {
          await supabaseCache.auth.signOut();
          logger.info("auth", "✅ Signed out from Supabase");
        } catch (error) {
          logger.error("auth", "Error signing out from Supabase:", error);
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

      logger.info("auth", "✅ Logout complete");
    } catch (error) {
      logger.error("auth", "Error during logout:", error);
      // Don't throw - fail gracefully and ensure auth state is cleared
      try {
        await clearAllUserData();
        await this.clearAuthState();
      } catch (clearError) {
        logger.error(
          "auth",
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
    logger.info(
      "auth",
      `[VERIFY:START] Verifying world ${worldId}, forceFresh=${options?.forceFresh}`,
    );

    // Cache freshness window: only trust cache younger than 4 hours
    // After 4 hours, always refresh via updateStorageCache service to catch permission changes
    const CACHE_FRESH_THRESHOLD = 4 * 60 * 60 * 1000; // 4 hours
    const cacheKey = `world_access_${worldId}`;
    const metaKey = `world_access_meta_${worldId}`;

    try {
      // If forceFresh is true, skip cache and refresh from database
      if (options?.forceFresh) {
        logger.info(
          "auth",
          `[VERIFY:FORCE] Force fresh check for world ${worldId}`,
        );

        // Refresh all worlds cache (if one is stale, all are stale)
        const { updateStorageCache } =
          await import("../storage/update-storage-cache");
        await updateStorageCache.refreshAllWorldsCache();

        // Now check cache - it's been refreshed
        const backend = getPrivacyStorageBackend(cacheKey);
        const freshCached = await backend.getJSON<boolean>(cacheKey);
        logger.info("auth", `[VERIFY:FORCE-RESULT] hasAccess=${freshCached}`);

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
      const isCacheFresh = cacheAge < CACHE_FRESH_THRESHOLD;

      logger.info(
        "auth",
        `[VERIFY:CACHE] world=${worldId}, hasCache=${cached !== null}, ageMs=${cacheAge}, isCacheFresh=${isCacheFresh}`,
      );

      // Step 2: If cache is fresh AND exists, trust it
      if (isCacheFresh && cached !== null) {
        logger.info(
          "auth",
          `[VERIFY:FRESH] Cache fresh for world ${worldId}, trusting cache, hasAccess=${cached}`,
        );
        return {
          hasAccess: cached === true,
          fromCache: true,
          isVerifying: false,
        };
      }

      // Step 3: Cache is stale or missing - refresh all worlds then check again
      // If one world is stale, all worlds are stale - refresh everything at once
      logger.info(
        "auth",
        `[VERIFY:STALE] Cache ${cached === null ? "missing" : "stale"}, refreshing all worlds from database`,
      );

      // Refresh all worlds cache (userId from SecureStorage never stale)
      const { updateStorageCache } =
        await import("../storage/update-storage-cache");
      await updateStorageCache.refreshAllWorldsCache();

      // Now check cache again - it's been refreshed
      const freshCached = await backend.getJSON<boolean>(cacheKey);
      logger.info("auth", `[VERIFY:FRESH-RESULT] hasAccess=${freshCached}`);

      return {
        hasAccess: freshCached === true,
        fromCache: false,
        isVerifying: false,
      };
    } catch (error) {
      logger.error("auth", `[VERIFY:ERROR] Cache check failed:`, error);
      // Fallback: refresh all worlds cache and try again
      try {
        const { updateStorageCache } =
          await import("../storage/update-storage-cache");
        await updateStorageCache.refreshAllWorldsCache();

        const freshCached = await SecureStorage.getJSON<boolean>(cacheKey);
        return {
          hasAccess: freshCached === true,
          fromCache: false,
          isVerifying: false,
        };
      } catch (dbError) {
        logger.error(
          "auth",
          `[VERIFY:FAIL] Database refresh also failed:`,
          dbError,
        );
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
   * @returns Map of worldId => hasAccess
   */
  async batchVerifyWorldAccess(
    worldIds: string[],
  ): Promise<Map<string, boolean>> {
    logger.info(
      "auth",
      `[BATCH-VERIFY] Starting batch verification for ${worldIds.length} worlds`,
    );

    // Do ONE bulk refresh to get all world access flags at once
    const { updateStorageCache } =
      await import("../storage/update-storage-cache");
    let refreshResult: any = null;
    try {
      refreshResult = await updateStorageCache.refreshAllWorldsCache();
    } catch (error) {
      logger.warn(
        "auth",
        "[BATCH-VERIFY] Bulk refresh failed, falling back to per-world verification",
        error,
      );
      // Fall back to per-world verification if bulk fails
      const results = new Map<string, boolean>();
      for (const worldId of worldIds) {
        const result = await this.verifyWorldAccessWithDatabase(worldId);
        results.set(worldId, result.hasAccess);
      }
      return results;
    }

    // If refresh returned null (session not ready), return false for all worlds
    // This prevents granting access to unauthenticated users during app startup.
    // Screens should listen to auth state changes and re-verify once session is ready.
    if (refreshResult === null) {
      logger.info(
        "auth",
        "[BATCH-VERIFY] Refresh deferred (session not ready), denying access until verified",
      );
      const results = new Map<string, boolean>();
      // Deny access for all worlds until session is ready and we can verify
      for (const worldId of worldIds) {
        results.set(worldId, false); // Deny access until session is ready
      }
      return results;
    }

    // Now check cache for each world locally (no DB calls needed)
    const results = new Map<string, boolean>();
    const backend = getPrivacyStorageBackend("world_access_temp");

    for (const worldId of worldIds) {
      const cacheKey = `world_access_${worldId}`;
      try {
        const cached = await backend.getJSON<boolean>(cacheKey);
        results.set(worldId, cached === true);
        logger.debug("auth", `[BATCH-VERIFY] ${worldId}=${cached === true}`);
      } catch (error) {
        logger.error(
          "auth",
          `[BATCH-VERIFY] Failed to check cache for ${worldId}`,
          error,
        );
        // If we can't read cache, deny access for security
        results.set(worldId, false);
      }
    }

    logger.info(
      "auth",
      `[BATCH-VERIFY] Complete: ${results.size} worlds verified`,
    );
    return results;
  },

  /**
   * Check world access in Supabase database
   * This is the "slow" source of truth
   */
  async checkWorldAccessInSupabase(
    worldId: string,
  ): Promise<{ hasAccess: boolean; reason?: string }> {
    try {
      if (!isSupabaseConfiguredCache) {
        const imported = await import("../database/supabase");
        isSupabaseConfiguredCache = imported.isSupabaseConfigured;
        supabaseCache = imported.supabase;
      }

      if (!isSupabaseConfiguredCache()) {
        logger.warn(
          "auth",
          "[VERIFY] Supabase not configured, allowing access",
        );
        return { hasAccess: true };
      }

      const userId = await this.getUserId();

      if (!userId) {
        return { hasAccess: false, reason: "Not authenticated" };
      }

      logger.debug(
        "auth",
        `[VERIFY:DB] Checking world access - worldId=${worldId}, userId=${userId}`,
      );

      // Use worldsDB helper to check access (checks both owner and member status)
      if (!worldsDBCache) {
        const imported = await import("../database/worlds");
        worldsDBCache = imported.worldsDB;
      }

      try {
        const hasAccess = await worldsDBCache.isUserInWorld(worldId, userId);
        logger.debug(
          "auth",
          `[VERIFY:DB] isUserInWorld result - worldId=${worldId}, userId=${userId}, hasAccess=${hasAccess}`,
        );
        if (hasAccess) {
          return { hasAccess: true };
        } else {
          return { hasAccess: false, reason: "Not a member of this world" };
        }
      } catch (error) {
        logger.debug("auth", `[VERIFY] World access check failed (database layer):`, error);
        throw error;
      }
    } catch (error) {
      logger.error("auth", `[VERIFY] Supabase query failed:`, error);
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

      // Use cached supabase import to avoid re-loading modules
      if (!supabaseCache) {
        const imported = await import("../database/supabase");
        supabaseCache = imported.supabase;
        isSupabaseConfiguredCache = imported.isSupabaseConfigured;
      }

      // If Supabase isn't configured, fall back to local state
      if (!isSupabaseConfiguredCache()) {
        logger.warn("auth", "Supabase not configured - defaulting to welcome");
        // If no account flag, go to welcome (covers undefined, null, false)
        if (!authState.hasAccount) {
          return { routingDecision: "welcome", profileId: null };
        }
      }

      // Ask Supabase for an active session
      const {
        data: { session },
      } = await supabaseCache.auth.getSession();

      // If there's a Supabase session, ensure local auth state is synced
      if (session && !authState.hasAccount) {
        logger.info(
          "auth",
          "🔄 [getRoutingDecision] Found Supabase session but local hasAccount=false, syncing...",
        );
        await this.setHasAccount(true);
      }

      // Try to fetch the user profile once (may fail)
      let userProfile: any = null;
      try {
        // Use cached usersDB import
        if (!usersDBCache) {
          const imported = await import("../database/users");
          usersDBCache = imported.usersDB;
        }
        userProfile = await usersDBCache.getCurrentUser();
      } catch (dbError) {
        logger.debug("auth", "Database error checking profile:", dbError);
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
      logger.error("auth", "Error determining routing decision:", error);
      // On any error, default to welcome (safest redirect)
      return { routingDecision: "welcome", profileId: null };
    }
  },
};
