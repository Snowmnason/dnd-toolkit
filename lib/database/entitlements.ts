/**
 * Entitlements Database Queries
 *
 * This module provides client-side REST API helpers for querying user entitlements
 * from the Supabase `entitlements` table.
 *
 * **Schema:**
 * - id: uuid (PK)
 * - user_id: uuid (FK to users)
 * - key: text (entitlement name)
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
    .from("entitlements")
    .select("id, user_id, key, created_at, updated_at, expires_at")
    .eq("user_id", userId);

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
    .from("entitlements")
    .select("expires_at")
    .eq("user_id", userId)
    .eq("key", entitlementKey)
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
