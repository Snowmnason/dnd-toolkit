/**
 * Shared type definitions for the feature-flags module.
 *
 * Wire types from the Edge Function response, domain state types,
 * and subscriber signatures used across server-sync, manager, and tests.
 */
import type { FeatureFlagOverrideRow } from "@/lib/database/feature-flag-overrides";

// ==========================================
// Flag & Entitlement State
// ==========================================

export interface FeatureFlagState {
  enabled: boolean;
  kind?: string;
  description?: string;
  depends_on?: string[] | null;
  condition_logic?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  source: "server" | "hardcoded" | "override";
}

export interface EntitlementState {
  granted: boolean;
  expiresAt?: string | null;
  source: "server" | "cache" | "override";
  lastChecked: number;
}

// ==========================================
// Edge Function Response Types
// ==========================================

/** Cached entitlement from Edge Function bootstrap or Realtime update */
export interface CachedEntitlement {
  id: string;
  user_id: string;
  key: string;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

/** Cached feature flag row from Edge Function */
export interface CachedFeatureFlag {
  flag_name: string;
  enabled: boolean;
  depends_on?: string[] | null;
  condition_logic?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  kind: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

/** Rollout configuration from Edge Function */
export interface CachedRolloutConfig {
  percentage: number;
  seed?: string;
}

/** Cached cohort row from Edge Function */
export interface CachedCohort {
  id: string;
  slug: string;
  name: string;
  description?: string;
  percentage: number;
  seed?: string;
  is_active: boolean;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/** Cached user cohort membership from Edge Function */
export interface CachedUserCohortMembership {
  id: string;
  user_id: string;
  cohort_id: string;
  cohort_slug?: string;
  source: string;
  is_active?: boolean;
  reason?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

/** Cohort-to-flag assignment row from Edge Function */
export interface CachedCohortFlagAssignment {
  id: string;
  flag_name: string;
  cohort_id: string;
  cohort_slug?: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/** Entitlement override row as returned by the Edge Function */
export interface EdgeEntitlementOverrideRow {
  id: string;
  user_id: string;
  target_type: "entitlement";
  target_name: string;
  action: "grant" | "revoke";
  enabled: boolean;
  expires_at: string | null;
  revoked: boolean;
  reason?: string;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

/** Typed response from get_feature_flags Edge Function */
export interface GetFeatureFlagsResponse {
  flags: CachedFeatureFlag[];
  entitlements: CachedEntitlement[];
  overrides: (FeatureFlagOverrideRow | EdgeEntitlementOverrideRow)[];
  rollouts: Record<string, CachedRolloutConfig>;
  cohorts?: CachedCohort[];
  cohort_assignments?: CachedCohortFlagAssignment[];
  user_cohort_memberships?: CachedUserCohortMembership[];
  fetchedAt: number;
  version: "v1";
}

// ==========================================
// Subscribers
// ==========================================

export type FlagsSubscriber = (flags: Record<string, FeatureFlagState>) => void;
