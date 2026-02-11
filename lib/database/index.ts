/**
 * Database Module - Barrel Export
 *
 * Supabase PostgreSQL database layer with type-safe data operations.
 * See README.md for comprehensive API documentation and schema overview.
 */

// Supabase client setup
export { getSupabaseClient, isSupabaseConfigured, supabase } from "./supabase";

// Common utilities
export {
  executeParallelQueries,
  getCurrentUserProfile,
  validateUserForWrite
} from "./common";

// User operations
export { usersDB } from "./users";
export type { CreateUserData, UpdateUserData, User } from "./users";

// World operations
export { worldsDB } from "./worlds";
export type {
  AccessRole,
  CreateWorldData,
  UserRole,
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
  fetchEntitlementOverridesByUserId,
  fetchEntitlementsByUserId,
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

