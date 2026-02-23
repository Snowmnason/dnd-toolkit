/**
 * Entitlements Database Queries
 *
 * This module provides client-side helpers for querying user entitlements.
 * All queries are delegated to `EntitlementsRepository` (Supabase implementation).
 *
 * **Schema**: feature_flags.entitlements
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

import { getEntitlementsRepository } from "./repositories";

// ---------------------------------------------------------------------------
// Row types — kept here as the canonical source; re-exported from repositories/types.ts
// ---------------------------------------------------------------------------

export interface EntitlementRow {
  id: string;
  user_id: string;
  key: string;
  is_active: boolean;
  remind_user: boolean;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

/**
 * Entitlement override row (admin grant/revoke tool).
 *
 * Overrides allow admins to temporarily grant or revoke entitlements
 * without modifying the base entitlement rows.
 */
export interface EntitlementOverrideRow {
  id: string;
  user_id: string;
  entitlement_key: string;
  is_active: boolean;
  expires_at: string | null;
  reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  revoked: boolean;
}

// ---------------------------------------------------------------------------
// Query helpers — thin delegation to EntitlementsRepository
// ---------------------------------------------------------------------------

/**
 * Fetch all active entitlements for a given user.
 */
export async function fetchEntitlementsByUserId(
  userId: string,
): Promise<EntitlementRow[]> {
  return getEntitlementsRepository().getByUserId(userId);
}

/**
 * Check if a user has a specific active (non-expired) entitlement.
 */
export async function hasEntitlement(
  userId: string,
  entitlementKey: string,
): Promise<boolean> {
  return getEntitlementsRepository().hasEntitlement(userId, entitlementKey);
}

/**
 * Fetch all active entitlement overrides for a given user.
 *
 * Returns non-revoked overrides that have not expired.
 */
export async function fetchEntitlementOverridesByUserId(
  userId: string,
): Promise<EntitlementOverrideRow[]> {
  return getEntitlementsRepository().getOverridesByUserId(userId);
}

/**
 * Set the remind_user flag for a specific entitlement.
 *
 * @returns true on success, throws on failure
 */
export async function setEntitlementReminderFlag(
  entitlementId: string,
  remindUser: boolean,
): Promise<boolean> {
  await getEntitlementsRepository().setReminderFlag(entitlementId, remindUser);
  return true;
}

/**
 * Fetch entitlements that should trigger reminders (is_active, remind_user, has expiry).
 */
export async function fetchRemindableEntitlements(
  userId: string,
): Promise<EntitlementRow[]> {
  return getEntitlementsRepository().getRemindable(userId);
}

/**
 * Fetch entitlements that have expired beyond the grace period.
 *
 * Computes the cutoff date from the grace period and delegates to the repository.
 *
 * @param gracePeriodDays - Days after expiry to wait before deactivation
 */
export async function fetchExpiredEntitlements(
  gracePeriodDays: number,
): Promise<EntitlementRow[]> {
  const cutoff = new Date(Date.now() - gracePeriodDays * 24 * 60 * 60 * 1000);
  return getEntitlementsRepository().getExpiredBeforeDate(cutoff.toISOString());
}

/**
 * Deactivate a batch of entitlements (sets is_active = false).
 *
 * @returns Number of entitlements deactivated
/**
 * Deactivate a batch of entitlements (sets is_active = false).
 *
 * @returns Number of entitlements deactivated
 */
export async function deactivateEntitlements(
  entitlementIds: string[],
): Promise<number> {
  if (entitlementIds.length === 0) return 0;
  await getEntitlementsRepository().deactivate(entitlementIds);
  return entitlementIds.length;
}

