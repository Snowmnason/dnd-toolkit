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
 *   id: "beta_testers",
 *   name: "Beta Testers",
 *   description: "Early adopters testing pre-release features",
 *   percentage: 20,  // ~20% of users in this cohort (deterministic bucketing)
 *   seed: undefined, // No seed means bucket by cohort ID
 * };
 * ```
 */
export interface CohortDef {
  /** Unique cohort identifier (e.g., "beta_testers", "mobile_first") */
  id: string;

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

  /** Cohort ID (references feature_flags.cohorts.id) */
  cohort_id: string;

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

  /** Cohort ID (references feature_flags.cohorts.id) */
  cohort_id: string;

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
 *   id: "beta_testers",
 *   percentage: 20,
 * };
 * if (isUserInCohort(userId, "beta_testers", betaTesters)) {
 *   // ~20% of users reach here
 * }
 *
 * // Phase 2: With explicit membership override
 * const explicitMemberships = ["qa_testers"]; // Admin assigned this user
 * if (isUserInCohort(userId, "qa_testers", qaTesters, explicitMemberships)) {
 *   // User is explicitly in qa_testers (has highest priority)
 * }
 *
 * // Rebalancing pattern
 * const cohortV1 = { id: "feature", percentage: 10, seed: "v1" };
 * const cohortV2 = { id: "feature", percentage: 50, seed: "v1" }; // Same seed
 * // If user was in 10% with v1, they're still in 10% with v2
 * // Remaining users are distributed into 40% bucket
 *
 * // Changing seed re-buckets everyone
 * const cohortV2New = { id: "feature", percentage: 50, seed: "v2" };
 * // User may be in different 50% now
 * ```
 */
export function isUserInCohort(
  userId: string,
  cohortId: string,
  cohortDef: CohortDef,
  explicitMemberships?: string[],
): boolean {
  // Phase 2: Check explicit membership first (highest priority)
  if (explicitMemberships?.includes(cohortId)) {
    return true; // Admin override
  }

  // Phase 1: Deterministic bucketing
  const percentage = cohortDef.percentage ?? 100;
  const seed = cohortDef.seed ?? cohortId;

  // Use flag name = cohort ID for consistent bucketing
  return isInRollout(userId, cohortId, percentage, seed ?? undefined);
}

/**
 * Recommended cohorts for D&D Toolkit
 *
 * These cohorts are suitable for most feature rollout scenarios.
 * Modify or add additional cohorts as needed.
 */
export const RECOMMENDED_COHORTS: Record<string, CohortDef> = {
  beta_testers: {
    id: "beta_testers",
    name: "Beta Testers",
    description: "Early adopters testing features before release",
    percentage: 20,
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description: "Enterprise customers",
    percentage: 100,
  },
  internal: {
    id: "internal",
    name: "Internal Team",
    description: "Internal team members (dogfooding)",
    percentage: 100,
  },
  mobile_first: {
    id: "mobile_first",
    name: "Mobile-First Users",
    description: "Mobile platform optimizations",
    percentage: 100,
  },
  desktop_first: {
    id: "desktop_first",
    name: "Desktop-First Users",
    description: "Desktop/web platform optimizations",
    percentage: 100,
  },
};
