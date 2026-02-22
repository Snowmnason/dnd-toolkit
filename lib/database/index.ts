/**
 * Database Module - Barrel Export
 *
 * Supabase PostgreSQL database layer with type-safe data operations.
 * See README.md for comprehensive API documentation and schema overview.
 *
 * Note: Direct Supabase client access (supabase, getSupabaseClient, isSupabaseConfigured)
 * is no longer re-exported here. Use getDatabaseProvider() for all database queries,
 * or import from @/lib/services/supabase/supabase-initializer for bootstrap-level access.
 */

// Database provider — use this for all entity queries
export { getDatabaseProvider } from "@/lib/services";

// Common utilities
export {
    executeParallelQueries,
    getCurrentUserProfile,
    validateUserForWrite
} from "./common";

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

