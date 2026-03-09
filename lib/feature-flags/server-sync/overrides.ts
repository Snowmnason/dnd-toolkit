/**
 * Server Sync: Override Management
 *
 * Handles local/remote flag and entitlement override resolution,
 * row normalization from Realtime/Edge Function payloads,
 * and percentage-based rollout evaluation.
 *
 * Priority: local admin override > remote server override > flag value
 */
import { trackVariantAssignment } from "@/lib/analytics/variant-tracking";
import type { FeatureFlagOverrideRow } from "@/lib/database/feature-flag-overrides";
import { logger } from "@/lib/utils/logger";
import { isInRolloutMemoized } from "@/pure-algo-immutables";
import type { EdgeEntitlementOverrideRow } from "@/type-definitions/featureFlagTypes";
import { notifySubscribers, type ServerSyncState } from "./state";

// ==========================================
// Pure Helpers
// ==========================================

export function isOverrideActive(
  expiresAt: string | null | undefined,
  revoked: boolean | undefined,
): boolean {
  if (revoked) return false;
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > Date.now();
}

export function getRemoteFlagOverrideValue(
  state: ServerSyncState,
  flagName: string,
): boolean | undefined {
  const remoteOverride = state.remoteOverrides.get(flagName);
  if (!remoteOverride) return undefined;
  if (!isOverrideActive(remoteOverride.expires_at, remoteOverride.revoked)) return undefined;
  return remoteOverride.enabled;
}

export function getLocalFlagOverrideValue(
  state: ServerSyncState,
  flagName: string,
): boolean | undefined {
  if (!state.userOverrides.has(flagName)) return undefined;
  return state.userOverrides.get(flagName);
}

export function normalizeFlagOverrideRow(row: any): FeatureFlagOverrideRow | null {
  if (!row) return null;

  // Edge Function synthetic shape
  if (row.target_type === "flag" && typeof row.target_name === "string") {
    return row as FeatureFlagOverrideRow;
  }

  // DB Realtime shape: feature_flags.feature_flag_overrides
  if (typeof row.flag_name === "string") {
    return {
      id: String(row.id),
      user_id: String(row.user_id),
      target_type: "flag",
      target_name: String(row.flag_name),
      enabled: !!row.enabled,
      expires_at: row.expires_at ?? null,
      revoked: !!row.revoked,
      reason: row.reason ?? undefined,
      created_by: row.created_by ?? null,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  }

  return null;
}

export function normalizeEntitlementOverrideRow(row: any): EdgeEntitlementOverrideRow | null {
  if (!row) return null;

  // Edge Function synthetic shape
  if (row.target_type === "entitlement" && typeof row.target_name === "string") {
    return row as EdgeEntitlementOverrideRow;
  }

  // DB Realtime shape: feature_flags.entitlements_overrides
  if (typeof row.entitlement_key === "string") {
    const isActive = !!row.is_active;
    return {
      id: String(row.id),
      user_id: String(row.user_id),
      target_type: "entitlement",
      target_name: String(row.entitlement_key),
      action: isActive ? "grant" : "revoke",
      enabled: isActive,
      expires_at: row.expires_at ?? null,
      revoked: !!row.revoked,
      reason: row.reason ?? undefined,
      created_by: row.created_by ?? null,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  }

  return null;
}

// ==========================================
// Override Management
// ==========================================

export function setOverride(state: ServerSyncState, key: string, value: boolean): void {
  state.userOverrides.set(key, value);
  logger.category("feature_flags").info(`Override set: ${key} = ${value}`);
  if (!key.includes(":")) {
    state.evaluationCache.invalidateFlag(key);
    notifySubscribers(state);
  }
}

export function clearOverride(state: ServerSyncState, key: string): void {
  state.userOverrides.delete(key);
  logger.category("feature_flags").info(`Override cleared: ${key}`);
  if (!key.includes(":")) {
    state.evaluationCache.invalidateFlag(key);
    notifySubscribers(state);
  }
}

export function clearAllOverrides(state: ServerSyncState): void {
  state.userOverrides.clear();
  logger.category("feature_flags").info("All overrides cleared");
  state.evaluationCache.clear();
  notifySubscribers(state);
}

// ==========================================
// Rollout Evaluation
// ==========================================

export async function evaluateRollout(
  state: ServerSyncState,
  userId: string,
  flagName: string,
  fallback: boolean = false,
): Promise<boolean> {
  // Priority 1: remote override takes precedence over rollout
  const remoteOverride = state.remoteOverrides.get(flagName);
  if (remoteOverride && !remoteOverride.revoked) {
    if (
      remoteOverride.expires_at === null ||
      new Date(remoteOverride.expires_at).getTime() > Date.now()
    ) {
      logger.category("feature_flags").warn(
        `Rollout ${flagName}: remote override exists, skipping rollout evaluation`,
      );
      return remoteOverride.enabled;
    }
  }

  // Priority 2: local override takes precedence
  if (state.userOverrides.has(flagName)) {
    logger.category("feature_flags").warn(
      `Rollout ${flagName}: local override exists, skipping rollout evaluation`,
    );
    return state.userOverrides.get(flagName) ?? fallback;
  }

  // Priority 3: evaluate rollout config
  const rolloutConfig = state.cachedRollouts.get(flagName);
  if (rolloutConfig) {
    const inRollout = isInRolloutMemoized(
      userId,
      flagName,
      rolloutConfig.percentage,
      rolloutConfig.seed,
    );

    logger.category("feature_flags").warn(
      `Rollout ${flagName}: user=${userId}, percentage=${rolloutConfig.percentage}%, in_rollout=${inRollout}`,
    );

    const variant = inRollout ? "B" : "A";
    trackVariantAssignment({
      flagName,
      variant,
      userId,
      percentage: rolloutConfig.percentage,
      context: { rollout_type: "feature_flag", in_rollout: inRollout },
    });

    return inRollout;
  }

  logger.category("feature_flags").warn(
    `Rollout ${flagName}: no config, using fallback=${fallback}`,
  );
  return fallback;
}
