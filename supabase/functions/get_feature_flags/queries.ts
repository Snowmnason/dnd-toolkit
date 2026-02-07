/**
 * Server-side query helpers for get_feature_flags Edge Function
 * These functions are called server-side to fetch data from Supabase
 * Moved from client-side lib/database/feature-flags.ts, lib/database/entitlements.ts, lib/database/feature-flag-overrides.ts
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type {
    EntitlementRow,
    FeatureFlagOverrideRow,
    FeatureFlagRow,
} from "./types.ts";

/**
 * Create Supabase client for server-side queries
 * Uses service role key to bypass RLS and access all data
 */
function createSupabaseClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables",
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Fetch all global feature flags
 * Moved from lib/database/feature-flags.ts
 *
 * @returns List of all feature flags in the system
 */
export async function fetchFeatureFlags(): Promise<FeatureFlagRow[]> {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("feature_flags")
    .select("flag_name, enabled, kind, description, created_at, updated_at");

  if (error) {
    console.error("Error fetching feature flags:", error.message);
    throw new Error(`Failed to fetch feature flags: ${error.message}`);
  }

  return (data || []) as FeatureFlagRow[];
}

/**
 * Fetch all entitlements for a specific user
 * Moved from lib/database/entitlements.ts
 *
 * @param userId - User ID (UUID) to fetch entitlements for
 * @returns List of user entitlements (non-expired)
 */
export async function fetchEntitlementsByUserId(
  userId: string,
): Promise<EntitlementRow[]> {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("entitlements")
    .select("id, user_id, key, created_at, updated_at, expires_at")
    .eq("user_id", userId);

  if (error) {
    console.error(`Error fetching entitlements for user ${userId}:`, error);
    throw new Error(
      `Failed to fetch entitlements for user ${userId}: ${error.message}`,
    );
  }

  return (data || []) as EntitlementRow[];
}

/**
 * Fetch all active overrides for a specific user
 * Moved from lib/database/feature-flag-overrides.ts
 *
 * Server-side filters for non-revoked, non-expired overrides.
 * Returns both flag-type and entitlement-type overrides.
 * Client-side filtering happens in FeatureFlagsManager.
 *
 * @param userId - User ID (UUID) to fetch overrides for
 * @returns List of active user overrides (non-revoked, non-expired)
 */
export async function fetchOverridesByUserId(
  userId: string,
): Promise<FeatureFlagOverrideRow[]> {
  const supabase = createSupabaseClient();
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
    console.error(`Error fetching overrides for user ${userId}:`, error);
    throw new Error(
      `Failed to fetch feature flag overrides for user ${userId}: ${error.message}`,
    );
  }

  return (data || []) as FeatureFlagOverrideRow[];
}
