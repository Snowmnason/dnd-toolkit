/**
 * Repository Registry
 *
 * Central registry for all repository implementations. Follows the same
 * registration pattern as `lib/services/auth-provider.ts` and
 * `lib/services/database-provider.ts`.
 *
 * ## How It Works
 *
 * At app startup, concrete implementations are registered (Supabase by default).
 * App code then retrieves them via typed getter functions. The registry is
 * implementation-agnostic: swap Supabase for Firebase by registering different classes.
 *
 * ## Startup Registration (app/_layout.tsx or kernel bootstrap)
 *
 * ```ts
 * import { registerRepositories } from '@/lib/database/repositories';
 *
 * // Register all Supabase implementations at once (Track B2 provides these)
 * registerRepositories({
 *   user: new SupabaseUserRepository(),
 *   world: new SupabaseWorldRepository(),
 *   worldAccess: new SupabaseWorldAccessRepository(),
 *   invite: new SupabaseInviteRepository(),
 *   userSettings: new SupabaseUserSettingsRepository(),
 *   featureFlags: new SupabaseFeatureFlagsRepository(),
 *   entitlements: new SupabaseEntitlementsRepository(),
 * });
 * ```
 *
 * ## Usage in App Code
 *
 * ```ts
 * import { getUserRepository, getWorldRepository } from '@/lib/database/repositories';
 *
 * const user = await getUserRepository().getCurrentUser();
 * const worlds = await getWorldRepository().getMyWorlds();
 * ```
 *
 * ## Testing
 *
 * ```ts
 * import { registerRepositories } from '@/lib/database/repositories';
 * import { MockUserRepository } from '@/lib/database/repositories/__mocks__/MockUserRepository';
 *
 * beforeEach(() => {
 *   registerRepositories({ user: new MockUserRepository() });
 * });
 * ```
 *
 * @see lib/database/repositories/types.ts — interface definitions
 * @see lib/services/auth-provider.ts — same registration pattern for auth
 */

import { logger } from "@/lib/utils/logger";
import type {
  EntitlementsRepository,
  FeatureFlagsRepository,
  InviteRepository,
  UserRepository,
  UserSettingsRepository,
  WorldAccessRepository,
  WorldRepository,
} from "./repo-types";

// ============================================================================
// REGISTRY
// ============================================================================

/**
 * Shape of the full repository registry. Every key maps to an interface from types.ts.
 * All properties are optional at registration time (partial bundle supported),
 * but getters will throw if a repository is accessed before it is registered.
 */
export interface RepositoryBundle {
  user?: UserRepository;
  world?: WorldRepository;
  worldAccess?: WorldAccessRepository;
  invite?: InviteRepository;
  userSettings?: UserSettingsRepository;
  featureFlags?: FeatureFlagsRepository;
  entitlements?: EntitlementsRepository;
}

/**
 * Error thrown when a repository is accessed before it has been registered.
 *
 * This is intentional: failing loudly prevents silent data corruption from
 * un-initialized repositories returning default/empty values.
 */
export class RepositoryNotRegisteredError extends Error {
  constructor(repositoryName: string) {
    super(
      `Repository "${repositoryName}" has not been registered. ` +
      `Call registerRepositories() or register${repositoryName.charAt(0).toUpperCase() + repositoryName.slice(1)}Repository() ` +
      `at app startup before accessing this repository.`,
    );
    this.name = "RepositoryNotRegisteredError";
  }
}

// Single registry object — module-level singleton
const _registry: RepositoryBundle = {};

// ============================================================================
// REGISTRATION FUNCTIONS
// ============================================================================

/**
 * Register all repositories at once. Typically called during app bootstrap.
 * Partial bundles are allowed: only the provided repositories will be registered.
 * Calling this again with overlapping keys will override previously registered values.
 *
 * @example
 * registerRepositories({
 *   user: new SupabaseUserRepository(),
 *   world: new SupabaseWorldRepository(),
 *   // ... other repositories
 * });
 */
export function registerRepositories(bundle: RepositoryBundle): void {
  const registered: string[] = [];

  // Explicit type-safe assignment for each repository
  if (bundle.user !== undefined) {
    _registry.user = bundle.user;
    registered.push("user");
  }
  if (bundle.world !== undefined) {
    _registry.world = bundle.world;
    registered.push("world");
  }
  if (bundle.worldAccess !== undefined) {
    _registry.worldAccess = bundle.worldAccess;
    registered.push("worldAccess");
  }
  if (bundle.invite !== undefined) {
    _registry.invite = bundle.invite;
    registered.push("invite");
  }
  if (bundle.userSettings !== undefined) {
    _registry.userSettings = bundle.userSettings;
    registered.push("userSettings");
  }
  if (bundle.featureFlags !== undefined) {
    _registry.featureFlags = bundle.featureFlags;
    registered.push("featureFlags");
  }
  if (bundle.entitlements !== undefined) {
    _registry.entitlements = bundle.entitlements;
    registered.push("entitlements");
  }

  if (registered.length > 0) {
    logger.category("bootstrap").debug(`Repositories registered: ${registered.join(", ")}`);
  }
}

/**
 * Register a single UserRepository implementation.
 * Useful for per-repository testing overrides.
 */
export function registerUserRepository(repo: UserRepository): void {
  _registry.user = repo;
  logger.category("bootstrap").debug("UserRepository registered");
}

/**
 * Register a single WorldRepository implementation.
 */
export function registerWorldRepository(repo: WorldRepository): void {
  _registry.world = repo;
  logger.category("bootstrap").debug("WorldRepository registered");
}

/**
 * Register a single WorldAccessRepository implementation.
 */
export function registerWorldAccessRepository(repo: WorldAccessRepository): void {
  _registry.worldAccess = repo;
  logger.category("bootstrap").debug("WorldAccessRepository registered");
}

/**
 * Register a single InviteRepository implementation.
 */
export function registerInviteRepository(repo: InviteRepository): void {
  _registry.invite = repo;
  logger.category("bootstrap").debug("InviteRepository registered");
}

/**
 * Register a single UserSettingsRepository implementation.
 */
export function registerUserSettingsRepository(repo: UserSettingsRepository): void {
  _registry.userSettings = repo;
  logger.category("bootstrap").debug("UserSettingsRepository registered");
}

/**
 * Register a single FeatureFlagsRepository implementation.
 */
export function registerFeatureFlagsRepository(repo: FeatureFlagsRepository): void {
  _registry.featureFlags = repo;
  logger.category("bootstrap").debug("FeatureFlagsRepository registered");
}

/**
 * Register a single EntitlementsRepository implementation.
 */
export function registerEntitlementsRepository(repo: EntitlementsRepository): void {
  _registry.entitlements = repo;
  logger.category("bootstrap").debug("EntitlementsRepository registered");
}

// ============================================================================
// GETTER FUNCTIONS
// ============================================================================

/**
 * Get the registered UserRepository.
 * @throws RepositoryNotRegisteredError if not yet registered
 */
export function getUserRepository(): UserRepository {
  if (!_registry.user) {
    throw new RepositoryNotRegisteredError("user");
  }
  return _registry.user;
}

/**
 * Get the registered WorldRepository.
 * @throws RepositoryNotRegisteredError if not yet registered
 */
export function getWorldRepository(): WorldRepository {
  if (!_registry.world) {
    throw new RepositoryNotRegisteredError("world");
  }
  return _registry.world;
}

/**
 * Get the registered WorldAccessRepository.
 * @throws RepositoryNotRegisteredError if not yet registered
 */
export function getWorldAccessRepository(): WorldAccessRepository {
  if (!_registry.worldAccess) {
    throw new RepositoryNotRegisteredError("worldAccess");
  }
  return _registry.worldAccess;
}

/**
 * Get the registered InviteRepository.
 * @throws RepositoryNotRegisteredError if not yet registered
 */
export function getInviteRepository(): InviteRepository {
  if (!_registry.invite) {
    throw new RepositoryNotRegisteredError("invite");
  }
  return _registry.invite;
}

/**
 * Get the registered UserSettingsRepository.
 * @throws RepositoryNotRegisteredError if not yet registered
 */
export function getUserSettingsRepository(): UserSettingsRepository {
  if (!_registry.userSettings) {
    throw new RepositoryNotRegisteredError("userSettings");
  }
  return _registry.userSettings;
}

/**
 * Get the registered FeatureFlagsRepository.
 * @throws RepositoryNotRegisteredError if not yet registered
 */
export function getFeatureFlagsRepository(): FeatureFlagsRepository {
  if (!_registry.featureFlags) {
    throw new RepositoryNotRegisteredError("featureFlags");
  }
  return _registry.featureFlags;
}

/**
 * Get the registered EntitlementsRepository.
 * @throws RepositoryNotRegisteredError if not yet registered
 */
export function getEntitlementsRepository(): EntitlementsRepository {
  if (!_registry.entitlements) {
    throw new RepositoryNotRegisteredError("entitlements");
  }
  return _registry.entitlements;
}

// ============================================================================
// INSPECTION UTILITIES (Testing / Bootstrap)
// ============================================================================

/**
 * Check whether all repositories have been registered.
 * Useful in kernel bootstrap to assert readiness before app starts.
 *
 * @example
 * if (!areRepositoriesReady()) {
 *   logger.category('bootstrap').warn('Some repositories not registered yet');
 * }
 */
export function areRepositoriesReady(): boolean {
  return !!(
    _registry.user &&
    _registry.world &&
    _registry.worldAccess &&
    _registry.invite &&
    _registry.userSettings &&
    _registry.featureFlags &&
    _registry.entitlements
  );
}

/**
 * Returns the list of repository names that are currently registered.
 * Useful for debugging bootstrap order issues.
 */
export function getRegisteredRepositories(): (keyof RepositoryBundle)[] {
  const registered: (keyof RepositoryBundle)[] = [];

  if (_registry.user !== undefined) registered.push("user");
  if (_registry.world !== undefined) registered.push("world");
  if (_registry.worldAccess !== undefined) registered.push("worldAccess");
  if (_registry.invite !== undefined) registered.push("invite");
  if (_registry.userSettings !== undefined) registered.push("userSettings");
  if (_registry.featureFlags !== undefined) registered.push("featureFlags");
  if (_registry.entitlements !== undefined) registered.push("entitlements");

  return registered;
}

/**
 * Reset the registry. **For testing only.**
 * Clears all registered repositories so tests can start fresh.
 *
 * @internal
 */
export function _resetRepositories(): void {
  _registry.user = undefined;
  _registry.world = undefined;
  _registry.worldAccess = undefined;
  _registry.invite = undefined;
  _registry.userSettings = undefined;
  _registry.featureFlags = undefined;
  _registry.entitlements = undefined;
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export type {
  CacheOptions,
  CreateInviteLinkParams,
  CreateUserData,
  CreateWorldData,
  EntitlementRow,
  EntitlementsRepository,
  FeatureFlagOverrideRow,
  FeatureFlagRow,
  FeatureFlagsRepository,
  InviteLink,
  InviteRepository,
  OperationResult,
  PaginatedResult,
  PaginationOptions,
  UpdateUserData,
  User,
  UserRepository,
  UserSettings,
  UserSettingsRepository,
  WorldAccess,
  WorldAccessRepository,
  WorldRepository,
  WorldWithAccess
} from "./repo-types";

export type { AccessRole, World } from "./repo-types";

