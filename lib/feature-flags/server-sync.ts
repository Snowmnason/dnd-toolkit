/**
 * Feature Flags Manager
 *
 * Manages runtime feature flags and premium entitlements with:
 * - Server sync (refresh from Edge Function)
 * - FastCache persistence for flags (unencrypted, fast)
 * - SecureStorage persistence for entitlements (encrypted, TTL-aware)
 * - Clock manipulation detection (fail-secure on backward clock)
 * - Offline graceful degradation
 */

import { CircuitBreakerManager } from "@/lib/api/circuit-breaker";
import { getFeatureFlagsFromServer } from "./remote";
import { QueryCache } from "@/lib/cache";
import { FastCache } from "@/lib/storage";
import { SecureStorage, STORAGE_KEYS } from "@/lib/storage";
import { logger } from "@/lib/utils/logger";

// ==========================================
// Types
// ==========================================

export interface FeatureFlagsData {
  flags: Record<string, { enabled: boolean; ttlMs?: number }>;
  fetchedAt: number;
  ttlMs?: number;
  etag?: string;
  version?: string;
}

export interface EntitlementsData {
  entitlements: Record<
    string,
    { granted: boolean; expiresAt?: string | null }
  >;
  fetchedAt: number;
  expiresAt?: string;
  lastVerifiedAt: number; // For clock manipulation detection
}

export type FlagsSubscriber = (flags: FeatureFlagsData) => void;

// ==========================================
// Configuration
// ==========================================

const CLOCK_SKEW_TOLERANCE_MS = 60 * 1000; // 60 seconds (configurable per RFC)
const CIRCUIT_BREAKER_KEY = "feature_flags:endpoint";

// ==========================================
// Feature Flags Manager
// ==========================================

class FeatureFlagsManagerClass {
  private subscribers: Set<FlagsSubscriber> = new Set();
  private supabaseClient: any = null;

  /**
   * Initialize with Supabase client
   * Called during app kernel bootstrap
   */
  async initialize(supabaseClient: any): Promise<void> {
    this.supabaseClient = supabaseClient;
    logger.debug("feature_flags", "FeatureFlagsManager initialized");
  }

  /**
   * Subscribe to flag updates
   * Called when flags are refreshed from server
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
  private notifySubscribers(flags: FeatureFlagsData): void {
    for (const callback of this.subscribers) {
      try {
        callback(flags);
      } catch (error) {
        logger.error("feature_flags", "Subscriber notification failed:", error);
      }
    }
  }

  /**
   * Refresh feature flags and entitlements from server
   * Non-blocking: returns silently on error, uses cache as fallback
   *
   * Integrates with CircuitBreaker to prevent retry storms
   * Respects ETag/version to avoid unnecessary downloads
   */
  async refreshFromServer(): Promise<void> {
    if (!this.supabaseClient) {
      logger.warn("feature_flags", "Supabase client not initialized");
      return;
    }

    try {
      // Check circuit breaker state
      const cbState = CircuitBreakerManager.getState(CIRCUIT_BREAKER_KEY);
      if (cbState === "Open") {
        logger.debug(
          "feature_flags",
          "Circuit breaker open for feature flags endpoint - using cache",
        );
        return; // Use cache silently
      }

      // Get current cache to extract ETag/version for change detection
      const cachedFlags = await FastCache.getJSON<FeatureFlagsData>(
        STORAGE_KEYS.FEATURE_FLAGS,
      );

      // Call Edge Function
      const response = await getFeatureFlagsFromServer(this.supabaseClient, {
        version: cachedFlags?.version,
        etag: cachedFlags?.etag,
      });

      // Handle 304 Not Modified or network error
      if (!response) {
        logger.debug(
          "feature_flags",
          "No new data from server (304 or error) - using cache",
        );
        CircuitBreakerManager.recordSuccess(CIRCUIT_BREAKER_KEY);
        return; // Use cache silently
      }

      // Record success for circuit breaker
      CircuitBreakerManager.recordSuccess(CIRCUIT_BREAKER_KEY);

      // Store flags to FastCache with per-flag TTL
      const flagsData: FeatureFlagsData = {
        flags: response.flags,
        fetchedAt: response.fetchedAt,
        etag: response.etag,
        version: response.version,
      };

      await FastCache.setJSON(STORAGE_KEYS.FEATURE_FLAGS, flagsData);
      logger.info("feature_flags", "Feature flags cached", {
        flagCount: Object.keys(response.flags).length,
      });

      // Store entitlements to SecureStorage (encrypted, TTL-aware)
      const entitlementsData: EntitlementsData = {
        entitlements: response.entitlements,
        fetchedAt: response.fetchedAt,
        lastVerifiedAt: Date.now(), // For clock manipulation detection
      };

      await SecureStorage.setJSON(STORAGE_KEYS.ENTITLEMENTS, entitlementsData);
      logger.info("feature_flags", "Entitlements cached", {
        entitlementCount: Object.keys(response.entitlements).length,
      });

      // Notify subscribers
      this.notifySubscribers(flagsData);
    } catch (error) {
      // Record failure for circuit breaker
      CircuitBreakerManager.recordFailure(CIRCUIT_BREAKER_KEY, false);

      logger.warn(
        "feature_flags",
        "Feature flags refresh failed (using cache as fallback):",
        error,
      );
      // Non-blocking: continue with cache
    }
  }

  /**
   * Get feature flag value
   * Respects TTL and offline state
   *
   * @param name - Flag name
   * @param fallback - Default value if flag not found (default: false)
   * @returns Flag value or fallback
   */
  async getFlag(name: string, fallback: boolean = false): Promise<boolean> {
    try {
      const cached = await FastCache.getJSON<FeatureFlagsData>(
        STORAGE_KEYS.FEATURE_FLAGS,
      );

      if (!cached || !cached.flags[name]) {
        logger.debug("feature_flags", `Flag not found: ${name}`, {
          fallback,
        });
        return fallback;
      }

      // Check if flag is stale
      const now = Date.now();
      const flagMeta = cached.flags[name];
      const ttlMs = flagMeta.ttlMs || 30 * 24 * 60 * 60 * 1000; // 30 days default
      const age = now - cached.fetchedAt;

      if (age > ttlMs) {
        logger.debug("feature_flags", `Flag is stale: ${name}`, {
          age,
          ttlMs,
        });
        // Stale but cached - use value but background refresh recommended
        // (background refresh would be done by calling refreshFromServer again)
      }

      const value = flagMeta.enabled;
      logger.debug("feature_flags", `Flag ${name}: ${value}`);
      return value;
    } catch (error) {
      logger.error("feature_flags", `Failed to get flag ${name}:`, error);
      return fallback;
    }
  }

  /**
   * Get entitlement status
   * Includes clock manipulation detection for security
   *
   * @param name - Entitlement name
   * @returns { granted, expiresAt? }
   */
  async getEntitlement(
    name: string,
  ): Promise<{ granted: boolean; expiresAt?: number }> {
    try {
      // First check for invalid clock flag
      const clockInvalid = await SecureStorage.getJSON<{
        detected: number;
        skew: number;
      }>(STORAGE_KEYS.CLOCK_INVALID);

      if (clockInvalid) {
        logger.warn("feature_flags", "Device clock marked as invalid", {
          skew: clockInvalid.skew,
        });
        return { granted: false }; // Fail-secure
      }

      const cached = await SecureStorage.getJSON<EntitlementsData>(
        STORAGE_KEYS.ENTITLEMENTS,
      );

      if (!cached || !cached.entitlements[name]) {
        logger.debug("feature_flags", `Entitlement not found: ${name}`);
        return { granted: false };
      }

      // Clock manipulation detection (fail-secure if clock went backward)
      const now = Date.now();
      const lastVerified = cached.lastVerifiedAt;

      if (lastVerified && now < lastVerified - CLOCK_SKEW_TOLERANCE_MS) {
        const skew = lastVerified - now;
        logger.error("feature_flags", "Clock manipulation detected", {
          name,
          skew,
          lastVerified,
          now,
        });

        // Mark clock as invalid for future checks
        await SecureStorage.setJSON(STORAGE_KEYS.CLOCK_INVALID, {
          detected: now,
          skew,
        });

        return { granted: false }; // Fail-secure: deny access
      }

      // Check expiry
      const entitlementData = cached.entitlements[name];
      if (!entitlementData.expiresAt) {
        // No expiry: entitlement is permanent
        logger.debug(
          "feature_flags",
          `Entitlement ${name}: granted (no expiry)`,
        );
        return { granted: entitlementData.granted };
      }

      const expiryTime = new Date(entitlementData.expiresAt).getTime();
      const isExpired = now >= expiryTime;

      if (isExpired) {
        logger.debug("feature_flags", `Entitlement ${name}: expired`, {
          expiryTime,
          now,
        });
        return { granted: false };
      }

      logger.debug("feature_flags", `Entitlement ${name}: granted`, {
        expiresAt: expiryTime,
      });

      return {
        granted: entitlementData.granted,
        expiresAt: expiryTime,
      };
    } catch (error) {
      logger.error("feature_flags", `Failed to get entitlement ${name}:`, error);
      return { granted: false };
    }
  }

  /**
   * Verify device clock validity (called early in app bootstrap)
   * Returns false if clock appears to have been manipulated backward
   */
  async verifyDeviceClock(): Promise<boolean> {
    try {
      const entitlements = await SecureStorage.getJSON<EntitlementsData>(
        STORAGE_KEYS.ENTITLEMENTS,
      );

      if (!entitlements?.lastVerifiedAt) {
        return true; // No baseline, allow
      }

      const lastVerified = entitlements.lastVerifiedAt;
      const now = Date.now();
      const skew = lastVerified - now;

      if (skew > CLOCK_SKEW_TOLERANCE_MS) {
        // Clock was set backward
        logger.error("feature_flags", "Device clock appears manipulated", {
          skew,
          tolerance: CLOCK_SKEW_TOLERANCE_MS,
        });

        // Lock out premium features
        await SecureStorage.setJSON(STORAGE_KEYS.CLOCK_INVALID, {
          detected: now,
          skew,
        });

        return false; // Clock invalid
      }

      return true; // Clock valid
    } catch (error) {
      logger.error("feature_flags", "Clock verification failed:", error);
      return true; // Default to valid (don't block on verification error)
    }
  }

  /**
   * Get cached flags data (for debugging/testing)
   */
  async getCachedFlags(): Promise<FeatureFlagsData | null> {
    return FastCache.getJSON<FeatureFlagsData>(STORAGE_KEYS.FEATURE_FLAGS);
  }

  /**
   * Get cached entitlements data (for debugging/testing)
   */
  async getCachedEntitlements(): Promise<EntitlementsData | null> {
    return SecureStorage.getJSON<EntitlementsData>(STORAGE_KEYS.ENTITLEMENTS);
  }

  /**
   * Clear all cached data (for logout scenarios)
   */
  async clearCache(): Promise<void> {
    try {
      await FastCache.removeItem(STORAGE_KEYS.FEATURE_FLAGS);
      await SecureStorage.removeItem(STORAGE_KEYS.ENTITLEMENTS);
      await SecureStorage.removeItem(STORAGE_KEYS.CLOCK_INVALID);
      logger.info("feature_flags", "Cleared all cached flags and entitlements");
    } catch (error) {
      logger.error("feature_flags", "Failed to clear cache:", error);
    }
  }
}

// Export singleton instance
export const FeatureFlagsManager = new FeatureFlagsManagerClass();
export default FeatureFlagsManager;
