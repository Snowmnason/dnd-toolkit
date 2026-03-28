/**
 * Server Sync: Flag Evaluation
 *
 * Resolves flag states considering conditions, cohorts, dependencies with full override priority.
 * Uses an LRU evaluation cache (outer) and per-call memo map (inner, for recursive deps).
 * Also exports cohort slug resolution and flag dependency validation.
 */
import { getAppConfig, getPlatformName } from "@/config";
import { logger } from "@/lib/utils/logger";
import { isUserInCohort } from "@/pure-algo-immutables";
import type { CachedCohort, CachedUserCohortMembership } from "@/type-definitions/featureFlagTypes";
import { FlagEvaluationCache } from "../cache";
import { evaluateAdvancedCondition, validateAdvancedCondition } from "../evaluation/advanced-conditions";
import { evaluateConditions, type FlagContext } from "../evaluation/conditions";
import { getCachedUserRole } from "./entitlements";
import { getLocalFlagOverrideValue, getRemoteFlagOverrideValue } from "./overrides";
import { type ServerSyncState } from "./state";

// ==========================================
// Public: Flag Evaluation
// ==========================================

export function isEnabledWithContext(
  state: ServerSyncState,
  flagName: string,
  context: FlagContext = {},
): boolean {
  // Overrides bypass caching (avoid stale results on override expiry)
  const remoteOverrideValue = getRemoteFlagOverrideValue(state, flagName);
  if (remoteOverrideValue !== undefined) return remoteOverrideValue;

  const localOverrideValue = getLocalFlagOverrideValue(state, flagName);
  if (localOverrideValue !== undefined) return localOverrideValue;

  const platform = context.platform || getPlatformName();
  const environment = context.environment || getAppConfig().environment;
  const userRole = context.userRole || getCachedUserRole(state);

  const cachedResult = state.evaluationCache.getResult(flagName, platform, environment, userRole);
  if (cachedResult !== undefined) {
    logger.category("feature_flags").debug(`Flag evaluation cache hit: ${flagName}`);
    return cachedResult;
  }

  const resolvedContext: FlagContext = {
    platform: context.platform || platform,
    environment: context.environment || environment,
    userRole,
  };

  const callMemo = new Map<string, boolean>();
  const resolving = new Set<string>();
  const result = resolveFlag(state, flagName, resolvedContext, callMemo, resolving);

  state.evaluationCache.setResult(flagName, platform, environment, userRole, result);
  return result;
}

// ==========================================
// Public: Cohort Slug Resolution (used by realtime handlers too)
// ==========================================

export function resolveCohortSlug(
  membership: CachedUserCohortMembership,
  cachedCohorts: Map<string, CachedCohort>,
): string | undefined {
  if (membership.cohort_slug) return membership.cohort_slug;

  if (membership.cohort_id) {
    for (const [slug, cohort] of cachedCohorts.entries()) {
      if (cohort.id === membership.cohort_id) {
        logger.category("feature_flags").warn(
          `Resolved cohort slug from ID: ${membership.cohort_id} → ${slug}`,
        );
        return slug;
      }
    }
    logger.category("feature_flags").warn(
      `Failed to resolve cohort slug from ID: ${membership.cohort_id}`,
    );
  }

  return undefined;
}

// ==========================================
// Public: Dependency Validation
// ==========================================

export function validateFlagDependencies(state: ServerSyncState): void {
  const config = getAppConfig();
  const flags = config.featureFlags || {};

  if (Object.keys(flags).length === 0) return;

  const allFlagNames = new Set(Object.keys(flags));

  for (const [flagName, flagConfig] of Object.entries(flags)) {
    if (!flagConfig || typeof flagConfig !== "object") continue;

    if (flagConfig.conditionLogic) {
      const validationErrors = validateAdvancedCondition(flagConfig.conditionLogic as any);
      if (validationErrors.length > 0) {
        logger.category("feature_flags").warn(
          `Invalid conditionLogic for flag "${flagName}": ${validationErrors.join("; ")}`,
        );
      }
    }

    if (flagConfig.cohorts && Array.isArray(flagConfig.cohorts)) {
      for (const cohortSlug of flagConfig.cohorts) {
        if (!state.cachedCohorts.has(cohortSlug)) {
          logger.category("feature_flags").warn(
            `Flag "${flagName}" references unknown cohort "${cohortSlug}"`,
          );
        }
      }
    }

    if (flagConfig.dependsOn && Array.isArray(flagConfig.dependsOn)) {
      for (const depName of flagConfig.dependsOn) {
        if (!allFlagNames.has(depName)) {
          logger.category("feature_flags").warn(
            `Flag "${flagName}" depends on missing flag "${depName}"`,
          );
        }
      }
    }
  }

  for (const flagName of allFlagNames) {
    const cycle = detectCycle(flagName, flags, new Set(), new Set());
    if (cycle) {
      logger.category("feature_flags").warn(
        `Circular dependency detected: ${cycle.join(" → ")}`,
      );
    }
  }
}

// ==========================================
// Private: Recursive Flag Resolver
// ==========================================

function resolveFlag(
  state: ServerSyncState,
  flagName: string,
  context: FlagContext,
  memo: Map<string, boolean>,
  resolving: Set<string>,
): boolean {
  const cacheKey = FlagEvaluationCache.makeKey(
    flagName,
    context.platform || getPlatformName(),
    context.environment || getAppConfig().environment,
    context.userRole,
  );

  if (memo.has(cacheKey)) return memo.get(cacheKey)!;

  if (resolving.has(cacheKey)) {
    logger.category("feature_flags").warn(
      `Circular dependency detected for flag ${flagName}. Returning false to prevent infinite recursion.`,
    );
    memo.set(cacheKey, false);
    return false;
  }

  resolving.add(cacheKey);

  // Overrides apply even when evaluating as a dependency
  const remoteOverrideValue = getRemoteFlagOverrideValue(state, flagName);
  if (remoteOverrideValue !== undefined) {
    memo.set(cacheKey, remoteOverrideValue);
    return remoteOverrideValue;
  }

  const localOverrideValue = getLocalFlagOverrideValue(state, flagName);
  if (localOverrideValue !== undefined) {
    memo.set(cacheKey, localOverrideValue);
    return localOverrideValue;
  }

  const flagState = state.currentFlags.get(flagName);
  if (!flagState) {
    logger.category("feature_flags").warn(`Flag not found: ${flagName}, treating as disabled`);
    memo.set(cacheKey, false);
    return false;
  }

  if (!flagState.enabled) {
    memo.set(cacheKey, false);
    return false;
  }

  // Phase 3: cohort membership check (user must be in at least ONE required cohort)
  if (!checkCohorts(state, flagName)) {
    memo.set(cacheKey, false);
    return false;
  }

  const appConfig = getAppConfig();
  // eslint-disable-next-line security/detect-object-injection
  const hardcodedFlagConfig = appConfig.featureFlags?.[flagName];

  const flagConfig = {
    depends_on: flagState.depends_on || (typeof hardcodedFlagConfig === "object" && hardcodedFlagConfig !== null ? hardcodedFlagConfig.dependsOn : undefined),
    condition_logic: flagState.condition_logic,
    conditions: typeof hardcodedFlagConfig === "object" && hardcodedFlagConfig !== null ? hardcodedFlagConfig.conditions : undefined,
    dependsOn: flagState.depends_on || (typeof hardcodedFlagConfig === "object" && hardcodedFlagConfig !== null ? hardcodedFlagConfig.dependsOn : undefined),
    conditionLogic: flagState.condition_logic || (typeof hardcodedFlagConfig === "object" && hardcodedFlagConfig !== null ? hardcodedFlagConfig.conditionLogic : undefined),
  };

  if (!flagConfig.conditionLogic && !flagConfig.conditions && hardcodedFlagConfig) {
    Object.assign(flagConfig, {
      conditionLogic: typeof hardcodedFlagConfig === "object" && hardcodedFlagConfig !== null ? hardcodedFlagConfig.conditionLogic : undefined,
      conditions: typeof hardcodedFlagConfig === "object" && hardcodedFlagConfig !== null ? hardcodedFlagConfig.conditions : undefined,
    });
  }

  // Advanced condition logic (OR, NOT, nested)
  if (flagConfig.conditionLogic) {
    try {
      const validationErrors = validateAdvancedCondition(flagConfig.conditionLogic as any);
      if (validationErrors.length > 0) {
        logger.category("feature_flags").error(
          `Invalid conditionLogic for flag ${flagName}: ${validationErrors.join("; ")}`,
        );
        memo.set(cacheKey, false);
        return false;
      }
      if (!evaluateAdvancedCondition(flagConfig.conditionLogic as any, context)) {
        memo.set(cacheKey, false);
        return false;
      }
    } catch (error) {
      logger.category("feature_flags").error(
        `Error evaluating advanced conditions for ${flagName}: ${error}`,
      );
      memo.set(cacheKey, false);
      return false;
    }
  } else if (flagConfig.conditions) {
    // Simple conditions (AND logic)
    if (!evaluateConditions(flagConfig.conditions, context)) {
      memo.set(cacheKey, false);
      return false;
    }
  }

  // Dependency chain (all deps must be enabled)
  if (flagConfig.dependsOn && flagConfig.dependsOn.length > 0) {
    for (const depName of flagConfig.dependsOn) {
      const depEnabled = resolveFlag(state, depName, context, memo, resolving);
      if (!depEnabled) {
        logger.category("feature_flags").warn(
          `Flag ${flagName} disabled: dependency ${depName} is disabled`,
        );
        memo.set(cacheKey, false);
        return false;
      }
    }
  }

  memo.set(cacheKey, true);
  return true;
}

// ==========================================
// Private: Cohort Check
// ==========================================

function checkCohorts(state: ServerSyncState, flagName: string): boolean {
  let requiredCohorts: string[] | undefined;

  const serverAssignments = state.cachedCohortAssignments.get(flagName);
  if (serverAssignments && serverAssignments.size > 0) {
    requiredCohorts = Array.from(serverAssignments);
    logger.category("feature_flags").debug(
      `Using server assignments for flag ${flagName}: ${requiredCohorts.join(", ")}`,
    );
  } else {
    const appConfig = getAppConfig();
    // eslint-disable-next-line security/detect-object-injection
    const flagConfig = appConfig.featureFlags?.[flagName];
    if (typeof flagConfig !== "object" || flagConfig === null || !flagConfig?.cohorts?.length) return true;
    requiredCohorts = flagConfig.cohorts;
    logger.category("feature_flags").debug(
      `Using app config cohorts for flag ${flagName}: ${requiredCohorts.join(", ")}`,
    );
  }

  if (!requiredCohorts?.length) return true;

  // Check explicit membership first (highest priority)
  for (const membership of state.cachedUserCohortMemberships) {
    const cohortSlug = resolveCohortSlug(membership, state.cachedCohorts);
    if (
      cohortSlug &&
      requiredCohorts.includes(cohortSlug) &&
      membership.is_active !== false &&
      (!membership.expires_at || new Date(membership.expires_at) > new Date())
    ) {
      logger.category("feature_flags").debug(
        `User explicitly in cohort ${cohortSlug} for flag ${flagName}`,
      );
      return true;
    }
  }

  if (!state.userId) return false;

  // Check deterministic bucketing
  for (const cohortSlug of requiredCohorts) {
    const cohort = state.cachedCohorts.get(cohortSlug);
    if (!cohort?.is_active) continue;
    if (isUserInCohort(state.userId, cohort)) {
      logger.category("feature_flags").debug(
        `User bucketed into cohort ${cohortSlug} for flag ${flagName}`,
      );
      return true;
    }
  }

  return false;
}

// ==========================================
// Private: Cycle Detection
// ==========================================

function detectCycle(
  flagName: string,
  flags: Record<string, any>,
  visited: Set<string>,
  stackSet: Set<string>,
): string[] | null {
  visited.add(flagName);
  stackSet.add(flagName);

  // eslint-disable-next-line security/detect-object-injection
  const flagConfig = flags[flagName] as any;
  if (!flagConfig?.dependsOn || !Array.isArray(flagConfig.dependsOn)) {
    stackSet.delete(flagName);
    return null;
  }

  for (const depName of flagConfig.dependsOn) {
    if (!visited.has(depName)) {
      const cycle = detectCycle(depName, flags, visited, stackSet);
      if (cycle) return [flagName, ...cycle];
    } else if (stackSet.has(depName)) {
      return [flagName, depName];
    }
  }

  stackSet.delete(flagName);
  return null;
}
