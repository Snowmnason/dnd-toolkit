/**
 * Feature Flags Manager — Orchestrator for feature flags
 *
 * Wraps both:
 * - FeatureFlags (config-driven, offline safety net)
 * - FeatureFlagsManager (server-driven, online)
 *
 * Strategy:
 * - Online: Server flags take priority (conditions, cohorts, overrides)
 * - Offline / pre-bootstrap: Config flags provide the default values
 *
 * Public API for hooks and managers. Never call the singletons directly.
 */

import { logger } from '@/lib/utils/logger';
import { type FlagContext } from './evaluation/conditions';
import type { FeatureFlagKind, FeatureFlagName } from './local-flags';
import { FeatureFlags } from './local-flags';
import { FeatureFlagsManager } from './server-sync/orchestrator';

// ─── Initialization ──────────────────────────────────────────────────────────

/**
 * Initialize the feature flags system.
 * Called by AppKernel during bootstrap.
 * 
 * Does NOT require Supabase client — realtime subscriptions will lazily
 * obtain the provider internally if available.
 */
export async function initialize(userId?: string): Promise<void> {
  try {
    await FeatureFlagsManager.initialize(userId);
    logger.category('bootstrap').info('Feature flags initialized (server-driven + config fallback)');
  } catch (error) {
    logger.category('feature_flags').warn('Server-driven flags failed to initialize; using config fallback', error);
  }
}

/**
 * Bootstrap flags from server (fetch once at startup).
 * Non-blocking; logs errors, never throws.
 */
export async function bootstrapFlags(): Promise<void> {
  try {
    await FeatureFlagsManager.bootstrapFlags();
  } catch (error) {
    logger.category('feature_flags').debug('Server bootstrap failed; config flags remain active', error);
  }
}

/**
 * Verify device clock is in sync with server (±60s tolerance).
 * Returns true if safe; assumes safe on error to avoid blocking the app.
 */
export async function verifyDeviceClock(): Promise<boolean> {
  try {
    return await FeatureFlagsManager.verifyDeviceClock();
  } catch (error) {
    logger.category('feature_flags').warn('Device clock verification failed', error);
    return true;
  }
}

// ─── Flag Checks ─────────────────────────────────────────────────────────────

/**
 * Check if a flag is enabled (synchronous).
 *
 * Passes the config-driven value as the server manager's fallback — so before
 * bootstrap (empty server map), config defaults apply automatically.
 * After bootstrap, server value takes priority.
 */
export function getFlag(name: string, fallback = false): boolean {
  const configDefault = FeatureFlags.isEnabled(name as FeatureFlagName);
  return FeatureFlagsManager.getFlag(name, configDefault ?? fallback);
}

/**
 * Check if a flag is enabled with context conditions (platform, environment, userRole).
 *
 * Uses server flags if bootstrapped (conditions evaluated server-side).
 * Falls back to config flags if not bootstrapped (conditions ignored offline).
 */
export function isEnabledWithContext(name: string, context?: FlagContext): boolean {
  const serverFlags = FeatureFlagsManager.getAllFlags();
  if (name in serverFlags) {
    return FeatureFlagsManager.isEnabledWithContext(name, context);
  }
  return FeatureFlags.isEnabled(name as FeatureFlagName);
}

/**
 * Get all flags. Returns server flags when bootstrapped, config flags otherwise.
 */
export function getAllFlags(): Record<string, any> {
  const serverFlags = FeatureFlagsManager.getAllFlags();
  return Object.keys(serverFlags).length > 0 ? serverFlags : FeatureFlags.getAllFlags();
}

/**
 * Get flag kind/classification (free/premium/beta).
 */
export function getKind(name: string): FeatureFlagKind | undefined {
  const serverFlags = FeatureFlagsManager.getAllFlags();
  const serverFlag = Object.entries(serverFlags).find(([k]) => k === name)?.[1];
  return (serverFlag as any)?.kind ?? FeatureFlags.getKind(name as FeatureFlagName);
}

/**
 * Get all flags of a specific kind.
 */
export function getByKind(kind: FeatureFlagKind): Record<string, any> {
  return Object.fromEntries(
    Object.entries(getAllFlags()).filter(([, flag]) => (flag as any).kind === kind)
  );
}

// ─── Entitlements ────────────────────────────────────────────────────────────

/**
 * Check if user has access to a specific entitlement.
 * Always a fresh server check — no offline fallback (requires server verification).
 * Denies access on error (fail-secure).
 */
export async function getEntitlement(
  key: string,
  userId: string,
): Promise<{ granted: boolean; source: string; expiresAt?: string | null }> {
  try {
    return await FeatureFlagsManager.getEntitlement(key, userId);
  } catch (error) {
    logger.category('feature_flags').warn(`getEntitlement("${key}"): server check failed`, error);
    return { granted: false, source: 'error', expiresAt: undefined };
  }
}

// ─── Admin Overrides (dev/testing only) ──────────────────────────────────────

export function setOverride(key: string, value: boolean): void {
  FeatureFlagsManager.setOverride(key, value);
}

export function clearOverride(key: string): void {
  FeatureFlagsManager.clearOverride(key);
}

export function clearAllOverrides(): void {
  FeatureFlagsManager.clearAllOverrides();
}

// ─── Dev Toggles (console only) ──────────────────────────────────────────────

export function toggle(name: string, enabled: boolean): void {
  FeatureFlags.toggle(name as FeatureFlagName, enabled);
}

export function toggleKind(kind: FeatureFlagKind, enabled: boolean): void {
  FeatureFlags.toggleKind(kind, enabled);
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

/**
 * Subscribe to flag changes — both server updates and dev console toggles.
 * Returns an unsubscribe function.
 */
export function subscribe(callback: (flags: Record<string, any>) => void): () => void {
  const unsubscribeServer = FeatureFlagsManager.subscribe(callback);
  // Config flags change via dev console (toggle/toggleKind) — notify with current flags
  const unsubscribeConfig = FeatureFlags.subscribe(() => callback(FeatureFlags.getAllFlags()));
  return () => {
    unsubscribeServer();
    unsubscribeConfig();
  };
}

// ─── Sync ────────────────────────────────────────────────────────────────────

/**
 * Sync config-driven flags with server-resolved values.
 * Called after server bootstrap so config singleton reflects server state.
 * @internal Used by bootstrap process
 */
export function syncFromServer(serverFlags: Record<string, any>): void {
  FeatureFlags.syncFromServer(serverFlags);
}
