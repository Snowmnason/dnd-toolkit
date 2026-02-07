/**
 * Deterministic Rollout Bucketing
 *
 * Provides deterministic user bucketing for feature flag rollouts using FNV-1a hashing.
 * Same user always gets the same bucket for consistent variant assignment across app restarts.
 *
 * FNV-1a produces a uniform distribution across 0-99, enabling safe canary releases:
 * - 1% rollout → ~1% of users
 * - 10% rollout → ~10% of users
 * - 50% rollout → ~50% of users
 *
 * Seed enables rebalancing without changing flag name (useful for gradual migrations).
 */

/**
 * Deterministic hash function (FNV-1a 32-bit)
 *
 * Converts userId + flagName + seed into a bucket (0-99).
 * Same inputs always produce same bucket (deterministic).
 * Different seeds produce different but consistent buckets for rebalancing.
 *
 * @param userId - User ID (required, must be non-empty)
 * @param flagName - Feature flag name (required)
 * @param seed - Optional seed for rebalancing (e.g., "2026-02-07", version string)
 * @returns Hash bucket 0-99
 *
 * @example
 * ```ts
 * bucketPercent("user123", "dark_mode")  // Always returns same bucket for this user+flag
 * bucketPercent("user123", "dark_mode", "v1")  // Same bucket as long as seed is "v1"
 * bucketPercent("user123", "dark_mode", "v2")  // Different bucket if seed changes
 * ```
 */
export function bucketPercent(
  userId: string,
  flagName: string,
  seed = "",
): number {
  // Combine userId, flagName, and optional seed for bucketing
  // Format: "userId:flagName:seed" (seed empty OK)
  const input = `${userId}:${flagName}:${seed}`;

  // FNV-1a 32-bit hash algorithm
  // Start with FNV offset basis
  let hash = 2166136261 >>> 0; // FNV offset basis (unsigned 32-bit)

  // Hash each character
  for (let i = 0; i < input.length; i++) {
    // XOR with character code
    hash = hash ^ input.charCodeAt(i);
    // Multiply by FNV prime, keep as unsigned 32-bit
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  // Map 32-bit hash to 0-99 bucket
  return hash % 100;
}

/**
 * Rollout Config
 *
 * Server-side rollout configuration (returned by get_feature_flags Edge Function)
 */
export interface RolloutConfig {
  /** Percentage of users to include in rollout (0-100) */
  percentage: number;
  /** Optional seed for rebalancing users between rollouts */
  seed?: string;
}

/**
 * Check if user is in percentage-based rollout
 *
 * Deterministic evaluation: same user+flag+seed always returns same result.
 * Percentage clamped to 0-100 range; invalid percentages treated as 0% or 100%.
 *
 * **Resolution Order (in FeatureFlagsManager):**
 * 1. Override (admin testing)
 * 2. Entitlement (premium features)
 * 3. Rollout (gradual rollout) ← this function
 * 4. Global flag (all-or-nothing)
 *
 * @param userId - User ID for bucketing
 * @param flagName - Feature flag name
 * @param percentage - Rollout percentage (0-100). e.g., 50 = 50% of users
 * @param seed - Optional seed for rebalancing
 * @returns true if user is in rollout, false otherwise
 *
 * @example
 * ```ts
 * // Dark mode rollout for 50% of users
 * if (isInRollout(userId, "dark_mode", 50)) {
 *   applyDarkTheme();
 * }
 *
 * // Canary release: 10% of users see new endpoint
 * if (isInRollout(userId, "api_v2_endpoint", 10)) {
 *   callNewEndpoint();
 * } else {
 *   callLegacyEndpoint();
 * }
 *
 * // A/B testing: 50/50 split
 * const variant = isInRollout(userId, "ui_variant_b", 50) ? "B" : "A";
 *
 * // Route variant selection (navigation layer)
 * const component = isInRollout(userId, "characters_v2", 20)
 *   ? CharactersScreenV2
 *   : CharactersScreenV1; // Default
 * ```
 */
export function isInRollout(
  userId: string,
  flagName: string,
  percentage: number,
  seed = "",
): boolean {
  // Clamp percentage to valid range [0, 100]
  const clampedPercent = Math.max(0, Math.min(100, Math.floor(percentage)));

  // Get deterministic bucket for user+flag+seed
  const bucket = bucketPercent(userId, flagName, seed);

  // User is in rollout if bucket < clamped percentage
  // Example: percentage=50 → clamped=50 → user in rollout if bucket < 50 (0-49, ~50%)
  return bucket < clampedPercent;
}

/**
 * Memoization cache for bucketPercent results
 * Key format: "userId:flagName:seed"
 * Prevents redundant hash calculations during a session
 *
 * Note: This is per-session (cleared on app restart).
 * Safe to memoize because bucketPercent is deterministic (same inputs = same output).
 */
const bucketCache = new Map<string, number>();

/**
 * Get bucket with memoization (faster for repeated calls)
 *
 * **Use this instead of bucketPercent() when calling multiple times in same session.**
 *
 * @param userId - User ID for bucketing
 * @param flagName - Feature flag name
 * @param seed - Optional seed for rebalancing
 * @returns Memoized bucket (0-99)
 */
export function getBucketMemoized(
  userId: string,
  flagName: string,
  seed = "",
): number {
  const key = `${userId}:${flagName}:${seed}`;

  // Return cached value if available
  if (bucketCache.has(key)) {
    return bucketCache.get(key)!;
  }

  // Calculate, cache, and return
  const bucket = bucketPercent(userId, flagName, seed);
  bucketCache.set(key, bucket);
  return bucket;
}

/**
 * Clear memoization cache (useful for testing or session cleanup)
 */
export function clearBucketCache(): void {
  bucketCache.clear();
}

/**
 * Get rollout status with memoization (recommended)
 *
 * **Use this instead of isInRollout() for better performance during a session.**
 *
 * @param userId - User ID for bucketing
 * @param flagName - Feature flag name
 * @param percentage - Rollout percentage (0-100)
 * @param seed - Optional seed for rebalancing
 * @returns true if user is in rollout, false otherwise (memoized)
 */
export function isInRolloutMemoized(
  userId: string,
  flagName: string,
  percentage: number,
  seed = "",
): boolean {
  const clampedPercent = Math.max(0, Math.min(100, Math.floor(percentage)));
  const bucket = getBucketMemoized(userId, flagName, seed);
  return bucket < clampedPercent;
}
