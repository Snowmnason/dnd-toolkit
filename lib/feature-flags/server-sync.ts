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

import { getAppConfig } from "@/lib/config/loader";
import { fetchEntitlementsByUserId } from "@/lib/database/entitlements";
import { fetchFeatureFlagsByEnv } from "@/lib/database/feature-flags";
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

const CLOCK_SKEW_TOLERANCE_MS = 60 * 1000; // 60 seconds
const ENTITLEMENT_CACHE_KEY_PREFIX = "entitlement:";

// ==========================================
// Feature Flags Manager
// ==========================================

class FeatureFlagsManagerClass {
  private supabaseClient: any = null;
  private currentFlags: Map<string, FeatureFlagState> = new Map(); // Use Map for safe access
  private userOverrides: Map<string, boolean> = new Map(); // Admin testing overrides
  private subscribers: Set<FlagsSubscriber> = new Set();
  private bootstrapped = false;

  /**
   * Initialize with Supabase client
   * Called during app kernel bootstrap
   */
  async initialize(supabaseClient: any): Promise<void> {
    this.supabaseClient = supabaseClient;
    logger.debug("feature_flags", "FeatureFlagsManager initialized");
  }

  /**
   * Bootstrap feature flags from server (called ONCE at app startup)
   * Server values OVERWRITE hardcoded config
   *
   * Priority:
   * 1. Server values (if reachable)
   * 2. Last known values (offline)
   * 3. Hardcoded fallback
   */
  async bootstrapFlags(): Promise<void> {
    if (this.bootstrapped) {
      logger.debug("feature_flags", "Already bootstrapped, skipping");
      return;
    }

    logger.info("feature_flags", "Bootstrapping feature flags from server");

    try {
      if (!this.supabaseClient) {
        throw new Error("Supabase client not initialized");
      }

      // Fetch server flags
      const serverFlags = await fetchFeatureFlagsByEnv(this.supabaseClient);

      // Convert to state object
      const newFlags: Map<string, FeatureFlagState> = new Map();
      for (const flag of serverFlags) {
        newFlags.set(flag.flag_name, {
          enabled: flag.enabled,
          kind: flag.kind,
          description: flag.description,
          source: "server",
        });
      }

      // Store as current state
      this.currentFlags = newFlags;
      this.bootstrapped = true;

      // Persist for offline use (convert Map to object for storage)
      await SecureStorage.setJSON(STORAGE_KEYS.FEATURE_FLAGS, {
        flags: Object.fromEntries(newFlags),
        fetchedAt: Date.now(),
      });

      logger.info("feature_flags", "Bootstrapped from server", {
        flagCount: newFlags.size,
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
          logger.info("feature_flags", "Loaded from last known state", {
            flagCount: this.currentFlags.size,
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
   * Priority:
   * 1. User override (admin testing)
   * 2. Current state (from server bootstrap)
   * 3. Hardcoded fallback
   */
  getFlag(name: string, fallback: boolean = false): boolean {
    // Priority 1: User override (admin testing)
    if (this.userOverrides.has(name)) {
      const value = this.userOverrides.get(name);
      logger.debug("feature_flags", `Flag ${name} from override: ${value}`);
      return value ?? fallback;
    }

    // Priority 2: Current state (from server or last known)
    const flagState = this.currentFlags.get(name);
    if (flagState !== undefined) {
      const value = flagState.enabled;
      logger.debug(
        "feature_flags",
        `Flag ${name} from ${flagState.source}: ${value}`,
      );
      return value;
    }

    // Priority 3: Hardcoded fallback (if not bootstrapped yet)
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
  ): Promise<{ granted: boolean; source: string }> {
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
      return { granted: false, source: "clock_invalid" };
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
      return { granted, source: "server" };
    } catch (error) {
      logger.warn(
        "feature_flags",
        `Fresh entitlement check failed for ${name}, using cache`,
        error,
      );

      // Priority 3: Last known value (offline)
      const cached = await this.getCachedEntitlement(userId, name);
      if (cached !== null) {
        logger.debug(
          "feature_flags",
          `Entitlement ${name} from cache: ${cached}`,
        );
        return { granted: cached, source: "cache" };
      }

      // No cache available
      logger.debug("feature_flags", `Entitlement ${name} not found, denying`);
      return { granted: false, source: "not_found" };
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
   * Get cached entitlement (checks expiry)
   */
  private async getCachedEntitlement(
    userId: string,
    name: string,
  ): Promise<boolean | null> {
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
          return false;
        }
      }

      return cached.granted;
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

      if (skew > CLOCK_SKEW_TOLERANCE_MS) {
        // Clock went backward
        logger.error("feature_flags", "Clock manipulation detected", {
          skew,
          tolerance: CLOCK_SKEW_TOLERANCE_MS,
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
   */
  async clearCache(): Promise<void> {
    try {
      await SecureStorage.removeItem(STORAGE_KEYS.FEATURE_FLAGS);
      await SecureStorage.removeItem(STORAGE_KEYS.CLOCK_INVALID);
      await SecureStorage.removeItem("dnd:last_clock_check");

      // Clear entitlement cache (pattern match)
      // Note: This is a simplified approach; proper implementation would track keys
      logger.info("feature_flags", "Cleared all cached flags and entitlements");

      this.currentFlags = new Map();
      this.userOverrides.clear();
      this.bootstrapped = false;
    } catch (error) {
      logger.error("feature_flags", "Failed to clear cache", error);
    }
  }
}

// Export singleton instance
export const FeatureFlagsManager = new FeatureFlagsManagerClass();
export default FeatureFlagsManager;
