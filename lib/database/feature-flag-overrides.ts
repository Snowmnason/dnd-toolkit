/**
 * Feature Flag Overrides Database Queries
 *
 * This module provides client-side REST API helpers for querying per-user feature flag/entitlement overrides
 * from the Supabase `feature_flag_overrides` table. Used by `lib/feature-flags/server-sync.ts`
 * (FeatureFlagsManager) to fetch and cache user-specific overrides during app startup or refresh.
 *
 * **Schema:**
 * - id: uuid (PK)
 * - user_id: uuid (FK to users)
 * - target_type: text (enum: 'flag' | 'entitlement') - what is being overridden
 * - target_name: text (feature flag name or entitlement key)
 * - enabled: boolean (override value)
 * - expires_at: timestamp (nullable, for time-based expiry)
 * - revoked: boolean (manual revocation flag)
 * - reason: text (optional, e.g., "internal testing", "customer request")
 * - created_by: uuid (optional, FK to users, who created the override)
 * - created_at, updated_at: timestamps
 *
 * **NOTE:** These are client-side queries. Do not use directly in components;
 * use `lib/feature-flags/FeatureFlagsManager` and React hooks instead.
 */

import { SupabaseClient } from "@supabase/supabase-js";

export type OverrideTargetType = "flag" | "entitlement";

export interface FeatureFlagOverrideRow {
  id: string;
  user_id: string;
  target_type: OverrideTargetType;
  target_name: string;
  enabled: boolean;
  expires_at: string | null;
  revoked: boolean;
  reason?: string;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch all active overrides for a given user
 *
 * Filters for non-revoked overrides that have not expired.
 * Filtering happens server-side to minimize data transfer.
 *
 * @param supabase - Supabase client
 * @param userId - User ID (UUID) to fetch overrides for
 * @returns List of active user overrides
 */
export async function fetchOverridesByUserId(
  supabase: SupabaseClient,
  userId: string,
): Promise<FeatureFlagOverrideRow[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("feature_flag_overrides")
    .select(
      "id, user_id, target_type, target_name, enabled, expires_at, revoked, reason, created_by, created_at, updated_at",
    )
    .eq("user_id", userId)
    .eq("revoked", false)
    .or(`expires_at.is.null,expires_at.gt.${now}`);

  if (error) {
    throw new Error(
      `Failed to fetch feature flag overrides for user ${userId}: ${error.message}`,
    );
  }

  return (data || []) as FeatureFlagOverrideRow[];
}
