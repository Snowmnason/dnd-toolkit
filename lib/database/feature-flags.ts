/**
 * Feature Flags - Types Only
 *
 * @deprecated Phase 1b: Query functions are no longer used.
 * Feature flags are now fetched via the Edge Function `get_feature_flags`
 * (consolidated call) and updated via Supabase Realtime subscriptions.
 *
 * **TYPES EXPORTED HERE:** This file maintains type definitions and schema documentation
 * for feature flags. These types are imported by `lib/feature-flags/server-sync.ts`
 * for type safety across the event-driven architecture.
 *
 * See: lib/feature-flags/server-sync.ts (FeatureFlagsManager.bootstrapFlags)
 * See: supabase/functions/get_feature_flags/
 *
 * **Schema:**
 * - flag_name: text (PK) - unique identifier for the flag
 * - enabled: boolean - whether the flag is enabled
 * - kind: text - category/type of the flag (for grouping or special handling)
 * - description: text (nullable) - markdown description of what the flag does
 * - created_at, updated_at: timestamps
 */

export interface FeatureFlagRow {
  flag_name: string;
  enabled: boolean;
  kind: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

/**
 * @deprecated
 * Fetch all global feature flags from server
 *
 * @param supabase - Supabase client
 * @returns List of feature flags

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
 */
