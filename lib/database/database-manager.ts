import { isDevelopment } from '@/config';

import { logger } from "@/lib/utils";
import { getUserRepository } from "./repositories";
import type { User } from "./users";

/**
 * Shared database helper functions to reduce code duplication
 * and prepare for request manager integration
 */

/**
 * Get current user's profile using cache-first strategy with freshness threshold
 * 
 * This is a thin wrapper around usersDB.getCurrentUser() to maintain backwards compatibility.
 * For all new code, prefer calling usersDB.getCurrentUser() directly from lib/database/users.ts
 *
 * @param forceRefresh - If true, bypass cache and fetch fresh from database
 * @returns User profile or null if not authenticated
 * @throws Error if auth succeeds but profile not found (data inconsistency)
 *
 * Usage:
 * - Regular reads: `getCurrentUserProfile()` - uses cache if fresh (<4 hours)
 * - Live data: `getCurrentUserProfile(true)` - always fetches fresh
 * - Admin panel: ALWAYS use `getCurrentUserProfile(true)` - NEVER cache-based
 */
export async function getCurrentUserProfile(
  forceRefresh = false,
): Promise<User | null> {
  const { usersDB } = await import("./users");
  return usersDB.getCurrentUser({
    forceRefresh,
    maxAgeMs: 4 * 60 * 60 * 1000, // 4 hours
  });
}

/**
 * Get current user's profile with error if not authenticated
 * Use when authentication is required for the operation
 *
 * @returns User profile
 * @throws Error if not authenticated
 */
export async function requireUserProfile(): Promise<User> {
  const user = await getCurrentUserProfile();

  if (!user) {
    throw new Error("Not authenticated");
  }

  return user;
}

/**
 * Get current user's auth ID from cached session
 * Used for operations that need auth_id but not full profile
 *
 * @returns Auth user ID or null if not authenticated
 */
export async function getCurrentAuthId(): Promise<string | null> {
  // Check cached session (no network call)
  const { getCurrentSession } = await import("@/lib/auth");
  const session = await getCurrentSession();
  return session?.userId || null;
}

/**
 * Validate current user with server (bypasses cache)
 * ONLY use for security-critical operations:
 * - Login/signup
 * - Logout
 * - Account deletion
 * - Password changes
 *
 * For normal operations, use getCurrentUserProfile() which is cache-first.
 *
 * NOTE: This function is intentionally strict and WILL NOT bypass auth in
 * development. Returning a fake authenticated identity here weakens the
 * server-side validation contract and can allow writes to proceed with an
 * identity that doesn't exist in `public.users`.
 *
 * For local/testing needs, use dedicated test utilities or a config-driven
 * mock Supabase client rather than altering this function.
 *
 * @returns Validated user or null if not authenticated
 */
export async function validateCurrentUser(): Promise<{
  auth_id: string;
  email: string;
} | null> {
  // getUser() makes a live server round-trip to validate the JWT — not a cached read.
  // This preserves the original supabase.auth.getUser() semantics for security-critical callers.
  const { getUser } = await import("@/lib/auth");
  const session = await getUser();

  if (!session) {
    logger.category("database").debug("User validation failed: token rejected by server");

    if (isDevelopment()) {
      logger.category("database").warn(
        "DEV MODE: Auth validation failed. Do NOT bypass authentication here; use test utilities to mock identity.",
      );
    }

    return null;
  }

  return {
    auth_id: session.userId,
    email: session.email || '',
  };
}

/**
 * Validate user before WRITE operations (create, update, delete)
 * Ensures user is still authenticated and authorized before mutations
 *
 * Use this before ANY write operation to prevent:
 * - Orphaned data (account deleted mid-operation)
 * - Permission issues (access revoked mid-operation)
 * - Stale auth (session invalidated)
 *
 * @returns Full user profile with fresh server validation
 * @throws Error if not authenticated or validation fails
 *
 * Example:
 * ```typescript
 * const user = await validateUserForWrite();
 * const { data } = await worldsDB.create({
 *   name: 'My World',
 *   ownerId: user.id  // <- Guaranteed fresh validation
 * });
 * ```
 */
export async function validateUserForWrite(): Promise<User> {
  const { AuthStateManager } = await import("../auth/auth-state");

  // Always validate with server for writes
  // This ensures user still has permission and account is active
  const validatedAuth = await validateCurrentUser();

  if (!validatedAuth) {
    throw new Error("Not authenticated - cannot perform write operation");
  }

  // Fetch full user profile from database with fresh auth
  // validatedAuth.auth_id matches the session.userId, so getCurrentUser() fetches the same row
  const userProfile = await getUserRepository().getCurrentUser({ forceRefresh: true });

  if (!userProfile) {
    logger.category("database").error("User profile not found during write validation");
    throw new Error("User profile not found - cannot perform write operation");
  }

  // Update cache with fresh data
  try {
    await AuthStateManager.saveUserData(userProfile);
  } catch (cacheError) {
    logger.category("database").warn("Failed to update cache after write validation (non-critical):", cacheError);
  }

  return userProfile;
}

/**
 * Execute multiple queries in parallel
 * Helper to standardize parallel query patterns
 *
 * @param queries Array of promises to execute in parallel
 * @returns Results array matching input order
 */
export async function executeParallelQueries<T extends readonly unknown[]>(
  ...queries: { [K in keyof T]: Promise<T[K]> }
): Promise<T> {
  return Promise.all(queries) as Promise<T>;
}

/**
 * Check if a Supabase query succeeded
 * Helper for consistent error handling
 */
export function querySucceeded<T>(result: {
  data: T | null;
  error: any;
}): result is { data: T; error: null } {
  return result.error === null && result.data !== null;
}

/**
 * Extract data from Supabase query or throw
 * Helper for cleaner error handling
 */
export function extractData<T>(
  result: { data: T | null; error: any },
  context: string,
): T {
  if (result.error) {
    logger.category("database").error(`${context}:`, result.error);
    throw new Error(result.error.message || `${context} failed`);
  }

  if (result.data === null) {
    logger.category("database").error(`${context}: No data returned`);
    throw new Error(`${context}: No data returned`);
  }

  return result.data;
}

/**
 * Check if database is configured and available
 * Used by analytics/consent and other modules to conditionally execute database operations.
 * 
 * This is a domain-specific wrapper that hides middleware/infrastructure concerns.
 * Modules in lib/analytics, lib/storage, etc. should call this instead of
 * importing isDatabaseConfigured from lib/services.
 *
 * @returns true if database is configured, false if not (e.g., GitHub Pages deployment)
 */
export function isDatabaseConfigured(): boolean {
  const { isDatabaseConfigured: isDatabaseConfiguredMiddleware } = require("@/lib/middleware/services/database-service");
  return isDatabaseConfiguredMiddleware();
}

/**
 * Execute a sync handler for a queued offline mutation
 * Handles getting the database provider through middleware — offline/sync-manager
 * doesn't need to know about infrastructure details.
 *
 * This is the domain-specific wrapper that hides middleware/infrastructure concerns.
 *
 * @param mutation - Queued mutation to sync
 * @returns Handler result with success flag and data/error
 */
export async function executeSyncMutationHandler(mutation: any) {
  // Get Supabase client through middleware (precondition checks: network, auth, provider readiness)
  const { getDatabase } = await import("@/lib/middleware/services/database-service");
  const supabase = getDatabase();

  // Import and execute the sync handler
  const { executeSyncHandler } = await import("../offline/sync-handlers");
  
  return executeSyncHandler(mutation, supabase);
}
