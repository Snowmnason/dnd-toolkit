/**
 * Repository Interface Definitions
 *
 * This file defines the **semantic repository interfaces** for all entities in the
 * dnd-toolkit data layer. These interfaces are the contract between app code and any
 * backend implementation (Supabase, Firebase, REST API, in-memory test doubles, etc.).
 *
 * ## Architectural Principle
 *
 * > "Repositories abstract query *intent*, not implementation."
 *
 * Instead of leaking SQL chains (`.from().select().eq()`), repositories speak business
 * language:
 *   - `getUserRepository().getCurrentUser()` → "Get the authenticated user's profile"
 *   - `getWorldRepository().getMyWorlds()` → "Get all worlds accessible to me"
 *
 * This makes it trivial to swap backends: implement the same methods differently. The
 * calling code never needs to change.
 *
 * ## Usage
 *
 * App code (hooks, screens, services) should **never** call `getDatabaseProvider()`
 * directly. Instead, use the repository getter functions from `index.ts`:
 *
 * ```ts
 * import { getUserRepository, getWorldRepository } from '@/lib/database/repositories';
 *
 * const user = await getUserRepository().getCurrentUser();
 * const worlds = await getWorldRepository().getMyWorlds();
 * ```
 *
 * ## Adding a New Backend
 *
 * 1. Implement each interface (e.g., `FirebaseUserRepository implements UserRepository`)
 * 2. Register instances at app startup via `registerRepositories()`
 * 3. No app code changes required
 *
 * @see lib/database/repositories/index.ts — registry + getter functions
 * @see lib/database/users.ts — current Supabase query logic (to be migrated in B2)
 * @see lib/database/worlds.ts — current Supabase query logic (to be migrated in B2)
 */

// ============================================================================
// RE-EXPORTED SHARED TYPES
// ============================================================================
// Import existing types from the database modules. These are stable contracts
// shared between the repository interface and Supabase implementations.
// Implementations may augment or map these types, but the interface uses them as-is.

// Bring types into local scope for use within this file's interface definitions.
import type { EntitlementOverrideRow, EntitlementRow } from "../entitlements";
import type { FeatureFlagOverrideRow } from "../feature-flag-overrides";
import type { FeatureFlagRow } from "../feature-flags";
import type { UserSettings } from "../user_settings";
import type { CreateUserData, UpdateUserData, User } from "../users";
import type {
    AccessRole,
    CreateWorldData,
    World,
    WorldAccess,
    WorldWithAccess,
} from "../worlds";

// Re-export so consumers of this file get everything from one place.
export type { CreateUserData, UpdateUserData, User } from "../users";

export type {
    AccessRole,
    CreateWorldData,
    World,
    WorldAccess,
    WorldWithAccess
} from "../worlds";

export type { UserSettings } from "../user_settings";

export type { EntitlementOverrideRow, EntitlementRow } from "../entitlements";

export type { FeatureFlagRow } from "../feature-flags";

export type { FeatureFlagOverrideRow } from "../feature-flag-overrides";

// ============================================================================
// SHARED UTILITY TYPES
// ============================================================================

/**
 * Options for cache-aware read operations.
 * Implementations should respect these to allow callers to control freshness.
 */
export interface CacheOptions {
  /** Maximum cache age in milliseconds. Defaults to per-implementation policy. */
  maxAgeMs?: number;
  /** If true, bypass cache and always fetch from the backend. */
  forceRefresh?: boolean;
}

/**
 * Paginated result wrapper. Used by paginated list operations.
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

/**
 * Pagination query parameters.
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
}

/**
 * Standard result type for operations that may fail without throwing
 * (e.g., invite operations where a "soft" failure is acceptable).
 */
export interface OperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// INVITE TYPES
// Defined here because invites.ts uses standalone functions, not a class.
// ============================================================================

export interface InviteLink {
  id?: string;
  world_id: string;
  created_by?: string;
  token: string;
  expires_at: string;
  created_at: string;
}

export interface CreateInviteLinkParams {
  worldId: string;
  /** How long the invite link is valid. Defaults to 24 hours. */
  hoursValid?: number;
}

// ============================================================================
// REPOSITORY INTERFACES
// ============================================================================

// ----------------------------------------------------------------------------
// UserRepository
// Manages user profile CRUD (one profile per auth account).
// All mutating methods operate on the currently authenticated user.
// ----------------------------------------------------------------------------

/**
 * Repository for user profile data.
 *
 * **Scope:** One-to-one with a Supabase auth user. The `auth_id` is the foreign
 * key that links a profile to an auth account.
 *
 * @example
 * const user = await getUserRepository().getCurrentUser();
 * await getUserRepository().updateCurrentUser({ username: 'Gandalf' });
 */
export interface UserRepository {
  /**
   * Create a new user profile after auth signup.
   * @throws if username is invalid or duplicate
   */
  create(userData: CreateUserData): Promise<User>;

  /**
   * Create a user with auto-generated defaults (username = `user_<last8ofAuthId>`).
   * Useful for auth-triggered creation where a username isn't yet chosen.
   */
  createWithDefaults(authId: string): Promise<User>;

  /**
   * Get the currently authenticated user's profile.
   * Implementations should cache the result and respect `options.forceRefresh`.
   * Returns null if no authenticated session exists or no profile found.
   */
  getCurrentUser(options?: CacheOptions): Promise<User | null>;

  /**
   * Update the currently authenticated user's profile fields.
   * @throws if no authenticated session or validation fails
   */
  updateCurrentUser(updates: UpdateUserData): Promise<User>;

  /**
   * Soft-delete the currently authenticated user's account.
   * Returns true on success.
   * @throws if no authenticated session
   */
  deleteCurrentUser(): Promise<boolean>;
}

// ----------------------------------------------------------------------------
// WorldRepository
// Manages world entity CRUD.
// Access control (who belongs to a world) is in WorldAccessRepository.
// ----------------------------------------------------------------------------

/**
 * Repository for world entity data.
 *
 * Handles creation, retrieval, update, and deletion of worlds.
 * Member management lives in `WorldAccessRepository`.
 *
 * @example
 * const world = await getWorldRepository().create({ name: 'Faerun', ... });
 * const worlds = await getWorldRepository().getMyWorlds();
 */
export interface WorldRepository {
  /**
   * Create a new world owned by the currently authenticated user.
   * @throws if validation fails or user has no auth session
   */
  create(worldData: CreateWorldData): Promise<World>;

  /**
   * Get a single world by its ID.
   * Returns null if not found or access is denied.
   */
  getById(worldId: string): Promise<World | null>;

  /**
   * Get all worlds the current user can access (owns or is a member of).
   * May use a cached result from local storage for performance.
   * @param userId - If omitted, uses the currently authenticated user's ID
   */
  getMyWorlds(userId?: string): Promise<WorldWithAccess[]>;

  /**
   * Paginated version of getMyWorlds.
   * Returns `{ items, total }` for UI pagination controls.
   */
  getMyWorldsPaginated(
    userId?: string,
    options?: PaginationOptions,
  ): Promise<PaginatedResult<WorldWithAccess>>;

  /**
   * Update a world's name. Only the world owner can call this.
   * @throws if the current user is not the world owner
   */
  updateName(worldId: string, newName: string): Promise<World>;

  /**
   * Update world fields. Only the world owner can call this.
   * @throws if the current user is not the world owner
   */
  update(worldId: string, updates: Partial<CreateWorldData>): Promise<World>;

  /**
   * Soft-delete a world (sets `deleted_at`). Only the world owner can call this.
   * @throws if the current user is not the world owner
   */
  delete(worldId: string): Promise<void>;
}

// ----------------------------------------------------------------------------
// WorldAccessRepository
// Manages world membership (join, leave, get members, access checks).
// Separated from WorldRepository because access is a distinct concern:
// you can query membership without caring about world settings & vice versa.
// ----------------------------------------------------------------------------

/**
 * Repository for world access and membership management.
 *
 * Handles joining worlds via invite, leaving worlds, checking membership,
 * and listing members. Complements `WorldRepository` which handles world CRUD.
 *
 * @example
 * const isMember = await getWorldAccessRepository().isUserInWorld(worldId, userId);
 * await getWorldAccessRepository().addUser(worldId, userId, token, 'player');
 * const members = await getWorldAccessRepository().getMembers(worldId);
 */
export interface WorldAccessRepository {
  /**
   * Check whether a user is a member or owner of a world.
   * Combines ownership check + access record check in a single call.
   */
  isUserInWorld(worldId: string, userId: string): Promise<boolean>;

  /**
   * Add a user to a world via an invite token.
   * The invite token is validated server-side; `userId` is used for cache tagging only.
   * @param userRole - The role to assign. Defaults to 'player'.
   */
  addUser(
    worldId: string,
    userId: string,
    inviteToken: string,
    userRole?: AccessRole,
  ): Promise<WorldAccess>;

  /**
   * Remove a user from a world (leave or kick).
   * The server enforces that a user can only remove themselves unless they are the owner.
   */
  removeUser(worldId: string, userId: string): Promise<void>;

  /**
   * Get all members of a world, joined with user profile data.
   * Returns null if the operation fails with failOpen enabled.
   */
  getMembers(worldId: string): Promise<(WorldAccess & { user: any })[] | null>;
}

// ----------------------------------------------------------------------------
// InviteRepository
// Manages invite link lifecycle: create, validate, delete, list.
// ----------------------------------------------------------------------------

/**
 * Repository for world invite link management.
 *
 * Invite tokens are short-lived, world-scoped links that allow new members to join.
 * Operations return `OperationResult` to handle failures gracefully (no throwing).
 *
 * @example
 * const { success, data } = await getInviteRepository().create({ worldId });
 * const { success, data: worldId } = await getInviteRepository().validate(token);
 */
export interface InviteRepository {
  /**
   * Create a new invite link for a world.
   * Returns the link as an `InviteLink` on success.
   */
  create(params: CreateInviteLinkParams): Promise<OperationResult<InviteLink>>;

  /**
   * Validate an invite token and return the associated world ID.
   * Returns `{ success: true, data: worldId }` on success, or an error message.
   */
  validate(token: string): Promise<OperationResult<string>>;

  /**
   * Delete an invite link. For manual management or cleanup.
   * Returns the deleted invite data (including world_id) so the caller can invalidate caches.
   */
  delete(token: string): Promise<OperationResult<InviteLink>>;

  /**
   * List all active (non-expired) invite links for a world.
   * For use in invite management UI.
   */
  listByWorld(worldId: string): Promise<OperationResult<InviteLink[]>>;
}

// ----------------------------------------------------------------------------
// UserSettingsRepository
// Manages per-user preferences stored in the backend.
// ----------------------------------------------------------------------------

/**
 * Repository for user settings and preferences.
 *
 * Settings are cached in local storage; implementations should respect
 * `CacheOptions` to control staleness.
 *
 * @example
 * const settings = await getUserSettingsRepository().fetchCurrentUserSettings();
 * await getUserSettingsRepository().updateAnalyticsConsentLevel('analytics');
 */
export interface UserSettingsRepository {
  /**
   * Fetch the current user's settings.
   * Returns null if no authenticated user or no settings record found.
   */
  fetchCurrentUserSettings(options?: CacheOptions): Promise<UserSettings | null>;

  /**
   * Update the analytics consent level for the current user.
   * Returns the updated level string.
   */
  updateAnalyticsConsentLevel(level: string): Promise<string>;
}

// ----------------------------------------------------------------------------
// FeatureFlagsRepository
// Manages feature flag data from the backend.
// NOTE: In the current Tier-3 architecture, flags are fetched via the Edge Function
// `get_feature_flags` (see lib/feature-flags/server-sync.ts). This repository
// interface is defined as a foundation for future abstraction; the Supabase
// implementation should delegate to that edge function, not query directly.
// ----------------------------------------------------------------------------

/**
 * Repository for feature flag data.
 *
 * **Current implementation note:** Flag data is served by the `get_feature_flags`
 * edge function (consolidated call) rather than direct table queries. The Supabase
 * implementation of this repository wraps that edge function.
 *
 * @example
 * const flags = await getFeatureFlagsRepository().getAll();
 * const overrides = await getFeatureFlagsRepository().getOverridesForUser(userId);
 */
export interface FeatureFlagsRepository {
  /**
   * Fetch all feature flags from the backend.
   * Returns an empty array if unavailable (graceful degradation).
   */
  getAll(): Promise<FeatureFlagRow[]>;

  /**
   * Fetch a single feature flag by its name.
   * Returns null if not found.
   */
  getByName(flagName: string): Promise<FeatureFlagRow | null>;

  /**
   * Fetch all per-user overrides for a given user.
   * Used to compute individual flag states.
   */
  getOverridesForUser(userId: string): Promise<FeatureFlagOverrideRow[]>;
}

// ----------------------------------------------------------------------------
// EntitlementsRepository
// Manages premium entitlements (subscription features, lifetime access, etc.)
// ----------------------------------------------------------------------------

/**
 * Repository for user premium entitlements.
 *
 * Entitlements represent features a user has paid for or been granted.
 * Checks should be done against the `FeatureFlagsManager`, not directly here;
 * this repository is the raw data layer underneath.
 *
 * @example
 * const entitlements = await getEntitlementsRepository().getByUserId(userId);
 * const hasFeature = await getEntitlementsRepository().hasEntitlement(userId, 'premium');
 */
export interface EntitlementsRepository {
  /**
   * Fetch all active entitlements for a given user.
   */
  getByUserId(userId: string): Promise<EntitlementRow[]>;

  /**
   * Check if a user has a specific active entitlement.
   */
  hasEntitlement(userId: string, entitlementKey: string): Promise<boolean>;

  /**
   * Fetch all override records for a given user (used by feature flag evaluation).
   */
  getOverridesByUserId(userId: string): Promise<EntitlementOverrideRow[]>;

  /**
   * Set the reminder flag on a specific entitlement (for expiry notifications).
   */
  setReminderFlag(entitlementId: string, remind: boolean): Promise<void>;

  /**
   * Fetch all entitlements that should remind the user (i.e., expiring soon).
   */
  getRemindable(userId: string): Promise<EntitlementRow[]>;

  /**
   * Fetch expired entitlements for cleanup or audit purposes.
   */
  getExpired(userId: string): Promise<EntitlementRow[]>;

  /**
   * Fetch expired entitlements before a given cutoff date.
   * Used by system cleanup jobs (not user-facing); no userId filter.
   */
  getExpiredBeforeDate(cutoffDate: string): Promise<EntitlementRow[]>;

  /**
   * Deactivate (soft-delete) entitlements by their IDs.
   */
  deactivate(entitlementIds: string[]): Promise<void>;
}
