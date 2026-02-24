/**
 * Repository Initialization Module
 *
 * Initializes and registers all repository implementations.
 * Called during AppKernel SERVICES phase after DatabaseProvider is ready.
 *
 * Design mirrors lib/services/supabase/supabase-initializer.ts:
 * - Isolated responsibility: own "how to initialize repositories"
 * - Idempotent: safe to call multiple times
 * - Service-initializer.ts is the switch-board; this file owns the details
 *
 * Swapping to a different backend means updating this file and service-initializer.ts.
 */

import { getDatabaseProvider } from "@/lib/services";
import { logger } from "@/lib/utils/logger";
import { registerRepositories, type RepositoryBundle } from "./repositories";
import { SupabaseEntitlementsRepository } from "./repositories/SupabaseEntitlementsRepository";
import { SupabaseFeatureFlagsRepository } from "./repositories/SupabaseFeatureFlagsRepository";
import { SupabaseInviteRepository } from "./repositories/SupabaseInviteRepository";
import { SupabaseUserRepository } from "./repositories/SupabaseUserRepository";
import { SupabaseUserSettingsRepository } from "./repositories/SupabaseUserSettingsRepository";
import { SupabaseWorldAccessRepository } from "./repositories/SupabaseWorldAccessRepository";
import { SupabaseWorldRepository } from "./repositories/SupabaseWorldRepository";

/** Module-scope guard — prevents double initialization */
let _initialized = false;

/**
 * Initialize and register all repositories.
 *
 * Steps:
 * 1. Check that DatabaseProvider is configured (should be ready if called from service-initializer)
 * 2. Instantiate all Supabase repository implementations
 * 3. Register them as the active repositories
 *
 * Called after DatabaseProvider is ready, so repositories can call getDatabaseProvider() immediately.
 *
 * @returns true if repositories were initialized and registered;
 *          false if DatabaseProvider is not configured (repositories cannot be instantiated)
 */
export async function initializeRepositories(): Promise<boolean> {
  if (_initialized) {
    logger.category("bootstrap").debug("[Repository Initializer] Already initialized — skipping");
    return true; // Already registered
  }

  _initialized = true;

  // Check that DatabaseProvider is ready
  const databaseProvider = getDatabaseProvider();
  if (!databaseProvider.isConfigured()) {
    logger.warn(
      "bootstrap",
      "[Repository Initializer] DatabaseProvider not configured — skipping repository initialization. " +
        "Repositories will fail until DatabaseProvider is ready."
    );
    return false;
  }

  try {
    // Instantiate all Supabase repositories
    const bundle: RepositoryBundle = {
      user: new SupabaseUserRepository(),
      world: new SupabaseWorldRepository(),
      worldAccess: new SupabaseWorldAccessRepository(),
      invite: new SupabaseInviteRepository(),
      userSettings: new SupabaseUserSettingsRepository(),
      featureFlags: new SupabaseFeatureFlagsRepository(),
      entitlements: new SupabaseEntitlementsRepository(),
    };

    // Register all repositories
    registerRepositories(bundle);

    logger.category("bootstrap").info("✅ All repositories initialized and registered");
    return true;
  } catch (error) {
    logger.error(
      "bootstrap",
      `[Repository Initializer] Failed to initialize repositories: ${error}`,
    );
    throw error;
  }
}

/**
 * Reset repositories (for testing)
 * Allows tests to re-initialize with mock repositories
 */
export function resetRepositoriesInitializer(): void {
  _initialized = false;
}
