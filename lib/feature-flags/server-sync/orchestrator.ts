/**
 * Server Sync: Orchestrator
 *
 * Thin class facade that holds shared state and delegates each method to
 * its domain module (bootstrap, evaluation, entitlements, overrides, realtime).
 *
 * External callers MUST use this class — never import sub-modules directly.
 * Used by: lib/feature-flags/feature-flags-manager.ts, system/Kernel/app-kernel.ts
 *
 * @internal For server-driven flags only. Use feature-flags-manager.ts for the public API.
 */
import { logger } from "@/lib/utils/logger";
import type {
  CachedRolloutConfig,
  FeatureFlagState,
  FlagsSubscriber,
} from "@/type-definitions/featureFlagTypes";
import { getCachedUserRole, getEntitlement } from "./entitlements";
import { isEnabledWithContext, validateFlagDependencies } from "./evaluation";
import {
  clearAllOverrides,
  clearOverride,
  setOverride,
} from "./overrides";
import { createInitialState, type ServerSyncState } from "./state";

class FeatureFlagsManagerClass {
  // State is public so tests can access internals via `(FeatureFlagsManager as any).state.xxx`
  public state: ServerSyncState = createInitialState();

  // ─── Flag Evaluation ────────────────────────────────────────────────────────

  getFlag(flagName: string, fallback: boolean = false): boolean {
    if (!this.state.bootstrapped) return fallback;
    if (!this.state.currentFlags.has(flagName)) return fallback;
    return this.isEnabledWithContext(flagName);
  }

  isEnabledWithContext(flagName: string, context: Record<string, any> = {}): boolean {
    return isEnabledWithContext(this.state, flagName, context);
  }

  getAllFlags(): Record<string, FeatureFlagState> {
    return Object.fromEntries(this.state.currentFlags);
  }

  getRollouts(): Record<string, CachedRolloutConfig> {
    return Object.fromEntries(this.state.cachedRollouts);
  }

  // ─── Overrides ──────────────────────────────────────────────────────────────

  setOverride(key: string, value: boolean): void {
    setOverride(this.state, key, value);
  }

  clearOverride(key: string): void {
    clearOverride(this.state, key);
  }

  clearAllOverrides(): void {
    clearAllOverrides(this.state);
  }

  // ─── Subscriptions ──────────────────────────────────────────────────────────

  subscribe(callback: FlagsSubscriber): () => void {
    this.state.subscribers.add(callback);
    return () => {
      this.state.subscribers.delete(callback);
    };
  }

  // ─── Entitlements ───────────────────────────────────────────────────────────

  async getEntitlement(
    name: string,
    userId: string,
  ): Promise<{ granted: boolean; source: string; expiresAt?: string | null }> {
    return getEntitlement(this.state, name, userId);
  }

  getCachedUserRole(): string {
    return getCachedUserRole(this.state);
  }

  // ─── Cache Invalidation ─────────────────────────────────────────────────────

  invalidateFlagCache(flagName: string): void {
    this.state.evaluationCache.invalidateFlag(flagName);
    logger.category("feature_flags").warn(
      `Invalidated evaluation cache for flag: ${flagName}`,
    );
  }

  invalidateRoleCache(userRole: string): void {
    this.state.evaluationCache.invalidateRole(userRole);
    logger.category("feature_flags").warn(
      `Invalidated evaluation cache for role: ${userRole}`,
    );
  }

  clearEvaluationCache(): void {
    this.state.evaluationCache.clear();
    logger.category("feature_flags").info("Cleared all evaluation cache entries");
  }

  getEvaluationCacheStats() {
    return this.state.evaluationCache.getStats();
  }

  // ─── Validation ─────────────────────────────────────────────────────────────

  validateFlagDependencies(): void {
    validateFlagDependencies(this.state);
  }
}

/**
 * Singleton instance. External callers use this only through feature-flags-manager.ts.
 */
export const FeatureFlagsManager = new FeatureFlagsManagerClass();
export default FeatureFlagsManager;
