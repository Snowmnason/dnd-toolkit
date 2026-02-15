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

import { trackVariantAssignment } from "@/lib/analytics/variant-tracking";
import { getAppConfig, isDevelopment } from "@/lib/config/loader";
import { getPlatformName } from "@/lib/config/platform-config";
import { fetchEntitlementsByUserId } from "@/lib/database/entitlements";
import { FeatureFlagOverrideRow } from "@/lib/database/feature-flag-overrides";
import { SecureStorage, STORAGE_KEYS } from "@/lib/storage";
import { logger } from "@/lib/utils/logger";
import {
    evaluateAdvancedCondition,
    validateAdvancedCondition,
} from "./advanced-conditions";
import { FlagEvaluationCache } from "./cache";
import { evaluateConditions, type FlagContext } from "./conditions";
import { isInRolloutMemoized } from "./rollout";

// ==========================================
// Types
// ==========================================

export interface FeatureFlagState {
  enabled: boolean;
  kind?: string;
  description?: string;
  /** Optional list of dependent flag names from server */
  depends_on?: string[] | null;
  /** Optional advanced condition tree from server (Phase 3) */
  condition_logic?: Record<string, any> | null;
  /** Optional structured metadata for nested configurations (e.g., logger categories) */
  metadata?: Record<string, any> | null;
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
  /** Optional list of dependent flag names from DB */
  depends_on?: string[] | null;
  /** Optional advanced condition tree from DB */
  condition_logic?: Record<string, any> | null;
  /** Optional structured metadata for nested configurations from DB */
  metadata?: Record<string, any> | null;
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
  private evaluationCache: FlagEvaluationCache = new FlagEvaluationCache(); // Phase 2: LRU cache for isEnabledWithContext results
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
        rollouts: allRollouts, // Extract rollout config from response (no default value)
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

      // Process rollout configuration
      // Distinguish between: explicitly cleared (empty {}), missing (old server), and populated
      if (allRollouts && Object.keys(allRollouts).length > 0) {
        // Server returned populated rollouts, cache them
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
      } else if (allRollouts !== undefined && allRollouts !== null) {
        // Server explicitly returned empty {} (intentional disable of rollouts)
        // Clear cached rollouts to prevent stale configs from applying
        this.cachedRollouts = new Map();
        try {
          await SecureStorage.removeItem(
            `${STORAGE_KEYS.FEATURE_FLAGS}:rollouts`,
          );
          logger.debug(
            "feature_flags",
            "Cleared rollout config (server disabled)",
          );
        } catch (error) {
          logger.warn(
            "feature_flags",
            "Failed to clear cached rollouts",
            error,
          );
          // Still clear in-memory cache even if storage remove fails
          this.cachedRollouts = new Map();
        }
      } else {
        // rollouts field missing from response (old server/client or fetch error)
        // Load from cache for backward compatibility and offline support
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
            depends_on: flag.depends_on || null,
            condition_logic: flag.condition_logic || null,
            metadata: flag.metadata || null,
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

    // Validate flag dependencies and conditions (soft checks, doesn't block startup)
    this.validateFlagDependencies();
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
          // Invalidate evaluation cache for this flag
          this.invalidateFlagCache(flag.flag_name);
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
          // Invalidate evaluation cache for this flag
          this.invalidateFlagCache(flag.flag_name);
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
        // Clear evaluation cache since user's role/entitlements changed
        this.clearEvaluationCache();
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
          // Clear evaluation cache since user's role/entitlements changed
          this.clearEvaluationCache();
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
        // Invalidate evaluation cache for this flag
        this.invalidateFlagCache(targetName);
      } else if (overrideData?.target_type === "flag") {
        // Only track flag-type overrides
        this.remoteOverrides.set(
          targetName,
          overrideData as FeatureFlagOverrideRow,
        );
        logger.debug("feature_flags", `Override ${eventType}: ${targetName}`);
        // Invalidate evaluation cache for this flag
        this.invalidateFlagCache(targetName);
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
          depends_on: (value as any).dependsOn || null,
          condition_logic: (value as any).conditionLogic || null,
          metadata: (value as any).metadata || null,
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

      // Clear rollout cache (persisted and in-memory)
      await SecureStorage.removeItem(`${STORAGE_KEYS.FEATURE_FLAGS}:rollouts`);

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
   * const inRollout = await FeatureFlagsManager.evaluateRollout(userId, "new_api_v2", true);
   * if (inRollout) {
   *   callNewEndpoint();
   * } else {
   *   callLegacyEndpoint();
   * }
   *
   * // Route variant selection
   * const useNewScreen = await FeatureFlagsManager.evaluateRollout(userId, "characters_v2", false);
   * const screen = useNewScreen ? CharactersScreenV2 : CharactersScreenV1;
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

      // Track variant assignment: user is in rollout or control group
      // This creates the groundwork for A/B testing analytics
      const variant = inRollout ? "B" : "A"; // B = in rollout, A = control group
      trackVariantAssignment({
        flagName,
        variant,
        userId,
        percentage: rolloutConfig.percentage,
        context: { rollout_type: "feature_flag", in_rollout: inRollout },
      });

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
   * Evaluate if a flag is enabled considering conditions and dependencies
   *
   * **Resolution order (in priority):**
   * 1. Check if flag exists in current flags
   * 2. Check conditions (platform, environment, userRole) — AND logic
   * 3. Resolve dependencies recursively (all must be enabled)
   * 4. Return final boolean result
   *
   * **Context Defaults & Auto-Detection:**
   * - `platform`: Falls back to current platform if not provided
   * - `environment`: Falls back to app config environment if not provided
   * - `userRole`: **Phase 3:** Auto-detected from cached entitlements if not provided (via `getCachedUserRole()`)
   *
   * **Phase 2: Caching** — Results are cached per (flag, context) signature using LRU cache.
   * Default TTL is 1 hour; evictions are LRU-based at 256 entries max.
   * Cache can be cleared via `evaluationCache.clear()` or per-flag via `invalidateFlagCache(flagName)`.
   *
   * **Per-Call Memoization:** Within a single evaluation, per-call memoization avoids
   * redundant work for dependencies checked multiple times.
   *
   * **Usage Examples:**
   * ```ts
   * import { FeatureFlagsManager } from "@/lib/feature-flags";
   *
   * // Explicit role
   * const enabled = FeatureFlagsManager.isEnabledWithContext('advancedMaps', {
   *   platform: 'web',
   *   environment: 'production',
   *   userRole: 'admin'
   * });
   *
   * // Auto-detect role from entitlements
   * const autoDetected = FeatureFlagsManager.isEnabledWithContext('advancedMaps', {
   *   platform: 'web'
   *   // userRole will be auto-detected from cached entitlements
   * });
   *
   * // Use defaults for all context fields
   * const withDefaults = FeatureFlagsManager.isEnabledWithContext('simpleFeature');
   * ```
   *
   * @param flagName - Name of the flag to evaluate
   * @param context - Optional runtime context (platform, environment, userRole, etc.)
   *                  Omitted fields use defaults: platform from current platform,
   *                  environment from app config, userRole from cached entitlements
   * @returns true if flag is enabled considering conditions and dependencies
   */
  isEnabledWithContext(
    flagName: string,
    context: FlagContext = {},
  ): boolean {
    // Phase 2: Check LRU cache first (TTL: 1 hour, max 256 entries)
    const platform = context.platform || getPlatformName();
    const environment = context.environment || getAppConfig().environment;
    // Phase 3: Auto-detect userRole from cached entitlements if not provided
    const userRole = context.userRole || this.getCachedUserRole();

    const cachedResult = this.evaluationCache.getResult(
      flagName,
      platform,
      environment,
      userRole,
    );

    if (cachedResult !== undefined) {
      logger.debug("feature_flags", `Flag evaluation cache hit: ${flagName}`);
      return cachedResult;
    }

    // Create a resolved context with defaults to ensure evaluators receive concrete values
    // This prevents undefined comparisons in condition evaluation
    const resolvedContext: FlagContext = {
      platform: context.platform || platform,
      environment: context.environment || environment,
      userRole: userRole,
    };

    // Cache miss: evaluate the flag
    const callMemo = new Map<string, boolean>();
    const resolving = new Set<string>(); // Track in-progress resolutions for cycle detection
    const result = this._resolveFlag(flagName, resolvedContext, callMemo, resolving);

    // Cache the result for future lookups
    this.evaluationCache.setResult(
      flagName,
      platform,
      environment,
      userRole,
      result,
    );

    return result;
  }

  /**
   * Internal recursive flag resolver with per-call memoization and cycle detection
   * @private
   * @param flagName - Flag to resolve
   * @param context - Evaluation context
   * @param memo - Map of completed evaluations (cacheKey → result)
   * @param resolving - Set of flags currently being resolved (cycle detection)
   */
  private _resolveFlag(
    flagName: string,
    context: FlagContext,
    memo: Map<string, boolean>,
    resolving: Set<string>,
  ): boolean {
    // Create a cache key from flag name and context signature
    const cacheKey = this._makeContextKey(flagName, context);

    // Return cached result if already evaluated in this call
    if (memo.has(cacheKey)) {
      return memo.get(cacheKey)!;
    }

    // Detect circular dependency: if flag is already being resolved, fail closed
    if (resolving.has(cacheKey)) {
      logger.warn(
        "feature_flags",
        `Circular dependency detected for flag ${flagName}. Returning false to prevent infinite recursion.`,
      );
      memo.set(cacheKey, false);
      return false;
    }

    // Mark this flag as currently resolving
    resolving.add(cacheKey);

    // Get the flag definition from current flags
    const flagState = this.currentFlags.get(flagName);
    if (!flagState) {
      logger.warn(
        "feature_flags",
        `Flag not found: ${flagName}, treating as disabled`,
      );
      memo.set(cacheKey, false);
      return false;
    }

    // Step 1: Check if base flag is enabled
    if (!flagState.enabled) {
      memo.set(cacheKey, false);
      return false;
    }

    // Step 2: Get flag config from server-backed state, or fall back to AppSettings for schema
    const appConfig = getAppConfig();
    // eslint-disable-next-line security/detect-object-injection
    const hardcodedFlagConfig = appConfig.featureFlags?.[flagName];

    // Build effective flag config by merging server data + hardcoded schema
    // Dependencies are merged independently to ensure hardcoded dependsOn isn't lost
    const flagConfig = {
      depends_on: flagState.depends_on || hardcodedFlagConfig?.dependsOn,
      condition_logic: flagState.condition_logic,
      conditions: hardcodedFlagConfig?.conditions,
      dependsOn: flagState.depends_on || hardcodedFlagConfig?.dependsOn, // Also support camelCase for compatibility
      conditionLogic: flagState.condition_logic || hardcodedFlagConfig?.conditionLogic,
    };

    // If server didn't provide conditions, use hardcoded config
    // (dependencies are already merged independently above, so we don't repeat that here)
    if (!flagConfig.conditionLogic && !flagConfig.conditions && hardcodedFlagConfig) {
      Object.assign(flagConfig, {
        conditionLogic: hardcodedFlagConfig.conditionLogic,
        conditions: hardcodedFlagConfig.conditions,
      });
    }

    // Step 2: Evaluate conditions
    // Phase 3: Check advanced condition logic first (OR, NOT, nested)
    if (flagConfig.conditionLogic) {
      try {
        const validationErrors = validateAdvancedCondition(
          flagConfig.conditionLogic as any,
        );
        if (validationErrors.length > 0) {
          logger.error(
            "feature_flags",
            `Invalid conditionLogic for flag ${flagName}: ${validationErrors.join("; ")}`,
          );
          memo.set(cacheKey, false);
          return false;
        }

        const conditionsPass = evaluateAdvancedCondition(
          flagConfig.conditionLogic as any,
          context,
        );
        if (!conditionsPass) {
          memo.set(cacheKey, false);
          return false;
        }
      } catch (error) {
        logger.error(
          "feature_flags",
          `Error evaluating advanced conditions for ${flagName}: ${error}`,
        );
        memo.set(cacheKey, false);
        return false;
      }
    }
    // Phase 1: Fall back to simple conditions (AND logic)
    else if (flagConfig.conditions) {
      const conditionsPass = evaluateConditions(flagConfig.conditions, context);
      if (!conditionsPass) {
        memo.set(cacheKey, false);
        return false;
      }
    }

    // Step 3: Resolve dependencies (all dependencies must be enabled)
    if (flagConfig.dependsOn && flagConfig.dependsOn.length > 0) {
      for (const depName of flagConfig.dependsOn) {
        // Recursively check each dependency with the same context and resolving set
        const depEnabled = this._resolveFlag(depName, context, memo, resolving);
        if (!depEnabled) {
          logger.debug(
            "feature_flags",
            `Flag ${flagName} disabled: dependency ${depName} is disabled`,
          );
          memo.set(cacheKey, false);
          return false;
        }
      }
    }

    // All checks passed
    memo.set(cacheKey, true);
    return true;
  }

  /**
   * Create a cache key for (flag, context) signature
   * @private
   */
  private _makeContextKey(
    flagName: string,
    context: FlagContext,
  ): string {
    const platform = context.platform || getPlatformName();
    const environment = context.environment || getAppConfig().environment;
    const role = context.userRole || "unknown";
    return `${flagName}::${platform}::${environment}::${role}`;
  }

  /**
   * Validate feature flag dependencies and conditions at bootstrap
   * Checks for missing dependencies and circular references
   * Logs warnings (soft checks, doesn't block startup)
   * @private
   */
  private validateFlagDependencies(): void {
    const config = getAppConfig();
    const flags = config.featureFlags || {};

    if (Object.keys(flags).length === 0) {
      return; // No flags to validate
    }

    // Collect all flag names for existence checks
    const allFlagNames = new Set(Object.keys(flags));

    // Check each flag for issues
    for (const [flagName, flagConfig] of Object.entries(flags)) {
      if (!flagConfig || typeof flagConfig !== "object") {
        continue;
      }

      // Phase 3: Validate advanced condition logic
      if (flagConfig.conditionLogic) {
        const validationErrors = validateAdvancedCondition(
          flagConfig.conditionLogic as any,
        );
        if (validationErrors.length > 0) {
          logger.warn(
            "feature_flags",
            `Invalid conditionLogic for flag "${flagName}": ${validationErrors.join("; ")}`,
          );
        }
      }

      // Check for missing dependencies
      if (flagConfig.dependsOn && Array.isArray(flagConfig.dependsOn)) {
        for (const depName of flagConfig.dependsOn) {
          if (!allFlagNames.has(depName)) {
            logger.warn(
              "feature_flags",
              `Flag "${flagName}" depends on missing flag "${depName}"`,
            );
          }
        }
      }
    }

    // Check for circular dependencies using DFS
    for (const flagName of allFlagNames) {
      const cycle = this._detectCycle(flagName, flags, new Set(), new Set());
      if (cycle) {
        logger.warn(
          "feature_flags",
          `Circular dependency detected: ${cycle.join(" → ")}`,
        );
      }
    }
  }

  /**
   * Detect circular dependencies using depth-first search
   * @private
   */
  private _detectCycle(
    flagName: string,
    flags: Record<string, any>,
    visited: Set<string>,
    stackSet: Set<string>,
  ): string[] | null {
    visited.add(flagName);
    stackSet.add(flagName);

    // eslint-disable-next-line security/detect-object-injection
    const flagConfig = flags[flagName] as any;
    if (!flagConfig || !flagConfig.dependsOn || !Array.isArray(flagConfig.dependsOn)) {
      stackSet.delete(flagName);
      return null;
    }

    for (const depName of flagConfig.dependsOn) {
      if (!visited.has(depName)) {
        const cycle = this._detectCycle(
          depName,
          flags,
          visited,
          stackSet,
        );
        if (cycle) {
          return [flagName, ...cycle];
        }
      } else if (stackSet.has(depName)) {
        // Found a back edge (cycle)
        return [flagName, depName];
      }
    }

    stackSet.delete(flagName);
    return null;
  }

  /**
   * Invalidate evaluation cache for a specific flag
   *
   * Call this when a flag's config changes, conditions change, or dependencies change.
   * This ensures subsequent evaluations will re-evaluate conditions and dependencies.
   *
   * **Phase 2:** Part of cache invalidation strategy. Use alongside invalidateRoleCache()
   * when user roles change or when fetching fresh entitlements.
   *
   * @param flagName - Name of the flag whose cache entries should be invalidated
   *
   * @example
   * ```ts
   * // When a flag config is updated from server
   * FeatureFlagsManager.invalidateFlagCache('advancedMaps');
   *
   * // Subsequent evaluations will re-evaluate conditions
   * const enabled = FeatureFlagsManager.isEnabledWithContext('advancedMaps', context);
   * ```
   */
  invalidateFlagCache(flagName: string): void {
    this.evaluationCache.invalidateFlag(flagName);
    logger.debug(
      "feature_flags",
      `Invalidated evaluation cache for flag: ${flagName}`,
    );
  }

  /**
   * Invalidate evaluation cache for a specific user role
   *
   * Call this when user role changes or when fresh entitlements are fetched.
   * This ensures subsequent role-based evaluations are re-computed.
   *
   * **Phase 2:** Part of cache invalidation strategy. Use after updating cachedEntitlements
   * or when user role changes to ensure role-based conditions are re-evaluated.
   *
   * @param userRole - User role string (e.g., 'admin', 'player', 'unknown')
   *
   * @example
   * ```ts
   * // When user role changes (e.g., premium subscription activated)
   * FeatureFlagsManager.invalidateRoleCache('premium-user');
   *
   * // Subsequent evaluations with role-based conditions will be re-computed
   * const enabled = FeatureFlagsManager.isEnabledWithContext('advancedMaps', {
   *   userRole: 'premium-user'
   * });
   * ```
   */
  invalidateRoleCache(userRole: string): void {
    this.evaluationCache.invalidateRole(userRole);
    logger.debug(
      "feature_flags",
      `Invalidated evaluation cache for role: ${userRole}`,
    );
  }

  /**
   * Clear all cached evaluations
   *
   * Use sparingly — primarily for testing or when performing a full reset.
   * Use invalidateFlagCache() or invalidateRoleCache() for targeted invalidation instead.
   *
   * @example
   * ```ts
   * // Full cache reset (e.g., after logout or major config change)
   * FeatureFlagsManager.clearEvaluationCache();
   * ```
   */
  clearEvaluationCache(): void {
    this.evaluationCache.clear();
    logger.info("feature_flags", "Cleared all evaluation cache entries");
  }

  /**
   * Get cached user role from entitlements
   *
   * **Phase 2:** Queries cached entitlements to determine the user's role.
   * Checks for known role entitlements (admin, moderator, premium_user, etc.)
   * and returns the first matching role found.
   *
   * Falls back gracefully:
   * - If no role entitlements found, returns "unknown"
   * - If entitlements not loaded yet, returns undefined (caller should provide role in context)
   *
   * **How it works:**
   * 1. Iterates through cached entitlements
   * 2. Looks for known role keys (e.g., 'admin', 'moderator')
   * 3. Checks expiry (excludes expired entitlements)
   * 4. Returns first matching role or "unknown"
   *
   * **Performance:** O(n) scan of cached entitlements; use getCachedUserRole() judiciously.
   *
   * @returns User's role string (e.g., 'admin', 'moderator', 'premium_user') or "unknown"
   *
   * @example
   * ```ts
   * // After entitlements are loaded from server
   * const role = FeatureFlagsManager.getCachedUserRole();
   * console.log(`User role: ${role}`); // "admin" or "premium_user" or "unknown"
   *
   * // Use in feature flag evaluation
   * const hasAccess = FeatureFlagsManager.isEnabledWithContext('advancedMaps', {
   *   userRole: role
   * });
   * ```
   */
  getCachedUserRole(): string {
    // List of known role entitlements to check for
    const knownRoles = ["admin", "moderator", "premium_user", "vip"];

    // Iterate through cached entitlements and check for known roles
    for (const entitlement of this.cachedEntitlements.values()) {
      // Check if this entitlement's key matches a known role
      if (knownRoles.includes(entitlement.key)) {
        // Check if entitlement has not expired
        if (entitlement.expires_at) {
          const expiryTime = new Date(entitlement.expires_at).getTime();
          if (expiryTime < Date.now()) {
            // Entitlement has expired, skip it
            continue;
          }
        }

        logger.debug(
          "feature_flags",
          `Found cached user role: ${entitlement.key}`,
        );
        return entitlement.key;
      }
    }

    // No role entitlements found
    logger.debug("feature_flags", "No cached user role found, using 'unknown'");
    return "unknown";
  }

  /**
   * Get cache statistics (for debugging/monitoring)
   *
   * Returns hit/miss rates and current cache size information.
   *
   * @example
   * ```ts
   * const stats = FeatureFlagsManager.getEvaluationCacheStats();
   * console.log(`Cache hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
   * console.log(`Current entries: ${stats.size}`);
   * ```
   */
  getEvaluationCacheStats() {
    return this.evaluationCache.getStats();
  }

  /**
   * Get all cached evaluations (for debugging/logging)
   */
  getRollouts(): Record<string, CachedRolloutConfig> {
    return Object.fromEntries(this.cachedRollouts);
  }
}

// Export singleton instance
export const FeatureFlagsManager = new FeatureFlagsManagerClass();
export default FeatureFlagsManager;
