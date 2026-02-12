/**
 * Entitlements Database Queries
 *
 * This module provides client-side REST API helpers for querying user entitlements
 * from the Supabase `feature_flag.entitlements` table.
 *
 * **Schema**: feature_flag.entitlements
 * - id: uuid (PK)
 * - user_id: uuid (FK to users)
 * - key: text (entitlement name)
 * - is_active: boolean (soft-delete flag, auto-marked when expired)
 * - remind_user: boolean (flag to remind user when expired)
 * - created_at, updated_at: timestamps
 * - expires_at: timestamp (nullable)
 *
 * **NOTE:** These are client-side queries. Do not use directly in components;
 * use `lib/feature-flags/FeatureFlagsManager` and React hooks instead.
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface EntitlementRow {
  id: string;
  user_id: string;
  key: string;
  is_active: boolean; // Manual revoke + auto-marked when expired
  remind_user: boolean; // Flag to remind user when expired
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

/**
 * Fetch all entitlements for a given user
 *
 * @param supabase - Supabase client
 * @param userId - User ID (UUID) to fetch entitlements for
 * @returns List of user entitlements
 */
export async function fetchEntitlementsByUserId(
  supabase: SupabaseClient,
  userId: string,
): Promise<EntitlementRow[]> {
  const { data, error } = await supabase
      .schema('feature_flags')
    .from('entitlements')
    .select(
      "id, user_id, key, is_active, remind_user, created_at, updated_at, expires_at",
    )
    .eq("user_id", userId)
    .eq("is_active", true); // Only fetch active entitlements

  if (error) {
    throw new Error(
      `Failed to fetch entitlements for user ${userId}: ${error.message}`,
    );
  }

  return (data || []) as EntitlementRow[];
}

/**
 * Check if a user has a specific entitlement
 *
 * Checks both existence and expiry (if expires_at is set).
 *
 * @param supabase - Supabase client
 * @param userId - User ID (UUID)
 * @param entitlementKey - Entitlement key to check
 * @returns true if user has active (non-expired) entitlement, false otherwise
 */
export async function hasEntitlement(
  supabase: SupabaseClient,
  userId: string,
  entitlementKey: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .schema('feature_flags')
    .from('entitlements')
    .select("is_active, expires_at")
    .eq("user_id", userId)
    .eq("key", entitlementKey)
    .eq("is_active", true) // Only check active entitlements
    .maybeSingle();

  if (error || !data) {
    return false; // No entitlement found = false
  }

  // If expires_at is null, the entitlement never expires
  if (data.expires_at === null) {
    return true;
  }

  // Check if the entitlement has expired
  const expiryTime = new Date(data.expires_at).getTime();
  return expiryTime > Date.now();
}

/**
 * Entitlement override row (admin grant/revoke tool)
 *
 * Overrides allow admins to temporarily grant or revoke entitlements
 * without modifying the base entitlement rows.
 */
export interface EntitlementOverrideRow {
  id: string;
  user_id: string;
  entitlement_key: string;
  is_active: boolean; // true = force grant, false = force revoke
  expires_at: string | null;
  reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  revoked: boolean; // Soft-revoke for audit trail
}

/**
 * Fetch all active entitlement overrides for a given user
 *
 * Filters for non-revoked overrides that have not expired.
 * Overrides provide temporary admin-controlled grants/revokes.
 *
 * @param supabase - Supabase client
 * @param userId - User ID (UUID) to fetch overrides for
 * @returns List of active user entitlement overrides
 */
export async function fetchEntitlementOverridesByUserId(
  supabase: SupabaseClient,
  userId: string,
): Promise<EntitlementOverrideRow[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .schema('feature_flags')
    .from('entitlements_overrides')
    .select(
      "id, user_id, entitlement_key, is_active, expires_at, reason, created_by, created_at, updated_at, revoked",
    )
    .eq("user_id", userId)
    .eq("revoked", false)
    .or(`expires_at.is.null,expires_at.gt.${now}`);

  if (error) {
    throw new Error(
      `Failed to fetch entitlement overrides for user ${userId}: ${error.message}`,
    );
  }

  return (data || []) as EntitlementOverrideRow[];
}
