import { logger } from '../utils/logger';
import { supabase } from './supabase';
import type { User } from './users';

/**
 * Shared database helper functions to reduce code duplication
 * and prepare for request manager integration
 */

/**
 * Get current user's profile using cache-first strategy with freshness threshold
 * 
 * @param forceRefresh - If true, bypass cache and fetch fresh from Supabase
 * @returns User profile or null if not authenticated
 * @throws Error if auth succeeds but profile not found (data inconsistency)
 * 
 * Usage:
 * - Regular reads: `getCurrentUserProfile()` - uses cache if fresh (<4 hours)
 * - Live data: `getCurrentUserProfile(true)` - always fetches fresh
 * - Admin panel: ALWAYS use `getCurrentUserProfile(true)` - NEVER cache-based
 */
export async function getCurrentUserProfile(forceRefresh = false): Promise<User | null> {
  const { AuthStateManager } = await import('../auth/auth-state');
  const { updateStorageCache } = await import('../storage/update-storage-cache');
  const { SecureStorage, STORAGE_KEYS } = await import('../storage');

  // Cache freshness window: 4 hours
  const CACHE_FRESH_THRESHOLD = 4 * 60 * 60 * 1000;

  // Step 1: Try cache first (unless force refresh)
  if (!forceRefresh) {
    try {
      const cachedUser = await AuthStateManager.getUserData();
      const cacheMeta = await SecureStorage.getJSON<{ timestamp: number }>(
        `${STORAGE_KEYS.USER_DATA}_meta`
      );

      if (cachedUser && cacheMeta) {
        const cacheAge = Date.now() - cacheMeta.timestamp;
        const isCacheFresh = cacheAge < CACHE_FRESH_THRESHOLD;

        if (isCacheFresh) {
          logger.debug('storage', `User profile loaded from cache (age: ${cacheAge}ms)`);
          return cachedUser;
        }

        // Cache is stale - refresh from database
        logger.debug('storage', `User profile cache stale (age: ${cacheAge}ms), refreshing from database`);
        try {
          await updateStorageCache.refreshUserProfile();
          // Now read the refreshed cache
          const refreshedUser = await AuthStateManager.getUserData();
          return refreshedUser;
        } catch (refreshError) {
          logger.warn('storage', 'Failed to refresh user profile, using stale cache as fallback :', refreshError);
          return cachedUser;
        }
      }
    } catch {
      logger.debug('storage', 'Cache access failed, fetching from session');
    }
  } else {
    logger.debug('storage', 'Force refresh requested, skipping cache');
  }

  // Step 2: Check cached session (no network call, but may be stale)
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError) {
    logger.error('storage', 'Session error:', sessionError);
    return null;
  }
  
  if (!session || !session.user) {
    logger.debug('storage', 'No active session');
    return null;
  }

  // Step 3: We have a session, fetch user profile from DB
  const authUserId = session.user.id;
  
  const { data: userProfile, error: dbError } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', authUserId)
    .single();

  if (dbError) {
    logger.error('storage', 'Error fetching user profile:', dbError);
    throw new Error(dbError.message || 'Failed to fetch user profile');
  }

  if (!userProfile) {
    logger.error('storage', 'User profile not found for auth_id:', authUserId);
    throw new Error('User profile not found');
  }

  // Step 4: Update cache for next time
  try {
    await AuthStateManager.saveUserData(userProfile);
    // Save metadata with fresh timestamp
    await SecureStorage.setJSON(`${STORAGE_KEYS.USER_DATA}_meta`, {
      timestamp: Date.now(),
      source: 'supabase'
    });
  } catch (error) {
    logger.warn('storage', 'Failed to update cache (non-critical):', error);
  }

  return userProfile;
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
    throw new Error('Not authenticated');
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
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
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
 * @returns Validated user or null if not authenticated
 */
export async function validateCurrentUser(): Promise<{ auth_id: string; email: string } | null> {
  // This makes a network call to validate the token
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    logger.debug('storage', 'User validation failed:', error?.message);
    return null;
  }
  
  return {
    auth_id: user.id,
    email: user.email || ''
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
  const { AuthStateManager } = await import('../auth/auth-state');
  
  // Always validate with server for writes
  // This ensures user still has permission and account is active
  const validatedAuth = await validateCurrentUser();
  
  if (!validatedAuth) {
    throw new Error('Not authenticated - cannot perform write operation');
  }
  
  // Fetch full user profile from database with fresh auth
  const { data: userProfile, error } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', validatedAuth.auth_id)
    .single();
  
  if (error || !userProfile) {
    logger.error('storage', 'User profile not found during write validation:', error);
    throw new Error('User profile not found - cannot perform write operation');
  }
  
  // Update cache with fresh data
  try {
    await AuthStateManager.saveUserData(userProfile);
  } catch (cacheError) {
    logger.warn('storage', 'Failed to update cache after write validation (non-critical):', cacheError);
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
export function querySucceeded<T>(result: { data: T | null; error: any }): result is { data: T; error: null } {
  return result.error === null && result.data !== null;
}

/**
 * Extract data from Supabase query or throw
 * Helper for cleaner error handling
 */
export function extractData<T>(result: { data: T | null; error: any }, context: string): T {
  if (result.error) {
    logger.error('storage', `${context}:`, result.error);
    throw new Error(result.error.message || `${context} failed`);
  }
  
  if (result.data === null) {
    logger.error('storage', `${context}: No data returned`);
    throw new Error(`${context}: No data returned`);
  }
  
  return result.data;
}
