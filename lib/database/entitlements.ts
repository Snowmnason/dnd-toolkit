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

/**
 * Set the remind_user flag for a specific entitlement
 *
 * Updates whether users should be reminded about this entitlement's expiration.
 *
 * @param supabase - Supabase client
 * @param entitlementId - Entitlement ID (UUID)
 * @param remindUser - true to enable reminders, false to disable
 * @returns true on success, throws error on failure
 */
export async function setEntitlementReminderFlag(
  supabase: SupabaseClient,
  entitlementId: string,
  remindUser: boolean,
): Promise<boolean> {
  const { error } = await supabase
    .schema('feature_flags')
    .from('entitlements')
    .update({ remind_user: remindUser, updated_at: new Date().toISOString() })
    .eq('id', entitlementId);

  if (error) {
    throw new Error(
      `Failed to update remind_user for entitlement ${entitlementId}: ${error.message}`,
    );
  }

  return true;
}

/**
 * Fetch entitlements that should trigger reminders
 *
 * Returns entitlements where:
 * - is_active = true
 * - remind_user = true
 * - expires_at is within the reminder window (optional filter on client)
 *
 * @param supabase - Supabase client
 * @param userId - User ID (UUID) to fetch remindable entitlements for
 * @returns List of entitlements that should trigger reminders
 */
export async function fetchRemindableEntitlements(
  supabase: SupabaseClient,
  userId: string,
): Promise<EntitlementRow[]> {
  const { data, error } = await supabase
    .schema('feature_flags')
    .from('entitlements')
    .select(
      'id, user_id, key, is_active, remind_user, created_at, updated_at, expires_at',
    )
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq('remind_user', true)
    .not('expires_at', 'is', null); // Only include entitlements that expire

  if (error) {
    throw new Error(
      `Failed to fetch remindable entitlements for user ${userId}: ${error.message}`,
    );
  }

  return (data || []) as EntitlementRow[];
}

/**
 * Fetch entitlements that have expired beyond the grace period
 *
 * Returns active entitlements where:
 * - is_active = true
 * - expires_at < (now - gracePeriodDays)
 *
 * @param supabase - Supabase client
 * @param gracePeriodDays - Number of days after expiry to wait before deactivation
 * @returns List of expired entitlements past the grace period
 */
export async function fetchExpiredEntitlements(
  supabase: SupabaseClient,
  gracePeriodDays: number,
): Promise<EntitlementRow[]> {
  const now = new Date();
  const graceCutoffDate = new Date(now.getTime() - gracePeriodDays * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .schema('feature_flags')
    .from('entitlements')
    .select('id, user_id, key, is_active, remind_user, created_at, updated_at, expires_at')
    .eq('is_active', true)
    .lt('expires_at', graceCutoffDate.toISOString());

  if (error) {
    throw new Error(
      `Failed to fetch expired entitlements: ${error.message}`,
    );
  }

  return (data || []) as EntitlementRow[];
}

/**
 * Deactivate a batch of entitlements
 *
 * Marks the given entitlements as is_active = false.
 *
 * @param supabase - Supabase client
 * @param entitlementIds - Array of entitlement IDs (UUIDs) to deactivate
 * @returns Number of entitlements deactivated
 */
export async function deactivateEntitlements(
  supabase: SupabaseClient,
  entitlementIds: string[],
): Promise<number> {
  if (entitlementIds.length === 0) {
    return 0;
  }

  const { error } = await supabase
    .schema('feature_flags')
    .from('entitlements')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .in('id', entitlementIds);

  if (error) {
    throw new Error(
      `Failed to deactivate entitlements: ${error.message}`,
    );
  }

  return entitlementIds.length;
}

