/**
 * Feature Flag Service — Middleware between feature-flags modules and System/Services adapters
 *
 * This is the ONLY file in lib/feature-flags that accesses the database provider
 * for realtime subscription provisioning.
 *
 * Middleware Responsibilities:
 * - Precondition: Check network connectivity
 *   → If offline: signal callers to fall back to config-based (local) flags
 * - Precondition: Check database provider is configured
 *   → If not configured: signal callers to use config-based flags
 * - Provide raw realtime client via the DatabaseProvider escape hatch
 *   → No direct Supabase imports — provider is resolved through the adapter
 *
 * Does NOT:
 * - Evaluate flags (that stays in lib/feature-flags/server-sync/evaluation.ts)
 * - Manage flag state (that stays in lib/feature-flags/server-sync/state.ts)
 * - Bootstrap flags (that stays in lib/feature-flags/server-sync/bootstrap.ts)
 */

import { logger } from '@/lib/utils/logger';
import { ConnectionQuality, NetworkDetection } from '@/system/Network';
import { getDatabaseProvider } from '@/system/Services';

// ─── Realtime Provider ─────────────────────────────────────────────

export interface RealtimeProviderResult {
  /** Whether a realtime provider is available and the app should use server-driven flags. */
  available: boolean;
  /** The raw realtime client (Supabase SupabaseClient), or null if unavailable. */
  client: any | null;
  /** Human-readable reason when unavailable — for logging only. */
  reason?: 'offline' | 'not-configured' | 'no-raw-client';
}

/**
 * Get the realtime provider client for feature flag subscriptions.
 *
 * Returns `available: false` when:
 * - Network is offline  → caller should use config-based (local) feature flags
 * - Provider not configured → caller should use config-based (local) feature flags
 *
 * Returns `available: true` with a raw client when server-driven flags can be used.
 *
 * @example
 * const { available, client } = getRealtimeProvider();
 * if (!available) {
 *   logger.debug('Using local config flags (no network/provider)');
 *   return;
 * }
 * const channel = client.channel('feature_flags:...');
 */
export function getRealtimeProvider(): RealtimeProviderResult {
  const networkStatus = NetworkDetection.getStatus();
  if (networkStatus.connectionQuality === ConnectionQuality.OFFLINE) {
    logger.category('feature_flags').debug(
      '[feature-flag-service] Network offline — falling back to config-based flags'
    );
    return { available: false, client: null, reason: 'offline' };
  }

  const db = getDatabaseProvider();
  if (!db.isConfigured()) {
    logger.category('feature_flags').debug(
      '[feature-flag-service] Database provider not configured — falling back to config-based flags'
    );
    return { available: false, client: null, reason: 'not-configured' };
  }

  const rawClient = db.getRawClient?.();
  if (!rawClient) {
    logger.category('feature_flags').warn(
      '[feature-flag-service] Database provider has no raw client — falling back to config-based flags'
    );
    return { available: false, client: null, reason: 'no-raw-client' };
  }

  return { available: true, client: rawClient };
}

/**
 * Check if server-driven feature flags are available.
 * Lightweight check — use getRealtimeProvider() when you need the client.
 */
export function isServerFlagsAvailable(): boolean {
  const networkStatus = NetworkDetection.getStatus();
  if (networkStatus.connectionQuality === ConnectionQuality.OFFLINE) return false;
  return getDatabaseProvider().isConfigured();
}
