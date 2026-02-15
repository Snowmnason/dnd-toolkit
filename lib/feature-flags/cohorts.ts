/**
 * Feature Flag Cohorts
 *
 * Deterministic user grouping for feature targeting and gradual rollouts.
 * Cohorts enable safe, staged feature deployment without redeployment.
 *
 * **Phase 1 (Current):** TypeScript types + deterministic client-side bucketing
 * **Phase 2:** Database-backed explicit memberships + edge function updates
 * **Phase 3:** Condition-based cohort evaluation and dependency resolution
 *
 * @module lib/feature-flags/cohorts
 */

import { isInRollout } from "./rollout";

/**
 * Cohort Definition (TypeScript interface)
 *
 * Describes a named user group for feature targeting.
 * Used by client to evaluate cohort membership deterministically.
 *
 * @example
 * ```ts
 * const betaTesters: CohortDef = {
 *   slug: "beta_testers",
 *   name: "Beta Testers",
 *   description: "Early adopters testing pre-release features",
 *   percentage: 20,  // ~20% of users in this cohort (deterministic bucketing)
 *   seed: undefined, // No seed means bucket by cohort slug
 * };
 * ```
 */
export interface CohortDef {
  /** Human-readable stable identifier (slug), used for deterministic bucketing (e.g., "beta_testers") */
  slug: string;

  /** Display name (e.g., "Beta Testers") */
  name: string;

  /** Human-readable description (optional) */
  description?: string;

  /**
   * Percentage of users to include in cohort (0-100)
   * @default 100 (all users in cohort)
   *
   * Uses deterministic bucketing: same user always gets same result.
   * ~20% means ~20% of users hash into this cohort.
   */
  percentage?: number;

  /**
   * Optional seed for rebalancing users between rollouts
   * @default undefined (use cohort id as seed)
   *
   * When seed changes, users are re-bucketed while maintaining consistency.
   * Useful for safe percentage increases without losing users:
   * - Day 1: {id: "feature", percentage: 10, seed: "v1"}
   * - Day 2: {id: "feature", percentage: 50, seed: "v1"} [same users expand to 50%]
   * - Day 3: {id: "feature", percentage: 100, seed: "v1"} [full rollout]
   */
  seed?: string | null;

  /** Arbitrary metadata for future use (Phase 2+) */
  metadata?: Record<string, any> | null;
}

/**
 * Cohort Row from Database (extends CohortDef)
 *
 * Returned by edge function get_feature_flags() in Phase 2.
 * Includes database-managed fields (timestamps, active status).
 */
export interface CohortRow extends CohortDef {
  /** Whether cohort is active (admins can deactivate) */
  is_active: boolean;

  /** Database primary key (UUID) for internal relations */
  id: string;

  /** Mandatory slug when returned from server */
  slug: string;

  /** ISO 8601 timestamp */
  created_at: string;

  /** ISO 8601 timestamp */
  updated_at: string;
}

/**
 * Cohort-to-Flag Assignment
 *
 * Maps flags to cohorts for conditional flag resolution.
 * Example: "advancedMaps" flag enabled for "beta_testers" cohort.
 */
export interface CohortFlagAssignmentRow {
  /** Assignment UUID */
  id: string;

  /** Feature flag name (references feature_flags.feature_flags.flag_name) */
  flag_name: string;

  /** Cohort ID (UUID, references feature_flags.cohorts.id) */
  cohort_id: string;

  /** Cohort slug for client convenience (may be null if not available) */
  cohort_slug?: string | null;

  /** Whether flag is enabled for this cohort (false = explicitly disabled) */
  enabled: boolean;

  /** ISO 8601 timestamp */
  created_at?: string;

  /** ISO 8601 timestamp */
  updated_at?: string;
}

/**
 * Explicit User Cohort Membership (Phase 2)
 *
 * Represents admin-assigned or property-based cohort membership.
 * Explicit membership overrides deterministic bucketing (highest priority).
 *
 * @example
 * ```ts
 * // Admin explicitly adds user to qa_testers cohort for testing
 * {
 *   id: "uuid1",
 *   user_id: "user-uuid",
 *   cohort_id: "qa_testers",
 *   source: "admin",
 *   created_by: "admin-uuid",
 *   reason: "Testing new feature for bug #456",
 *   expires_at: "2026-02-28T00:00:00Z", // Temporary assignment
 * }
 * ```
 */
export interface UserCohortMembershipRow {
  /** Membership record UUID */
  id: string;

  /** User ID being assigned to cohort */
  user_id: string;

  /** Cohort ID (UUID, references feature_flags.cohorts.id) */
  cohort_id: string;

  /** Whether membership is active (computed or set server-side) */
  is_active?: boolean;

  /** Cohort slug for client convenience (may be null if not available) */
  cohort_slug?: string | null;

  /** How membership was assigned: "admin" | "property-based" | "auto-assigned" */
  source: string;

  /** UUID of admin who created this assignment (if source="admin") */
  created_by?: string | null;

  /** Reason for assignment (admin notes) */
  reason?: string | null;

  /** Membership expiry date (ISO 8601); null = permanent */
  expires_at?: string | null;

  /** ISO 8601 timestamp */
  created_at?: string;

  /** ISO 8601 timestamp */
  updated_at?: string;
}

/**
 * Evaluate if user is in a cohort
 *
 * **Resolution order (highest to lowest priority):**
 * 1. Explicit membership → user is in cohort (admin override)
 * 2. Deterministic bucketing → use FNV-1a hash to check membership
 * 3. Not in cohort → false
 *
 * **Phase 1:** Uses deterministic bucketing only (client-side).
 * **Phase 2:** Adds explicit membership check via edge function.
 *
 * @param userId - User ID for bucketing
 * @param cohortId - Cohort ID to check
 * @param cohortDef - Cohort definition with percentage and seed
 * @param explicitMemberships - List of explicit membership cohort IDs (Phase 2)
 * @returns true if user is in cohort, false otherwise
 *
 * @example
 * ```ts
 * // Phase 1: Deterministic bucketing
 * const betaTesters: CohortDef = {
 *   slug: "beta_testers",
 *   percentage: 20,
 * };
 * if (isUserInCohort(userId, betaTesters)) {
 *   // ~20% of users reach here
 * }
 *
 * // Phase 2: With explicit membership override
 * const explicitMemberships = ["qa_testers"]; // Admin assigned this user
 * if (isUserInCohort(userId, qaTesters, explicitMemberships)) {
 *   // User is explicitly in qa_testers (has highest priority)
 * }
 *
 * // Rebalancing pattern
 * Check if a user is in a cohort (PHASE 1-3: Main evaluation function)
 *
 * Evaluates cohort membership using two mechanisms:
 * 1. **Explicit membership** (Phase 2+, highest priority): Direct assignment from database
 * 2. **Deterministic bucketing** (Phase 1): Hash-based percentage grouping
 *
 * ## Deterministic Bucketing Algorithm
 *
 * Uses FNV-hash to ensure same user always gets same bucket:
 * ```
 * bucket = FNV_HASH(userId + cohortSlug + seed) % 100
 * isInCohort = bucket < percentage
 * ```
 *
 * This guarantees:
 * - Same user always gets same result (deterministic)
 * - Uniform distribution across users (fair bucketing)
 * - Consistent when percentage increases with same seed (safe gradual rollout)
 *
 * ## Seed Parameter (Phase 4: Rebalancing)
 *
 * **Default seed:** cohortDef.slug (e.g., "beta_testers")
 * **Custom seed:** Specified in CohortDef for rebalancing
 *
 * ### Safe Gradual Rollout with Seed
 *
 * To expand a rollout without losing existing users, use the same seed:
 *
 * ```ts
 * // Day 1: 10% rollout (seed: "v1")
 * const day1 = { slug: "feature", percentage: 10, seed: "v1" };
 * isUserInCohort(userId, day1) // → hash(userId + "feature" + "v1") % 100 < 10
 *
 * // Day 2: 50% rollout (same seed keeps existing users)
 * const day2 = { slug: "feature", percentage: 50, seed: "v1" };
 * isUserInCohort(userId, day2) // → Same hash, new range < 50
 * // If user was in 10%, still in 50% (hash in [0-9], so < 50)
 * // New users [10-49] are added to cohort
 *
 * // Day 3: 100% rollout (everyone)
 * const day3 = { slug: "feature", percentage: 100, seed: "v1" };
 * isUserInCohort(userId, day3) // → Always true (hash in [0-99])
 * ```
 *
 * **Changing the seed re-buckets everyone** (use sparingly):
 * ```ts
 * const rebalanced = { slug: "feature", percentage: 50, seed: "v2" };
 * // User gets new hash(userId + "feature" + "v2")
 * // May move to different 50% bucket
 * ```
 *
 * ## Priority
 *
 * 1. **Explicit membership** (if provided in Phase 2)
 *    - Always true if user is explicitly assigned to this cohort
 * 2. **Deterministic bucketing** (Phase 1-4)
 *    - Based on percentage and seed
 *
 * ## API Simplification
 *
 * Uses `cohortDef.slug` as the single source of truth for cohort identity.
 * This eliminates potential mismatches between separate cohortId and cohortDef.slug parameters.
 *
 * @param userId - User identifier (UUID or stable ID from auth)
 * @param cohortDef - Cohort definition (slug is used for bucketing and membership checks)
 * @param explicitMemberships - Optional list of explicitly assigned cohort slugs (Phase 2)
 *
 * @returns `true` if user is in cohort, `false` otherwise
 *
 * @example
 * ```ts
 * // Basic check (deterministic bucketing)
 * const cohort = { slug: "beta_testers", percentage: 20 };
 * if (isUserInCohort(userId, cohort)) {
 *   // User is in ~20% beta group (same result every time)
 * }
 *
 * // With explicit membership override (Phase 2)
 * const memberships = ["qa_special", "beta_testers"]; // From database
 * if (isUserInCohort(userId, cohort, memberships)) {
 *   // True if user is explicitly in beta_testers or bucketed into it
 * }
 *
 * // Gradual rollout scenario
 * const day1 = { slug: "feature", percentage: 10, seed: "rollout_v1" };
 * const day2 = { slug: "feature", percentage: 50, seed: "rollout_v1" };
 * // If user was in day 1 (10%), guaranteed to be in day 2 (50%)
 * // Seed ensures consistent bucketing across percentage changes
 * ```
 *
 * @see {@link https://github.com/Snowmnason/dnd-toolkit/blob/main/lib/feature-flags/rollout.ts} for FNV hash implementation
 * @see {@link lib/feature-flags/README.md} for decision guide on "Cohorts vs. Conditions vs. Rollouts"
 */
export function isUserInCohort(
  userId: string,
  cohortDef: CohortDef,
  explicitMemberships?: string[],
): boolean {
  // Phase 2: Check explicit membership first (highest priority)
  if (explicitMemberships?.includes(cohortDef.slug)) {
    return true; // Admin override
  }

  // Phase 1: Deterministic bucketing
  const percentage = cohortDef.percentage ?? 100;
  const seed = cohortDef.seed ?? cohortDef.slug;

  // Use cohort slug for consistent bucketing
  return isInRollout(userId, cohortDef.slug, percentage, seed ?? undefined);
}

/**
 * Recommended cohorts for D&D Toolkit
 *
 * These cohorts are suitable for most feature rollout scenarios.
 * Modify or add additional cohorts as needed.
 */
export const RECOMMENDED_COHORTS: Record<string, CohortDef> = {
  beta_testers: {
    slug: "beta_testers",
    name: "Beta Testers",
    description: "Early adopters testing features before release",
    percentage: 20,
  },
  enterprise: {
    slug: "enterprise",
    name: "Enterprise",
    description: "Enterprise customers",
    percentage: 100,
  },
  internal: {
    slug: "internal",
    name: "Internal Team",
    description: "Internal team members (dogfooding)",
    percentage: 100,
  },
  mobile_first: {
    slug: "mobile_first",
    name: "Mobile-First Users",
    description: "Mobile platform optimizations",
    percentage: 100,
  },
  desktop_first: {
    slug: "desktop_first",
    name: "Desktop-First Users",
    description: "Desktop/web platform optimizations",
    percentage: 100,
  },
};
