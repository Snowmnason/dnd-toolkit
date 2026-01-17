import { SecureStorage, STORAGE_KEYS } from "../storage";
import { logger } from "../utils/logger";

// Cache dynamic imports to prevent re-importing modules on every auth check
let supabaseCache: any = null;
let isSupabaseConfiguredCache: any = null;
let usersDBCache: any = null;

export interface SupabaseAuthState {
  hasAccount: boolean;
}

export interface CacheMetadata {
  timestamp: number; // When cache was last updated
  source: "supabase" | "local"; // Where data came from
}

export const AuthStateManager = {
  // Get current auth state
  // IMPORTANT: Always returns an object with hasAccount as a boolean (never null/undefined)
  // - undefined/first init → hasAccount: false (go to welcome)
  // - null/deleted → hasAccount: false (go to welcome)
  // - false/logout → hasAccount: false (go to welcome)
  // - true/logged in → hasAccount: true (continue)
  async getAuthState(): Promise<SupabaseAuthState> {
    try {
      const storageKey = STORAGE_KEYS.HAS_ACCOUNT;
      const authState =
        await SecureStorage.getJSON<SupabaseAuthState>(storageKey);
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
      const newState: SupabaseAuthState = { hasAccount };
      const storageKey = STORAGE_KEYS.HAS_ACCOUNT;
      await SecureStorage.setJSON(storageKey, newState);
    } catch (error) {
      logger.error("auth", "Error setting hasAccount:", error);
    }
  },

  // Store session information or mark that user has an account when a session exists
  async setSession(session: any): Promise<void> {
    try {
      // Update auth state
      await this.setHasAccount(true);

      // Optionally cache minimal session info (encrypted via SecureStorage)
      if (session?.user?.email) {
        try {
          const key = "dnd_session_user_email";
          await SecureStorage.setItem(key, session.user.email);
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
        SecureStorage.removeItem(STORAGE_KEYS.USER_DATA),
        SecureStorage.removeItem(STORAGE_KEYS.CONNECTED_WORLDS),
        SecureStorage.setItem(STORAGE_KEYS.LAST_LOGGED_IN, ""), // Explicitly clear (empty string fails falsy checks)
        SecureStorage.removeItem("dnd_session_user_email"), // Session email cache
      ]);

      // Clear world access cache entries (pattern-based)
      // These keys follow patterns: world_access_* and world_access_meta_*
      try {
        const allStorageKeys = await SecureStorage.getAllKeys();
        const worldAccessKeys = allStorageKeys.filter(
          (key) =>
            key.startsWith("world_access_") ||
            key.startsWith("world_access_meta_")
        );
        await Promise.all(
          worldAccessKeys.map((key) => SecureStorage.removeItem(key))
        );

        if (worldAccessKeys.length > 0) {
          logger.debug(
            "auth",
            `Cleared ${worldAccessKeys.length} world access cache entries`
          );
        }
      } catch (error) {
        logger.warn(
          "auth",
          "Could not clear world access cache entries:",
          error
        );
        // Continue even if this fails - world access cache is non-critical
      }

      logger.debug(
        "auth",
        "Cleared all auth storage keys and user-specific caches"
      );
    } catch (error) {
      logger.error("auth", "Error clearing auth state:", error);
    }
  },

  // Get stored user ID (convenience method)
  async getUserId(): Promise<string | undefined> {
    try {
      const userData = await SecureStorage.getJSON<{ id: string }>(
        STORAGE_KEYS.USER_DATA
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
      const userData = await SecureStorage.getJSON(STORAGE_KEYS.USER_DATA);
      return userData;
    } catch (error) {
      logger.error("auth", "Error getting user data:", error);
      return undefined;
    }
  },

  // Save user data to storage
  async saveUserData(userData: any): Promise<void> {
    try {
      await SecureStorage.setJSON(STORAGE_KEYS.USER_DATA, userData);
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
              2000
            ); // 2 second timeout
          }
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

      // Clear local auth state (includes all cache keys)
      await this.clearAuthState();
      logger.info("auth", "✅ Logout complete");
    } catch (error) {
      logger.error("auth", "Error during logout:", error);
      // Don't throw - fail gracefully and ensure auth state is cleared
      try {
        await this.clearAuthState();
      } catch (clearError) {
        logger.error(
          "auth",
          "Failed to clear auth state during error recovery:",
          clearError
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
    options?: { forceFresh?: boolean }
  ): Promise<{
    hasAccess: boolean;
    fromCache: boolean;
    isVerifying: boolean;
  }> {
    logger.info(
      "auth",
      `[VERIFY:START] Verifying world ${worldId}, forceFresh=${options?.forceFresh}`
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
          `[VERIFY:FORCE] Force fresh check for world ${worldId}`
        );

        // Refresh all worlds cache (if one is stale, all are stale)
        const { updateStorageCache } =
          await import("../storage/update-storage-cache");
        await updateStorageCache.refreshAllWorldsCache();

        // Now check cache - it's been refreshed
        const freshCached = await SecureStorage.getJSON<boolean>(cacheKey);
        logger.info("auth", `[VERIFY:FORCE-RESULT] hasAccess=${freshCached}`);

        return {
          hasAccess: freshCached === true,
          fromCache: false,
          isVerifying: false,
        };
      }

      // Step 1: Check SecureStorage cache
      const cached = await SecureStorage.getJSON<boolean>(cacheKey);
      const cacheMeta = await SecureStorage.getJSON<CacheMetadata>(metaKey);

      const cacheAge = cacheMeta ? Date.now() - cacheMeta.timestamp : Infinity;
      const isCacheFresh = cacheAge < CACHE_FRESH_THRESHOLD;

      logger.info(
        "auth",
        `[VERIFY:CACHE] world=${worldId}, hasCache=${cached !== null}, ageMs=${cacheAge}, isCacheFresh=${isCacheFresh}`
      );

      // Step 2: If cache is fresh AND exists, trust it
      if (isCacheFresh && cached !== null) {
        logger.info(
          "auth",
          `[VERIFY:FRESH] Cache fresh for world ${worldId}, trusting cache, hasAccess=${cached}`
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
        `[VERIFY:STALE] Cache ${cached === null ? "missing" : "stale"}, refreshing all worlds from database`
      );

      // Refresh all worlds cache (userId from SecureStorage never stale)
      const { updateStorageCache } =
        await import("../storage/update-storage-cache");
      await updateStorageCache.refreshAllWorldsCache();

      // Now check cache again - it's been refreshed
      const freshCached = await SecureStorage.getJSON<boolean>(cacheKey);
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
          dbError
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
   * Check world access in Supabase database
   * This is the "slow" source of truth
   */
  async checkWorldAccessInSupabase(
    worldId: string
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
          "[VERIFY] Supabase not configured, allowing access"
        );
        return { hasAccess: true };
      }

      const supabase = supabaseCache;
      const userId = await this.getUserId();

      if (!userId) {
        return { hasAccess: false, reason: "Not authenticated" };
      }

      // Query world_access table (the actual table in Supabase)
      // This is the slow database call
      const { data, error } = await supabase
        .from("world_access") // Correct table name
        .select("id")
        .eq("world_id", worldId)
        .eq("user_id", userId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // No row found - user not a member
          return { hasAccess: false, reason: "Not a member of this world" };
        }
        throw error;
      }

      // User is a member
      logger.debug("auth", `[VERIFY] Supabase confirmed access:`, data);
      return { hasAccess: true };
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
          "🔄 [getRoutingDecision] Found Supabase session but local hasAccount=false, syncing..."
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
