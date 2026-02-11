/**
 * Feature Flag Overrides - Types Only
 *
 * **Schema**: feature_flags.feature_flag_overrides (NOT feature_flags.entitlements_overrides)
 * **Note**: This table only handles FLAG overrides. Entitlement overrides use a separate table.
 *
 * @deprecated Phase 1b: Query functions are no longer used.
 * Feature flag overrides are now fetched via the Edge Function `get_feature_flags`
 * (consolidated call) and updated via Supabase Realtime subscriptions.
 *
 * **TYPES EXPORTED HERE:** This file maintains type definitions and schema documentation
 * for feature flag overrides. These types are imported by `lib/feature-flags/server-sync.ts`
 * for type safety across the event-driven architecture.
 *
 * See: lib/feature-flags/server-sync.ts (FeatureFlagsManager.bootstrapFlags)
 * See: supabase/functions/get_feature_flags/
 *
 * **Schema**: feature_flags.feature_flag_overrides
 * - id: uuid (PK)
 * - user_id: uuid (FK to users)
 * - flag_name: text (feature flag being overridden, FK to feature_flags)
 * - enabled: boolean (override value)
 * - expires_at: timestamp (nullable, for time-based expiry)
 * - revoked: boolean (manual revocation flag)
 * - reason: text (optional, e.g., "internal testing", "customer request")
 * - created_by: uuid (optional, FK to users, who created the override)
 * - created_at, updated_at: timestamps
 *
 * **IMPORTANT**: The `target_type` field is NOT in the database schema.
 * It is added synthetically by the Edge Function `get_feature_flags` to maintain
 * backwards compatibility with code expecting a unified override format.
 */

export type OverrideTargetType = "flag" | "entitlement";

/**
 * Feature flag override row returned by Edge Function.
 *
 * **IMPORTANT NOTES**:
 * - `target_type`: SYNTHETIC field (not in DB). Always set to 'flag' by Edge Function.
 * - `target_name`: Maps to `flag_name` column in database.
 *
 * The Edge Function adds `target_type` to provide a unified interface for both
 * flag overrides and entitlement overrides, even though they're stored in separate tables.
 */
export interface FeatureFlagOverrideRow {
  id: string;
  user_id: string;
  target_type: OverrideTargetType; // SYNTHETIC: Added by Edge Function (always 'flag')
  target_name: string; // DB column: flag_name
  enabled: boolean;
  expires_at: string | null;
  revoked: boolean;
  reason?: string;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * @deprecated
 * Fetch all active overrides for a given user
 *
 * Filters for non-revoked overrides that have not expired.
 * Filtering happens server-side to minimize data transfer.
 *
 * @param supabase - Supabase client
 * @param userId - User ID (UUID) to fetch overrides for
 * @returns List of active user overrides

export async function fetchOverridesByUserId(
  supabase: SupabaseClient,
  userId: string,
): Promise<FeatureFlagOverrideRow[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .schema('public')
    .from('feature_flag_overrides')
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
 */
