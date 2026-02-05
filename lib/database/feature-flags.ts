/**
 * Feature Flags Database Queries
 *
 * This module provides client-side REST API helpers for querying global feature flags
 * from the Supabase `feature_flags` table. Used by `lib/feature-flags/server-sync.ts` (FeatureFlagsManager)
 * to bootstrap flags during app startup.
 *
 * **NOTE:** These are client-side queries. Do not use directly in components;
 * use `lib/feature-flags/FeatureFlagsManager` and React hooks instead.
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface FeatureFlagRow {
  flag_name: string;
  enabled: boolean;
  kind: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch all global feature flags from server
 *
 * @param supabase - Supabase client
 * @returns List of feature flags
 */
export async function fetchFeatureFlags(
  supabase: SupabaseClient,
): Promise<FeatureFlagRow[]> {
  const { data, error } = await supabase
    .from("feature_flags")
    .select("flag_name, enabled, kind, description, created_at, updated_at");

  if (error) {
    throw new Error(`Failed to fetch feature flags: ${error.message}`);
  }

  return (data || []) as FeatureFlagRow[];
}
