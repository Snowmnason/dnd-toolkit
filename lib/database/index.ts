/**
 * Database Module - Barrel Export
 *
 * Supabase PostgreSQL database layer with type-safe data operations.
 * See README.md for comprehensive API documentation and schema overview.
 *
 * Note: Direct Supabase client access (supabase, getSupabaseClient, isSupabaseConfigured)
 * is no longer re-exported here. Use getDatabase() from @/lib/services for all database queries,
 * or import from @/lib/services/supabase/supabase-initializer for bootstrap-level access.
 */

// Common utilities
export {
  executeParallelQueries,
  executeSyncMutationHandler,
  getCurrentAuthId,
  getCurrentUserProfile,
  isDatabaseConfigured,
  requireUserProfile,
  validateCurrentUser,
  validateUserForWrite
} from "./database-manager";

// Repository pattern
export {
  getInviteRepository, getUserRepository,
  getWorldAccessRepository,
  getWorldRepository
} from "./repositories";

// User operations
export { usersDB } from "./users";
export type { CreateUserData, UpdateUserData, User } from "./users";

// User settings operations
export { userSettingsDB } from "./user_settings";
export type { UserSettings } from "./user_settings";

// World operations
export { worldsDB } from "./worlds";
export type {
  AccessRole,
  CreateWorldData,
  World,
  WorldAccess,
  WorldWithAccess
} from "./worlds";

// Invite operations
export {
  createInviteLink,
  deleteInviteLink,
  getWorldInviteLinks,
  invitesDB,
  validateInviteToken
} from "./invites";

// Entitlements operations
export {
  deactivateEntitlements,
  fetchEntitlementOverridesByUserId,
  fetchEntitlementsByUserId,
  fetchExpiredEntitlements,
  hasEntitlement,
  type EntitlementOverrideRow,
  type EntitlementRow
} from "./entitlements";

// Feature flags operations
export type { FeatureFlagRow } from "./feature-flags";

// Feature flag overrides operations
export type {
  FeatureFlagOverrideRow,
  OverrideTargetType
} from "./feature-flag-overrides";

// Edge function registry
export {
  executeEdgeFunction,
  getRegisteredEdgeFunctions,
  isEdgeFunctionRegistered,
  registerEdgeFunction,
  type EdgeFunctionImplementation
} from "./edge";

