/**
 * Cache Freshness Classification
 *
 * Classifies cache age into freshness tiers (fresh/stale/dead/none) that drive
 * bootstrap/sync strategies. Pure algorithm with optional config integration.
 *
 * Freshness Tiers:
 *   fresh  — age ≤ freshThreshold; TRUST it, skip network, present immediately
 *   stale  — freshThreshold < age ≤ deadThreshold; ACCEPT for startup + background refresh
 *   dead   — age > deadThreshold; REJECT it, clear storage, force re-fetch
 *   none   — cache miss or read error; NO data available
 *
 * Used by bootstrap, sync jobs, and any layer evaluating cache freshness without
 * coupling to domain-specific code. Suitable for flags, tokens, sync caches, etc.
 */

import { getAppConfig } from "@/config";
import { StorageManager } from "@/lib/storage/storage-manager";
import { STORAGE_KEYS } from "@/maps";

// ============================================================================
// TYPES
// ============================================================================

export type CacheFreshness = "fresh" | "stale" | "dead" | "none";

export interface FreshnessThresholds {
  /** Cache younger than this (ms) is "fresh" — trust it, skip network */
  freshThresholdMs: number;
  /** Cache older than this (ms) is "dead" — reject it, clear + re-fetch.
   *  Use Infinity to disable dead tier (only fresh/stale/none). */
  deadThresholdMs: number;
}

// ============================================================================
// PURE ALGORITHM
// ============================================================================

/**
 * Classify a cache age into a freshness tier.
 *
 * Pure function: only depends on ageMs and thresholds. No side effects.
 *
 * @param ageMs      - Cache age in milliseconds (Date.now() - fetchedAt).
 *                     Negative age (future timestamp) is treated as dead.
 * @param thresholds - Fresh and dead threshold boundaries
 * @returns Freshness tier: "fresh" | "stale" | "dead" | "none"
 */
export function classifyCacheAge(
  ageMs: number,
  thresholds: FreshnessThresholds,
): CacheFreshness {
  // Clamp negative ages (future timestamps due to clock skew) as dead
  if (ageMs < 0) return "dead";
  if (ageMs <= thresholds.freshThresholdMs) return "fresh";
  if (ageMs > thresholds.deadThresholdMs) return "dead";
  return "stale";
}

// ============================================================================
// FEATURE FLAGS INTEGRATION
// ============================================================================

const DEFAULT_FRESH_DAYS = 4; // Aligns with Supabase token TTL
const DEFAULT_DEAD_DAYS = 30; // Max offline duration

/**
 * Normalize day values from config, ensuring valid positive integers with fallback.
 */
function normalizeDays(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

/**
 * Read and normalize freshness thresholds from config.
 * Ensures freshness window is strictly below dead threshold.
 */
function getNormalizedFreshnessDays(): { freshDays: number; deadDays: number } {
  const config = getAppConfig();
  const deadDays = normalizeDays(
    config.featureFlags?.staleDays,
    DEFAULT_DEAD_DAYS,
  );
  const freshDays = normalizeDays(
    config.featureFlags?.freshnessDays,
    DEFAULT_FRESH_DAYS,
  );

  // Ensure strictness: freshnessDays must be < staleDays
  const final = freshDays < deadDays ? freshDays : Math.max(1, deadDays - 1);
  return { freshDays: final, deadDays };
}

/**
 * Get FRESH threshold in milliseconds.
 * Snapshots younger than this are trusted immediately.
 * Reads `featureFlags.freshnessDays` from config (default: 4 days).
 */
export function getFreshThresholdMs(): number {
  const { freshDays } = getNormalizedFreshnessDays();
  return freshDays * 24 * 60 * 60 * 1000;
}

/**
 * Get DEAD threshold in milliseconds.
 * Snapshots older than this must be cleared and re-fetched.
 * Reads `featureFlags.staleDays` from config (default: 30 days).
 */
export function getDeadThresholdMs(): number {
  const { deadDays } = getNormalizedFreshnessDays();
  return deadDays * 24 * 60 * 60 * 1000;
}

/**
 * Evaluate feature flags snapshot freshness from storage.
 *
 * Reads `STORAGE_KEYS.FEATURE_FLAGS` and classifies age:
 *   - age ≤ freshnessDays → "fresh"
 *   - age > staleDays     → "dead"
 *   - otherwise           → "stale"
 *   - no data or error    → "none"
 */
export async function evaluateSnapshotFreshness(): Promise<CacheFreshness> {
  try {
    const snapshot = await StorageManager.get<{ fetchedAt?: number }>(
      STORAGE_KEYS.FEATURE_FLAGS,
    );
    if (!snapshot?.fetchedAt) return "none";

    const ageMs = Date.now() - snapshot.fetchedAt;
    return classifyCacheAge(ageMs, {
      freshThresholdMs: getFreshThresholdMs(),
      deadThresholdMs: getDeadThresholdMs(),
    });
  } catch {
    return "none";
  }
}
