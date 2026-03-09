/**
 * Server Sync: Entitlement & Clock Verification
 *
 * Handles premium entitlement checks, device clock integrity verification,
 * and user role resolution from cached entitlements.
 *
 * Security policy: fail-secure (deny access if clock is invalid or server unavailable).
 */
import { getAppConfig } from "@/config";
import { fetchEntitlementsByUserId } from "@/lib/database/entitlements";
import { getDatabase } from "@/lib/middleware/services/database-service";
import { StorageManager } from "@/lib/storage";
import { logger } from "@/lib/utils/logger";
import { STORAGE_KEYS } from "@/maps";
import { isOverrideActive } from "./overrides";
import { type ServerSyncState } from "./state";

// ==========================================
// Clock Verification
// ==========================================

function getClockSkewToleranceMs(): number {
  const config = getAppConfig();
  return config.remoteConfig?.clockSkewToleranceMs || 60 * 1000;
}

export async function checkClockValidity(state: ServerSyncState): Promise<boolean> {
  try {
    const clockInvalid = await StorageManager.get<{ detected: number; skew: number }>(
      STORAGE_KEYS.CLOCK_INVALID,
    );
    return !!clockInvalid;
  } catch {
    return false;
  }
}

export async function verifyDeviceClock(_state: ServerSyncState): Promise<boolean> {
  try {
    const lastCheck = await StorageManager.get<{ timestamp: number }>(
      "dnd:last_clock_check",
    );

    if (!lastCheck?.timestamp) {
      await StorageManager.set("dnd:last_clock_check", { timestamp: Date.now() });
      return true;
    }

    const now = Date.now();
    const skew = lastCheck.timestamp - now;
    const tolerance = getClockSkewToleranceMs();

    if (skew > tolerance) {
      logger.category("feature_flags").error("Clock manipulation detected", { skew, tolerance });
      await StorageManager.set(STORAGE_KEYS.CLOCK_INVALID, { detected: now, skew });
      return false;
    }

    await StorageManager.set("dnd:last_clock_check", { timestamp: now });
    return true;
  } catch (error) {
    logger.category("feature_flags").error("Clock verification failed", error);
    return true; // Default to valid (don't block on verification error)
  }
}

// ==========================================
// User Role Resolution
// ==========================================

export function getCachedUserRole(state: ServerSyncState): string {
  const knownRoles = ["admin", "moderator", "premium_user", "vip"];

  for (const entitlement of state.cachedEntitlements.values()) {
    if (knownRoles.includes(entitlement.key)) {
      if (entitlement.expires_at) {
        const expiryTime = new Date(entitlement.expires_at).getTime();
        if (expiryTime < Date.now()) continue;
      }
      logger.category("feature_flags").warn(`Found cached user role: ${entitlement.key}`);
      return entitlement.key;
    }
  }

  logger.category("feature_flags").warn("No cached user role found, using 'unknown'");
  return "unknown";
}

// ==========================================
// Entitlement Checking
// ==========================================

export async function getEntitlement(
  state: ServerSyncState,
  name: string,
  userId: string,
): Promise<{ granted: boolean; source: string; expiresAt?: string | null }> {
  // Priority 1: local user override (admin testing)
  const overrideKey = `${userId}:${name}`;
  if (state.userOverrides.has(overrideKey)) {
    const value = state.userOverrides.get(overrideKey) ?? false;
    logger.category("feature_flags").warn(`Entitlement ${name} from override: ${value}`);
    return { granted: value, source: "override", expiresAt: undefined };
  }

  // Check clock validity before granting access (fail-secure)
  const clockInvalid = await checkClockValidity(state);
  if (clockInvalid) {
    logger.category("feature_flags").warn("Device clock invalid, denying entitlement", { name });
    return { granted: false, source: "clock_invalid", expiresAt: undefined };
  }

  // Priority 1.5: remote entitlement override (admin-controlled, per-user)
  const remoteOverride = state.remoteEntitlementOverrides.get(name);
  if (remoteOverride && isOverrideActive(remoteOverride.expires_at, remoteOverride.revoked)) {
    const granted = remoteOverride.action === "grant";
    logger.category("feature_flags").warn(`Entitlement ${name} from remote override: ${granted}`);
    return { granted, source: "remote_override", expiresAt: remoteOverride.expires_at };
  }

  // Priority 2: in-memory cache (event-driven, stays fresh via Realtime)
  const cached = state.cachedEntitlements.get(name);

  if (cached) {
    const isExpired =
      cached.expires_at !== null && new Date(cached.expires_at).getTime() <= Date.now();

    if (!isExpired) {
      logger.category("feature_flags").debug(`Entitlement ${name} from cache: true`, {
        expiresAt: cached.expires_at,
      });
      return { granted: true, source: "cache", expiresAt: cached.expires_at };
    }

    // Cache expired: try fresh server check (security verification)
    logger.category("feature_flags").warn(
      `Entitlement ${name} has expired, verifying with server`,
    );
    try {
      if (!getDatabase().isConfigured()) {
        logger.category("feature_flags").warn(
          `Entitlement ${name} expired and offline, denying`,
        );
        return { granted: false, source: "expired_offline", expiresAt: cached.expires_at };
      }

      const entitlements = await fetchEntitlementsByUserId(userId);
      const fresh = entitlements.find((e) => e.key === name);

      let granted = false;
      if (fresh) {
        granted =
          fresh.expires_at === null || new Date(fresh.expires_at).getTime() > Date.now();
      }

      if (fresh && state.userId) {
        state.cachedEntitlements.set(name, fresh);
        await StorageManager.set(
          `${STORAGE_KEYS.ENTITLEMENTS}:${state.userId}`,
          Object.fromEntries(state.cachedEntitlements),
        );
      } else if (fresh) {
        state.cachedEntitlements.set(name, fresh);
      }

      if (!fresh) {
        state.cachedEntitlements.delete(name);
      }

      logger.category("feature_flags").warn(`Entitlement ${name} verified: ${granted}`, {
        expiresAt: fresh?.expires_at,
      });
      return { granted, source: "server", expiresAt: fresh?.expires_at };
    } catch (error) {
      logger.category("feature_flags").warn(
        `Fresh entitlement check failed for ${name}, expired and offline, denying`,
        error,
      );
      return { granted: false, source: "expired_offline", expiresAt: cached.expires_at };
    }
  }

  // No cache: try fresh server query
  if (!getDatabase().isConfigured()) {
    logger.category("feature_flags").warn(`Entitlement ${name}: no cache and offline, denying`);
    return { granted: false, source: "server_unavailable", expiresAt: undefined };
  }

  try {
    const entitlements = await fetchEntitlementsByUserId(userId);
    const entitlement = entitlements.find((e) => e.key === name);

    let granted = false;
    if (entitlement) {
      granted =
        entitlement.expires_at === null ||
        new Date(entitlement.expires_at).getTime() > Date.now();
      state.cachedEntitlements.set(name, entitlement);
      if (state.userId) {
        await StorageManager.set(
          `${STORAGE_KEYS.ENTITLEMENTS}:${state.userId}`,
          Object.fromEntries(state.cachedEntitlements),
        );
      }
    }

    logger.category("feature_flags").warn(`Entitlement ${name} from server: ${granted}`, {
      expiresAt: entitlement?.expires_at,
    });
    return { granted, source: "server", expiresAt: entitlement?.expires_at };
  } catch (error) {
    logger.category("feature_flags").warn(`Server check failed for ${name}, denying access`, error);
    return { granted: false, source: "server_unavailable", expiresAt: undefined };
  }
}
