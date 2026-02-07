/**
 * Feature Flags Manager
 *
 * Manages runtime feature flags and premium entitlements with proper priority:
 * 1. User-specific overrides (admin testing)
 * 2. Server values (source of truth)
 * 3. Hardcoded fallback (offline/error scenarios)
 *
 * **Feature Flags:**
 * - Fetched ONCE at app startup
 * - Server values OVERWRITE hardcoded config
 * - Used throughout app lifecycle
 * - Offline: Use last startup values
 *
 * **Entitlements:**
 * - Fetched FRESH on each check
 * - Real-time verification
 * - Offline: Use last known values
 */

import { getAppConfig, isDevelopment } from "@/lib/config/loader";
import { fetchEntitlementsByUserId } from "@/lib/database/entitlements";
import { FeatureFlagOverrideRow } from "@/lib/database/feature-flag-overrides";
import { SecureStorage, STORAGE_KEYS } from "@/lib/storage";
import { logger } from "@/lib/utils/logger";
import { isInRolloutMemoized } from "./rollout";

// ==========================================
// Types
// ==========================================

export interface FeatureFlagState {
  enabled: boolean;
  kind?: string;
  description?: string;
  source: "server" | "hardcoded" | "override";
}

export interface EntitlementState {
  granted: boolean;
  expiresAt?: string | null;
  source: "server" | "cache" | "override";
  lastChecked: number;
}

/**
 * Cached entitlement from Edge Function bootstrap or Realtime update
 * (mirrors EntitlementRow from supabase/functions/get_feature_flags/types.ts)
 */
export interface CachedEntitlement {
  id: string;
  user_id: string;
  key: string;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

/**
 * Cached feature flag row from Edge Function
 * (mirrors FeatureFlagRow from supabase/functions/get_feature_flags/types.ts)
 */
export interface CachedFeatureFlag {
  flag_name: string;
  enabled: boolean;
  kind: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Cached rollout configuration row from Edge Function
 * (mirrors RolloutConfigRow from supabase/functions/get_feature_flags/types.ts)
 */
export interface CachedRolloutConfig {
  percentage: number; // 0-100
  seed?: string; // Optional seed for rebalancing
}

/**
 * Typed response from get_feature_flags Edge Function
 * (mirrors GetFeatureFlagsResponse from supabase/functions/get_feature_flags/types.ts)
 */
export interface GetFeatureFlagsResponse {
  flags: CachedFeatureFlag[];
  entitlements: CachedEntitlement[];
  overrides: FeatureFlagOverrideRow[];
  rollouts: Record<string, CachedRolloutConfig>; // NEW: rollout config by flag name
  fetchedAt: number;
  version: "v1";
}

export type FlagsSubscriber = (flags: Record<string, FeatureFlagState>) => void;

// ==========================================
// Configuration
// ==========================================

const OVERRIDE_CACHE_KEY_PREFIX = "feature_flag_override:";

/**
 * Get clock skew tolerance from config (default: 60 seconds)
 */
function getClockSkewToleranceMs(): number {
  const config = getAppConfig();
  return config.remoteConfig?.clockSkewToleranceMs || 60 * 1000;
}

// ==========================================
// Feature Flags Manager
// ==========================================

class FeatureFlagsManagerClass {
  private supabaseClient: any = null;
  private currentFlags: Map<string, FeatureFlagState> = new Map(); // Use Map for safe access
  private userOverrides: Map<string, boolean> = new Map(); // Admin testing overrides (local)
  private remoteOverrides: Map<string, FeatureFlagOverrideRow> = new Map(); // Remote server overrides (per-user)
  private cachedEntitlements: Map<string, CachedEntitlement> = new Map(); // Cached from bootstrap + Realtime
  private cachedRollouts: Map<string, CachedRolloutConfig> = new Map(); // NEW: Rollout config for percentage-based rollouts
  private subscribers: Set<FlagsSubscriber> = new Set();
  private bootstrapped = false;
  private userId: string | null = null;
  private realtimeSubscriptions: Map<string, any> = new Map(); // Track Realtime channel subscriptions

  /**
   * Initialize with Supabase client and user ID
   * Called during app kernel bootstrap
   */
  async initialize(supabaseClient: any, userId?: string): Promise<void> {
    this.supabaseClient = supabaseClient;
    this.userId = userId || null;
    logger.debug("feature_flags", "FeatureFlagsManager initialized", {
      userId,
    });
  }

  /**
   * Invoke get_feature_flags Edge Function to fetch consolidated data
   * Returns flags, entitlements, and overrides in a single request
   *
   * Phase 1b refactoring: Consolidates three direct queries into one Edge Function call
   */
  private async invokeGetFeatureFlagsFunction(): Promise<GetFeatureFlagsResponse | null> {
    try {
      if (!this.supabaseClient) {
        throw new Error("Supabase client not initialized");
      }

      logger.debug("feature_flags", "Invoking get_feature_flags Edge Function");

      const response = await this.supabaseClient.functions.invoke(
        "get_feature_flags",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (response.error) {
        throw new Error(`Edge Function error: ${response.error.message}`);
      }

      logger.debug("feature_flags", "Edge Function response received", {
        flagCount: response.data?.flags?.length || 0,
        entitlementCount: response.data?.entitlements?.length || 0,
        overrideCount: response.data?.overrides?.length || 0,
      });

      return response.data;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.warn("feature_flags", "Failed to invoke Edge Function", errorMsg);
      return null;
    }
  }

  /**
   * Bootstrap feature flags and remote overrides from server (called ONCE at app startup)
   * In development: Uses local config only (no remote fetch)
   * In production: Server values OVERWRITE hardcoded config, with remote overrides for QA
   * Remote overrides take precedence over flags
   *
   * Priority for flags:
   * 1. Remote override (per-user, admin-controlled - production only)
   * 2. Server values (production) OR Local config (development)
   * 3. Last known values (offline)
   * 4. Hardcoded fallback
   */
  async bootstrapFlags(): Promise<void> {
    if (this.bootstrapped) {
      logger.debug("feature_flags", "Already bootstrapped, skipping");
      return;
    }

    const isDev = isDevelopment();

    if (isDev) {
      // Development: Use local config only, no remote fetch
      logger.info("feature_flags", "Development mode: using local config only");
      this.loadHardcodedFlags();
      this.bootstrapped = true;
      this.notifySubscribers(this.currentFlags);
      return;
    }

    // Production: Fetch from server via Edge Function
    logger.info("feature_flags", "Bootstrapping feature flags from server");

    try {
      if (!this.supabaseClient) {
        throw new Error("Supabase client not initialized");
      }

      // Invoke Edge Function to get consolidated flags, entitlements, and overrides
      const data = await this.invokeGetFeatureFlagsFunction();

      if (!data) {
        throw new Error("Edge Function did not return data");
      }

      const {
        flags: serverFlags,
        overrides: allOverrides,
        entitlements: allEntitlements,
        rollouts: allRollouts = {}, // NEW: Extract rollout config from response
      } = data;

      // Process entitlements (only cache if userId is available)
      if (this.userId && allEntitlements && allEntitlements.length > 0) {
        try {
          this.cachedEntitlements = new Map(
            allEntitlements.map((e) => [e.key, e]),
          );

          // Cache entitlements for offline use (keyed per-user)
          await SecureStorage.setJSON(
            `${STORAGE_KEYS.ENTITLEMENTS}:${this.userId}`,
            Object.fromEntries(this.cachedEntitlements),
          );

          logger.debug("feature_flags", "Cached entitlements", {
            count: this.cachedEntitlements.size,
          });
        } catch (error) {
          logger.warn("feature_flags", "Failed to process entitlements", error);
          await this.loadCachedEntitlements();
        }
      } else if (allEntitlements && allEntitlements.length > 0) {
        // Still populate in-memory cache even if userId is unavailable (for bootstrap)
        this.cachedEntitlements = new Map(
          allEntitlements.map((e) => [e.key, e]),
        );
        logger.debug(
          "feature_flags",
          "Loaded entitlements (in-memory only, userId unavailable)",
          {
            count: this.cachedEntitlements.size,
          },
        );
      }

      // Process flag-type overrides for remote override map
      if (this.userId && allOverrides && allOverrides.length > 0) {
        try {
          // Filter to only include flag-type overrides
          const flagOverrides = allOverrides.filter(
            (o) => o.target_type === "flag",
          );
          this.remoteOverrides = new Map(
            flagOverrides.map((o) => [o.target_name, o]),
          );

          // Cache flag overrides for offline use
          await SecureStorage.setJSON(
            `${STORAGE_KEYS.FEATURE_FLAGS}:${OVERRIDE_CACHE_KEY_PREFIX}${this.userId}`,
            Object.fromEntries(this.remoteOverrides),
          );

          logger.debug("feature_flags", "Processed remote flag overrides", {
            count: this.remoteOverrides.size,
          });
        } catch (error) {
          logger.warn(
            "feature_flags",
            "Failed to process flag overrides",
            error,
          );
          await this.loadCachedRemoteOverrides();
        }
      }

      // NEW: Process rollout configuration
      if (allRollouts && Object.keys(allRollouts).length > 0) {
        try {
          this.cachedRollouts = new Map(Object.entries(allRollouts));

          // Cache rollouts for offline use (non-sensitive, same key prefix as flags)
          await SecureStorage.setJSON(
            `${STORAGE_KEYS.FEATURE_FLAGS}:rollouts`,
            Object.fromEntries(this.cachedRollouts),
          );

          logger.debug("feature_flags", "Cached rollout config", {
            count: this.cachedRollouts.size,
          });
        } catch (error) {
          logger.warn(
            "feature_flags",
            "Failed to process rollout config",
            error,
          );
          await this.loadCachedRollouts();
        }
      } else if (allRollouts) {
        // Load cached rollouts if available
        await this.loadCachedRollouts();
      }
      const newFlags: Map<string, FeatureFlagState> = new Map();

      if (serverFlags && serverFlags.length > 0) {
        // Use server flags (production mode)
        for (const flag of serverFlags) {
          newFlags.set(flag.flag_name, {
            enabled: flag.enabled,
            kind: flag.kind,
            description: flag.description,
            source: "server",
          });
        }
      } else {
        // Use hardcoded config (fallback)
        this.loadHardcodedFlags();
        for (const [name, state] of this.currentFlags) {
          newFlags.set(name, state);
        }
      }

      // Store as current state
      this.currentFlags = newFlags;
      this.bootstrapped = true;

      // Persist for offline use (convert Map to object for storage)
      await SecureStorage.setJSON(STORAGE_KEYS.FEATURE_FLAGS, {
        flags: Object.fromEntries(newFlags),
        fetchedAt: Date.now(),
      });

      logger.info("feature_flags", "Bootstrapped successfully from server", {
        flagCount: newFlags.size,
        overrideCount: this.remoteOverrides.size,
      });

      // Notify subscribers
      this.notifySubscribers(newFlags);
    } catch (error) {
      logger.warn(
        "feature_flags",
        "Server bootstrap failed, using fallback",
        error,
      );

      // Try to load last known values
      try {
        const cached = await SecureStorage.getJSON<{
          flags: Record<string, FeatureFlagState>;
          fetchedAt: number;
        }>(STORAGE_KEYS.FEATURE_FLAGS);

        if (cached?.flags) {
          this.currentFlags = new Map(Object.entries(cached.flags));
          this.bootstrapped = true;
          // Also try to load cached overrides and rollouts
          await this.loadCachedRemoteOverrides();
          await this.loadCachedRollouts(); // NEW: Load cached rollouts
          logger.info("feature_flags", "Loaded from last known state", {
            flagCount: this.currentFlags.size,
            overrideCount: this.remoteOverrides.size,
            age: Date.now() - cached.fetchedAt,
          });
          this.notifySubscribers(this.currentFlags);
          return;
        }
      } catch {
        logger.debug("feature_flags", "No cached flags available");
      }

      // Final fallback: Load hardcoded config
      this.loadHardcodedFlags();
      this.bootstrapped = true;
      logger.info("feature_flags", "Using hardcoded fallback", {
        flagCount: this.currentFlags.size,
      });
      this.notifySubscribers(this.currentFlags);
    }

    // Setup Realtime subscriptions for live updates (after bootstrap)
    if (!isDev) {
      await this.subscribeToRealtimeUpdates();
    }
  }

  /**
   * Load cached remote overrides from storage
   */
  private async loadCachedRemoteOverrides(): Promise<void> {
    if (!this.userId) return;
    try {
      const cached = await SecureStorage.getJSON<
        Record<string, FeatureFlagOverrideRow>
      >(
        `${STORAGE_KEYS.FEATURE_FLAGS}:${OVERRIDE_CACHE_KEY_PREFIX}${this.userId}`,
      );
      if (cached) {
        this.remoteOverrides = new Map(Object.entries(cached));
        logger.debug("feature_flags", "Loaded cached remote overrides", {
          count: this.remoteOverrides.size,
        });
      }
    } catch (error) {
      logger.warn(
        "feature_flags",
        "Failed to load cached remote overrides",
        error,
      );
    }
  }

  /**
   * Load cached entitlements from storage
   */
  private async loadCachedEntitlements(): Promise<void> {
    if (!this.userId) return;
    try {
      const cached = await SecureStorage.getJSON<
        Record<string, CachedEntitlement>
      >(`${STORAGE_KEYS.ENTITLEMENTS}:${this.userId}`);
      if (cached) {
        this.cachedEntitlements = new Map(Object.entries(cached));
        logger.debug("feature_flags", "Loaded cached entitlements", {
          count: this.cachedEntitlements.size,
        });
      }
    } catch (error) {
      logger.warn("feature_flags", "Failed to load cached entitlements", error);
    }
  }

  /**
   * NEW: Load cached rollout config from storage
   */
  private async loadCachedRollouts(): Promise<void> {
    try {
      const cached = await SecureStorage.getJSON<
        Record<string, CachedRolloutConfig>
      >(`${STORAGE_KEYS.FEATURE_FLAGS}:rollouts`);
      if (cached) {
        this.cachedRollouts = new Map(Object.entries(cached));
        logger.debug("feature_flags", "Loaded cached rollout config", {
          count: this.cachedRollouts.size,
        });
      }
    } catch (error) {
      logger.warn("feature_flags", "Failed to load cached rollouts", error);
    }
  }

  /**
   * Subscribe to Realtime updates for feature flags, entitlements, and overrides
   * Allows server-side changes to be pushed to the client immediately
   * Reduces polling and moves control to the server
   */
  private async subscribeToRealtimeUpdates(): Promise<void> {
    if (!this.supabaseClient || !this.userId) {
      logger.debug("feature_flags", "Realtime subscriptions not available");
      return;
    }

    try {
      // Subscribe to feature flags table (all users, all changes)
      const flagsChannel = this.supabaseClient
        .channel("public:feature_flags")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "feature_flags",
          },
          (payload: any) => {
            this.handleFlagChange(payload);
          },
        )
        .subscribe((status: string) => {
          if (status === "SUBSCRIBED") {
            logger.debug("feature_flags", "Subscribed to feature_flags table");
          }
        });

      this.realtimeSubscriptions.set("feature_flags", flagsChannel);

      // Subscribe to entitlements for this user
      const entitlementsChannel = this.supabaseClient
        .channel(`public:entitlements:user.eq.${this.userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "entitlements",
            filter: `user_id=eq.${this.userId}`,
          },
          (payload: any) => {
            this.handleEntitlementChange(payload);
          },
        )
        .subscribe((status: string) => {
          if (status === "SUBSCRIBED") {
            logger.debug(
              "feature_flags",
              "Subscribed to entitlements for user",
            );
          }
        });

      this.realtimeSubscriptions.set("entitlements", entitlementsChannel);

      // Subscribe to feature flag overrides for this user
      const overridesChannel = this.supabaseClient
        .channel(`public:feature_flag_overrides:user.eq.${this.userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "feature_flag_overrides",
            filter: `user_id=eq.${this.userId}`,
          },
          (payload: any) => {
            this.handleOverrideChange(payload);
          },
        )
        .subscribe((status: string) => {
          if (status === "SUBSCRIBED") {
            logger.debug(
              "feature_flags",
              "Subscribed to feature_flag_overrides for user",
            );
          }
        });

      this.realtimeSubscriptions.set("overrides", overridesChannel);

      logger.info("feature_flags", "Realtime subscriptions established");
    } catch (error) {
      logger.warn(
        "feature_flags",
        "Failed to setup Realtime subscriptions",
        error,
      );
    }
  }

  /**
   * Handle feature flag changes from Realtime
   */
  private async handleFlagChange(payload: any): Promise<void> {
    try {
      const { new: flagData, old: oldFlagData, eventType } = payload;

      // For DELETE events, payload.new is null; use payload.old instead
      // For INSERT/UPDATE events, payload.new has the data
      const flag = flagData || oldFlagData;

      if (eventType === "DELETE") {
        // Flag was deleted, remove from current flags
        if (flag?.flag_name) {
          this.currentFlags.delete(flag.flag_name);
          logger.debug("feature_flags", `Flag deleted:`, flag.flag_name);
        }
      } else if (eventType === "INSERT" || eventType === "UPDATE") {
        // Flag was inserted or updated
        if (flag?.flag_name) {
          this.currentFlags.set(flag.flag_name, {
            enabled: flag.enabled,
            kind: flag.kind,
            description: flag.description,
            source: "server",
          });
          logger.debug("feature_flags", `Flag ${eventType}:`, flag.flag_name);
        }
      }

      // Cache updated flags to storage
      await SecureStorage.setJSON(STORAGE_KEYS.FEATURE_FLAGS, {
        flags: Object.fromEntries(this.currentFlags),
        fetchedAt: Date.now(),
      });

      this.notifySubscribers(this.currentFlags);
    } catch (error) {
      logger.warn("feature_flags", "Error handling flag change", error);
    }
  }

  /**
   * Handle entitlement changes from Realtime
   */
  private async handleEntitlementChange(payload: any): Promise<void> {
    try {
      const {
        new: entitlementData,
        old: oldEntitlementData,
        eventType,
      } = payload;

      if (!this.userId) return;

      const entitlementKey = entitlementData?.key || oldEntitlementData?.key;

      if (eventType === "DELETE") {
        // Entitlement was revoked/deleted
        this.cachedEntitlements.delete(entitlementKey);
        logger.debug("feature_flags", `Entitlement revoked: ${entitlementKey}`);
      } else if (eventType === "INSERT" || eventType === "UPDATE") {
        // Entitlement was granted or updated
        if (entitlementData) {
          this.cachedEntitlements.set(
            entitlementKey,
            entitlementData as CachedEntitlement,
          );
          logger.debug(
            "feature_flags",
            `Entitlement ${eventType}:`,
            entitlementKey,
          );
        }
      }

      // Cache updated entitlements to storage
      await SecureStorage.setJSON(
        `${STORAGE_KEYS.ENTITLEMENTS}:${this.userId}`,
        Object.fromEntries(this.cachedEntitlements),
      );
    } catch (error) {
      logger.warn("feature_flags", "Error handling entitlement change", error);
    }
  }

  /**
   * Handle feature flag override changes from Realtime
   */
  private async handleOverrideChange(payload: any): Promise<void> {
    try {
      const { new: overrideData, old: oldOverrideData, eventType } = payload;

      if (!this.userId) return;

      const targetName =
        overrideData?.target_name || oldOverrideData?.target_name;

      if (eventType === "DELETE") {
        // Override was revoked, remove from map
        this.remoteOverrides.delete(targetName);
        logger.debug("feature_flags", `Override revoked: ${targetName}`);
      } else if (overrideData?.target_type === "flag") {
        // Only track flag-type overrides
        this.remoteOverrides.set(
          targetName,
          overrideData as FeatureFlagOverrideRow,
        );
        logger.debug("feature_flags", `Override ${eventType}: ${targetName}`);
      }

      // Cache updated overrides
      await SecureStorage.setJSON(
        `${STORAGE_KEYS.FEATURE_FLAGS}:${OVERRIDE_CACHE_KEY_PREFIX}${this.userId}`,
        Object.fromEntries(this.remoteOverrides),
      );

      // Notify subscribers of flag changes
      this.notifySubscribers(this.currentFlags);
    } catch (error) {
      logger.warn("feature_flags", "Error handling override change", error);
    }
  }

  /**
   * Load hardcoded flags from appsettings (fallback only)
   */
  private loadHardcodedFlags(): void {
    const config = getAppConfig();
    const hardcodedFlags = config.featureFlags || {};

    const flags: Map<string, FeatureFlagState> = new Map();
    for (const [key, value] of Object.entries(hardcodedFlags)) {
      if (typeof value === "object" && value !== null && "enabled" in value) {
        flags.set(key, {
          enabled: !!value.enabled,
          kind: value.kind,
          description: value.description,
          source: "hardcoded",
        });
      }
    }

    this.currentFlags = flags;
  }

  /**
   * Get feature flag value
   *
   * Priority (merge logic: override > entitlement > global flag):
   * 1. Remote override (per-user, admin-controlled)
   * 2. Local user override (admin testing)
   * 3. Current state (from server bootstrap)
   * 4. Hardcoded fallback
   */
  getFlag(name: string, fallback: boolean = false): boolean {
    // Priority 1: Remote override (per-user, server-side control)
    const remoteOverride = this.remoteOverrides.get(name);
    if (remoteOverride) {
      // Defensive client-side filtering (revoked, expired)
      if (!remoteOverride.revoked) {
        if (
          remoteOverride.expires_at === null ||
          new Date(remoteOverride.expires_at).getTime() > Date.now()
        ) {
          logger.debug(
            "feature_flags",
            `Flag ${name} from remote override: ${remoteOverride.enabled}`,
          );
          return remoteOverride.enabled;
        }
      }
    }

    // Priority 2: Local user override (admin testing)
    if (this.userOverrides.has(name)) {
      const value = this.userOverrides.get(name);
      logger.debug(
        "feature_flags",
        `Flag ${name} from local override: ${value}`,
      );
      return value ?? fallback;
    }

    // Priority 3: Current state (from server or last known)
    const flagState = this.currentFlags.get(name);
    if (flagState !== undefined) {
      const value = flagState.enabled;
      logger.debug(
        "feature_flags",
        `Flag ${name} from ${flagState.source}: ${value}`,
      );
      return value;
    }

    // Priority 4: Hardcoded fallback (if not bootstrapped yet)
    if (!this.bootstrapped) {
      const config = getAppConfig();
      const featureFlags = config.featureFlags || {};
      // Safely access property using hasOwnProperty check
      const hardcoded = Object.prototype.hasOwnProperty.call(featureFlags, name)
        ? featureFlags[String(name)]
        : null;
      if (
        hardcoded &&
        typeof hardcoded === "object" &&
        "enabled" in hardcoded
      ) {
        logger.debug(
          "feature_flags",
          `Flag ${name} from hardcoded: ${hardcoded.enabled}`,
        );
        return !!hardcoded.enabled;
      }
    }

    // Default fallback
    logger.debug(
      "feature_flags",
      `Flag ${name} not found, using fallback: ${fallback}`,
    );
    return fallback;
  }

  /**
   * Get entitlement status (FRESH check on each call)
   *
   * Priority:
   * 1. User override (admin testing)
   * 2. Fresh server check
   * 3. Last known value (offline)
   *
   * Includes clock manipulation detection for security
   */
  async getEntitlement(
    name: string,
    userId: string,
  ): Promise<{ granted: boolean; source: string; expiresAt?: string | null }> {
    // Priority 1: User override (admin testing)
    const overrideKey = `${userId}:${name}`;
    if (this.userOverrides.has(overrideKey)) {
      const value = this.userOverrides.get(overrideKey) ?? false;
      logger.debug(
        "feature_flags",
        `Entitlement ${name} from override: ${value}`,
      );
      return {
        granted: value,
        source: "override",
        expiresAt: undefined,
      };
    }

    // Check for invalid clock first (fail-secure)
    const clockInvalid = await this.checkClockValidity();
    if (clockInvalid) {
      logger.warn(
        "feature_flags",
        "Device clock invalid, denying entitlement",
        { name },
      );
      return { granted: false, source: "clock_invalid", expiresAt: undefined };
    }

    // Priority 2: Check cache first (event-driven design)
    const cached = this.cachedEntitlements.get(name);

    if (cached) {
      // Check if expired
      const isExpired =
        cached.expires_at !== null &&
        new Date(cached.expires_at).getTime() <= Date.now();

      if (!isExpired) {
        // Cache is still valid
        logger.debug("feature_flags", `Entitlement ${name} from cache: true`, {
          expiresAt: cached.expires_at,
        });
        return {
          granted: true,
          source: "cache",
          expiresAt: cached.expires_at,
        };
      }

      // Cache expired, try fresh query as security check
      logger.debug(
        "feature_flags",
        `Entitlement ${name} has expired, verifying with server`,
      );
      try {
        if (!this.supabaseClient) {
          // Offline and expired: deny access (security: fail-secure)
          logger.warn(
            "feature_flags",
            `Entitlement ${name} expired and offline, denying`,
          );
          return {
            granted: false,
            source: "expired_offline",
            expiresAt: cached.expires_at,
          };
        }

        // Fetch fresh to verify
        const entitlements = await fetchEntitlementsByUserId(
          this.supabaseClient,
          userId,
        );
        const fresh = entitlements.find((e) => e.key === name);

        let granted = false;
        if (fresh) {
          granted =
            fresh.expires_at === null ||
            new Date(fresh.expires_at).getTime() > Date.now();
        }

        // Update cache with fresh data (only if userId is set)
        if (fresh && this.userId) {
          this.cachedEntitlements.set(name, fresh);
          await SecureStorage.setJSON(
            `${STORAGE_KEYS.ENTITLEMENTS}:${this.userId}`,
            Object.fromEntries(this.cachedEntitlements),
          );
        } else if (fresh) {
          // Still update in-memory cache even if userId is not set
          this.cachedEntitlements.set(name, fresh);
        }

        if (!fresh) {
          // Entitlement no longer exists, remove from cache
          this.cachedEntitlements.delete(name);
        }

        logger.debug(
          "feature_flags",
          `Entitlement ${name} verified: ${granted}`,
          { expiresAt: fresh?.expires_at },
        );
        return { granted, source: "server", expiresAt: fresh?.expires_at };
      } catch (error) {
        // Server check failed, offline and expired: deny access (fail-secure)
        logger.warn(
          "feature_flags",
          `Fresh entitlement check failed for ${name}, expired and offline, denying`,
          error,
        );
        return {
          granted: false,
          source: "expired_offline",
          expiresAt: cached.expires_at,
        };
      }
    }

    // No cache: try fresh query
    try {
      if (!this.supabaseClient) {
        throw new Error("Supabase client not initialized");
      }

      const entitlements = await fetchEntitlementsByUserId(
        this.supabaseClient,
        userId,
      );
      const entitlement = entitlements.find((e) => e.key === name);

      let granted = false;
      if (entitlement) {
        granted =
          entitlement.expires_at === null ||
          new Date(entitlement.expires_at).getTime() > Date.now();
        // Cache for future use (only if userId is set)
        this.cachedEntitlements.set(name, entitlement);
        if (this.userId) {
          await SecureStorage.setJSON(
            `${STORAGE_KEYS.ENTITLEMENTS}:${this.userId}`,
            Object.fromEntries(this.cachedEntitlements),
          );
        }
      }

      logger.debug(
        "feature_flags",
        `Entitlement ${name} from server: ${granted}`,
        {
          expiresAt: entitlement?.expires_at,
        },
      );
      return { granted, source: "server", expiresAt: entitlement?.expires_at };
    } catch (error) {
      logger.warn(
        "feature_flags",
        `Server check failed for ${name}, denying access`,
        error,
      );
      // No cache and server unavailable: deny access (fail-secure)
      return {
        granted: false,
        source: "server_unavailable",
        expiresAt: undefined,
      };
    }
  }

  /**
   * Check device clock validity (detect manipulation)
   */
  private async checkClockValidity(): Promise<boolean> {
    try {
      const clockInvalid = await SecureStorage.getJSON<{
        detected: number;
        skew: number;
      }>(STORAGE_KEYS.CLOCK_INVALID);

      return !!clockInvalid;
    } catch {
      return false;
    }
  }

  /**
   * Verify device clock on app startup
   */
  async verifyDeviceClock(): Promise<boolean> {
    try {
      const lastCheck = await SecureStorage.getJSON<{ timestamp: number }>(
        "dnd:last_clock_check",
      );

      if (!lastCheck?.timestamp) {
        // First run, record baseline
        await SecureStorage.setJSON("dnd:last_clock_check", {
          timestamp: Date.now(),
        });
        return true;
      }

      const now = Date.now();
      const skew = lastCheck.timestamp - now;
      const tolerance = getClockSkewToleranceMs();

      if (skew > tolerance) {
        // Clock went backward
        logger.error("feature_flags", "Clock manipulation detected", {
          skew,
          tolerance,
        });

        await SecureStorage.setJSON(STORAGE_KEYS.CLOCK_INVALID, {
          detected: now,
          skew,
        });

        return false;
      }

      // Update baseline
      await SecureStorage.setJSON("dnd:last_clock_check", { timestamp: now });
      return true;
    } catch (error) {
      logger.error("feature_flags", "Clock verification failed", error);
      return true; // Default to valid (don't block on verification error)
    }
  }

  /**
   * Set user override (admin testing)
   */
  setOverride(key: string, value: boolean): void {
    this.userOverrides.set(key, value);
    logger.info("feature_flags", `Override set: ${key} = ${value}`);

    // If it's a flag override, notify subscribers
    if (!key.includes(":")) {
      this.notifySubscribers(this.currentFlags);
    }
  }

  /**
   * Clear user override
   */
  clearOverride(key: string): void {
    this.userOverrides.delete(key);
    logger.info("feature_flags", `Override cleared: ${key}`);

    // If it's a flag override, notify subscribers
    if (!key.includes(":")) {
      this.notifySubscribers(this.currentFlags);
    }
  }

  /**
   * Clear all overrides
   */
  clearAllOverrides(): void {
    this.userOverrides.clear();
    logger.info("feature_flags", "All overrides cleared");
    this.notifySubscribers(this.currentFlags);
  }

  /**
   * Subscribe to flag updates
   */
  subscribe(callback: FlagsSubscriber): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify subscribers of flag updates
   */
  private notifySubscribers(flags: Map<string, FeatureFlagState>): void {
    const flagsObject = Object.fromEntries(flags);
    for (const callback of this.subscribers) {
      try {
        callback(flagsObject);
      } catch (error) {
        logger.error("feature_flags", "Subscriber notification failed", error);
      }
    }
  }

  /**
   * Get all current flags (for debugging)
   */
  getAllFlags(): Record<string, FeatureFlagState> {
    return Object.fromEntries(this.currentFlags);
  }

  /**
   * Clear all cached data (for logout)
   * Properly clears feature flags, clock validation, entitlements, and overrides
   */
  async clearCache(): Promise<void> {
    try {
      // Unsubscribe from Realtime channels
      try {
        for (const channel of this.realtimeSubscriptions.values()) {
          await this.supabaseClient?.removeChannel(channel);
        }
        this.realtimeSubscriptions.clear();
        logger.debug("feature_flags", "Unsubscribed from Realtime channels");
      } catch (error) {
        logger.warn(
          "feature_flags",
          "Failed to unsubscribe from Realtime",
          error,
        );
      }

      // Clear core flag caches
      await SecureStorage.removeItem(STORAGE_KEYS.FEATURE_FLAGS);
      await SecureStorage.removeItem(STORAGE_KEYS.CLOCK_INVALID);
      await SecureStorage.removeItem("dnd:last_clock_check");

      // Clear entitlements cache
      if (this.userId) {
        await SecureStorage.removeItem(
          `${STORAGE_KEYS.ENTITLEMENTS}:${this.userId}`,
        );
      }

      // Clear all override cache entries by pattern
      try {
        const allKeys = await SecureStorage.getAllKeys();
        const overridePattern = `${STORAGE_KEYS.FEATURE_FLAGS}:${OVERRIDE_CACHE_KEY_PREFIX}`;
        const keysToRemove = allKeys.filter((key) =>
          key.startsWith(overridePattern),
        );

        for (const key of keysToRemove) {
          await SecureStorage.removeItem(key);
        }

        if (keysToRemove.length > 0) {
          logger.debug("feature_flags", "Cleared override cache entries", {
            count: keysToRemove.length,
          });
        }
      } catch (error) {
        logger.warn("feature_flags", "Failed to clear override cache", error);
        // Continue with other cleanup steps
      }

      logger.info(
        "feature_flags",
        "Cleared all cached flags, entitlements, and overrides",
      );

      this.currentFlags = new Map();
      this.userOverrides.clear();
      this.remoteOverrides.clear();
      this.cachedEntitlements.clear();
      this.cachedRollouts.clear(); // NEW: Clear rollouts cache too
      this.bootstrapped = false;
    } catch (error) {
      logger.error("feature_flags", "Failed to clear cache", error);
    }
  }

  /**
   * NEW: Check if user is in percentage-based rollout
   *
   * **Resolution Order (in priority):**
   * 1. Remote override (if exists, skip rollout)
   * 2. Local user override (if exists, skip rollout)
   * 3. Rollout evaluation (if rollout config exists)
   * 4. Default to false (not in rollout)
   *
   * **Usage:**
   * ```ts
   * // Check if user can access new feature
   * if await FeatureFlagsManager.evaluateRollout(userId, "new_api_v2", fallback: true)) {
   *   callNewEndpoint();
   * } else {
   *   callLegacyEndpoint();
   * }
   *
   * // Route variant selection
   * const screen = await FeatureFlagsManager.evaluateRollout(userId, "characters_v2", 0)
   *   ? CharactersScreenV2
   *   : CharactersScreenV1;
   * ```
   *
   * @param userId - User ID for bucketing
   * @param flagName - Feature flag name
   * @param fallback - Default if no rollout config exists (default: false)
   * @returns true if user is in rollout, false otherwise
   */
  async evaluateRollout(
    userId: string,
    flagName: string,
    fallback: boolean = false,
  ): Promise<boolean> {
    // Priority 1: If remote override exists for this flag, it takes precedence (skip rollout)
    const remoteOverride = this.remoteOverrides.get(flagName);
    if (remoteOverride) {
      // Defensive check: ensure not revoked and not expired
      if (!remoteOverride.revoked) {
        if (
          remoteOverride.expires_at === null ||
          new Date(remoteOverride.expires_at).getTime() > Date.now()
        ) {
          logger.debug(
            "feature_flags",
            `Rollout ${flagName}: remote override exists, skipping rollout evaluation`,
          );
          // Override takes precedence; rollout not evaluated
          return remoteOverride.enabled;
        }
      }
    }

    // Priority 2: If local user override exists, it takes precedence (skip rollout)
    if (this.userOverrides.has(flagName)) {
      logger.debug(
        "feature_flags",
        `Rollout ${flagName}: local override exists, skipping rollout evaluation`,
      );
      return this.userOverrides.get(flagName) ?? fallback;
    }

    // Priority 3: Evaluate rollout if config exists
    const rolloutConfig = this.cachedRollouts.get(flagName);
    if (rolloutConfig) {
      // Use memoized evaluation for performance
      const inRollout = isInRolloutMemoized(
        userId,
        flagName,
        rolloutConfig.percentage,
        rolloutConfig.seed,
      );

      logger.debug(
        "feature_flags",
        `Rollout ${flagName}: user=${userId}, percentage=${rolloutConfig.percentage}%, in_rollout=${inRollout}`,
      );
      return inRollout;
    }

    // No rollout config: return fallback
    logger.debug(
      "feature_flags",
      `Rollout ${flagName}: no config, using fallback=${fallback}`,
    );
    return fallback;
  }

  /**
   * Get all cached rollouts (for debugging/logging)
   */
  getRollouts(): Record<string, CachedRolloutConfig> {
    return Object.fromEntries(this.cachedRollouts);
  }
}

// Export singleton instance
export const FeatureFlagsManager = new FeatureFlagsManagerClass();
export default FeatureFlagsManager;
