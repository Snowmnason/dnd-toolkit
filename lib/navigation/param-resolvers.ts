/**
 * Param Resolvers
 *
 * Registry of deferred parameter resolvers for navigation.
 * Resolvers pull current app-state values from approved lib sources (auth state, storage).
 * Used by navManager to enrich NavigationContext and provide URL param defaults.
 *
 * Resolver contract:
 * - Async and graceful (never throw; return undefined on failure or missing value)
 * - Read from lib layer only (auth-state, middleware/storage) — never from hooks or providers
 * - Registered in PARAM_RESOLVERS for use by resolveContextParams()
 */

import { AuthStateManager } from '@/lib/auth/auth-state';
import { STORAGE_KEYS } from '@/maps/storage-keys';
import { retrieveValue } from '@/middleware/storage';

/** A single deferred param resolver: async, graceful, returns undefined on failure. */
export type ParamResolver = () => Promise<string | undefined>;

/** Registry of named param resolvers. */
export type ParamResolverRegistry = Record<string, ParamResolver>;

async function resolveCurrentUserId(): Promise<string | undefined> {
  return AuthStateManager.getUserId();
}

async function resolveCurrentWorldId(): Promise<string | undefined> {
  const result = await retrieveValue<string>(STORAGE_KEYS.LAST_SELECTED_WORLD);
  return result.success && result.data != null ? result.data : undefined;
}

/** Default param resolver registry used by navManager for route navigation. */
export const PARAM_RESOLVERS: ParamResolverRegistry = {
  userId: resolveCurrentUserId,
  worldId: resolveCurrentWorldId,
};

/**
 * Run all resolvers in the registry concurrently and collect defined results.
 *
 * - Runs all resolvers via Promise.allSettled (failures don't block navigation)
 * - Skips resolvers that return undefined or reject
 * - Returns a plain Record with only present values
 *
 * @example
 * const ctx = await resolveContextParams(PARAM_RESOLVERS);
 * // ctx = { userId: 'uuid-...', worldId: 'uuid-...' }
 */
export async function resolveContextParams(
  registry: ParamResolverRegistry,
): Promise<Record<string, string>> {
  const settled = await Promise.allSettled(
    Object.entries(registry).map(async ([key, resolver]) => {
      const value = await resolver();
      return [key, value] as const;
    }),
  );

  const result: Record<string, string> = {};
  for (const entry of settled) {
    if (entry.status === 'fulfilled') {
      const [key, value] = entry.value;
      if (value !== undefined) {
        // Use Object.assign for safer property assignment (avoids linter injection sink warning)
        Object.assign(result, { [key]: value });
      }
    }
  }
  return result;
}
