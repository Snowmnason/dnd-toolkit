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
import { fetchFeatureFlags } from "@/lib/database/feature-flags";
import {
  fetchOverridesByUserId,
  FeatureFlagOverrideRow,
} from "@/lib/database/feature-flag-overrides";
import { SecureStorage, STORAGE_KEYS } from "@/lib/storage";
import { logger } from "@/lib/utils/logger";

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

export type FlagsSubscriber = (flags: Record<string, FeatureFlagState>) => void;

// ==========================================
// Configuration
// ==========================================

const ENTITLEMENT_CACHE_KEY_PREFIX = "entitlement:";
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
  private subscribers: Set<FlagsSubscriber> = new Set();
  private bootstrapped = false;
  private userId: string | null = null;

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

    // Production: Fetch from server
    logger.info("feature_flags", "Bootstrapping feature flags from server");

    try {
      if (!this.supabaseClient) {
        throw new Error("Supabase client not initialized");
      }

      // Fetch server flags
      const serverFlags = await fetchFeatureFlags(this.supabaseClient);

      // Fetch remote overrides for current user (if user ID available)
      if (this.userId) {
        try {
          const overrides = await fetchOverridesByUserId(
            this.supabaseClient,
            this.userId,
          );
          this.remoteOverrides = new Map(
            overrides.map((o) => [o.target_name, o]),
          );
          await SecureStorage.setJSON(
            `${STORAGE_KEYS.FEATURE_FLAGS}:${OVERRIDE_CACHE_KEY_PREFIX}${this.userId}`,
            Object.fromEntries(this.remoteOverrides),
          );
          logger.debug("feature_flags", "Fetched remote overrides", {
            count: this.remoteOverrides.size,
          });
        } catch (error) {
          logger.warn(
            "feature_flags",
            "Failed to fetch remote overrides",
            error,
          );
          // Try to load cached overrides
          await this.loadCachedRemoteOverrides();
        }
      }

      // Convert to state object
      const newFlags: Map<string, FeatureFlagState> = new Map();

      if (serverFlags.length > 0) {
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
        // Use hardcoded config (dev mode or fallback)
        this.loadHardcodedFlags();
        // Copy from the loaded hardcoded flags
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

      logger.info(
        "feature_flags",
        `Bootstrapped successfully (${isDev ? "dev config" : "server"})`,
        {
          flagCount: newFlags.size,
          overrideCount: this.remoteOverrides.size,
        },
      );

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
          // Also try to load cached overrides
          await this.loadCachedRemoteOverrides();
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

    // Priority 2: Fresh server check
    try {
      if (!this.supabaseClient) {
        throw new Error("Supabase client not initialized");
      }

      // Fetch full entitlement data to get expiry
      const entitlements = await fetchEntitlementsByUserId(
        this.supabaseClient,
        userId,
      );
      const entitlement = entitlements.find((e) => e.key === name);

      let granted = false;
      if (entitlement) {
        // If expires_at is null, the entitlement never expires
        if (entitlement.expires_at === null) {
          granted = true;
        } else {
          // Check if the entitlement has expired
          const expiryTime = new Date(entitlement.expires_at).getTime();
          granted = expiryTime > Date.now();
        }
      }

      // Cache result for offline use with expiry info
      await this.cacheEntitlement(
        userId,
        name,
        granted,
        entitlement?.expires_at || null,
      );

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
        `Fresh entitlement check failed for ${name}, using cache`,
        error,
      );

      // Priority 3: Last known value (offline)
      const cached = await this.getCachedEntitlementWithExpiry(userId, name);
      if (cached !== null) {
        logger.debug(
          "feature_flags",
          `Entitlement ${name} from cache: ${cached.granted}`,
          { expiresAt: cached.expiresAt },
        );
        return {
          granted: cached.granted,
          source: "cache",
          expiresAt: cached.expiresAt,
        };
      }

      // No cache available
      logger.debug("feature_flags", `Entitlement ${name} not found, denying`);
      return { granted: false, source: "not_found", expiresAt: undefined };
    }
  }

  /**
   * Cache entitlement for offline use
   */
  private async cacheEntitlement(
    userId: string,
    name: string,
    granted: boolean,
    expiresAt: string | null,
  ): Promise<void> {
    try {
      const cacheKey = `${STORAGE_KEYS.ENTITLEMENTS}:${ENTITLEMENT_CACHE_KEY_PREFIX}${userId}:${name}`;
      await SecureStorage.setJSON(cacheKey, {
        granted,
        expiresAt,
        cachedAt: Date.now(),
      });
    } catch (error) {
      logger.error("feature_flags", "Failed to cache entitlement", error);
    }
  }

  /**
   * Get cached entitlement with expiry info
   */
  private async getCachedEntitlementWithExpiry(
    userId: string,
    name: string,
  ): Promise<{ granted: boolean; expiresAt: string | null } | null> {
    try {
      const cacheKey = `${STORAGE_KEYS.ENTITLEMENTS}:${ENTITLEMENT_CACHE_KEY_PREFIX}${userId}:${name}`;
      const cached = await SecureStorage.getJSON<{
        granted: boolean;
        expiresAt: string | null;
        cachedAt: number;
      }>(cacheKey);

      if (!cached) {
        return null;
      }

      // If the cached entitlement has expired, deny access
      if (cached.expiresAt) {
        const expiryTime = new Date(cached.expiresAt).getTime();
        if (expiryTime <= Date.now()) {
          logger.debug(
            "feature_flags",
            `Cached entitlement ${name} has expired`,
          );
          return { granted: false, expiresAt: cached.expiresAt };
        }
      }

      return { granted: cached.granted, expiresAt: cached.expiresAt };
    } catch {
      return null;
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
      // Clear core flag caches
      await SecureStorage.removeItem(STORAGE_KEYS.FEATURE_FLAGS);
      await SecureStorage.removeItem(STORAGE_KEYS.CLOCK_INVALID);
      await SecureStorage.removeItem("dnd:last_clock_check");

      // Clear all entitlement cache entries by pattern
      try {
        const allKeys = await SecureStorage.getAllKeys();
        const entitlementPattern = `${STORAGE_KEYS.ENTITLEMENTS}:${ENTITLEMENT_CACHE_KEY_PREFIX}`;
        const overridePattern = `${STORAGE_KEYS.FEATURE_FLAGS}:${OVERRIDE_CACHE_KEY_PREFIX}`;
        const keysToRemove = allKeys.filter(
          (key) =>
            key.startsWith(entitlementPattern) ||
            key.startsWith(overridePattern),
        );

        for (const key of keysToRemove) {
          await SecureStorage.removeItem(key);
        }

        if (keysToRemove.length > 0) {
          logger.debug(
            "feature_flags",
            "Cleared entitlement and override cache entries",
            {
              count: keysToRemove.length,
            },
          );
        }
      } catch (error) {
        logger.warn(
          "feature_flags",
          "Failed to clear entitlement/override cache",
          error,
        );
        // Continue with other cleanup steps
      }

      logger.info(
        "feature_flags",
        "Cleared all cached flags, entitlements, and overrides",
      );

      this.currentFlags = new Map();
      this.userOverrides.clear();
      this.remoteOverrides.clear();
      this.bootstrapped = false;
    } catch (error) {
      logger.error("feature_flags", "Failed to clear cache", error);
    }
  }
}

// Export singleton instance
export const FeatureFlagsManager = new FeatureFlagsManagerClass();
export default FeatureFlagsManager;
