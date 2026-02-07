/**
 * Shared types for get_feature_flags Edge Function
 * These types mirror the database schema and client-side types
 */

export type OverrideTargetType = "flag" | "entitlement";

/**
 * Feature flag row from database
 */
export interface FeatureFlagRow {
  flag_name: string;
  enabled: boolean;
  kind: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Entitlement row from database
 */
export interface EntitlementRow {
  id: string;
  user_id: string;
  key: string;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

/**
 * Feature flag override row from database
 */
export interface FeatureFlagOverrideRow {
  id: string;
  user_id: string;
  target_type: OverrideTargetType;
  target_name: string;
  enabled: boolean;
  expires_at: string | null;
  revoked: boolean;
  reason?: string;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Response structure from Edge Function
 * Client expects this exact structure for caching and merge logic
 */
export interface GetFeatureFlagsResponse {
  flags: FeatureFlagRow[];
  entitlements: EntitlementRow[];
  overrides: FeatureFlagOverrideRow[]; // Only includes non-revoked, non-expired overrides
  fetchedAt: number;
  version: "v1";
}

/**
 * JWT claims from Supabase auth token
 */
export interface JWTClaims {
  sub: string; // User ID
  email?: string;
  aud?: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}
