/**
 * Edge Functions URL Constants
 *
 * Central registry of all Supabase Edge Function endpoints.
 * All URLs use the `/functions/v1/` prefix which is appended to EXPO_PUBLIC_SUPABASE_URL.
 *
 * **Usage:**
 * ```typescript
 * import { EDGE_FUNCTIONS } from "@/lib/database/edge/constants";
 *
 * // Get full URL
 * const fullUrl = `${supabaseUrl}${EDGE_FUNCTIONS.GET_FEATURE_FLAGS}`;
 *
 * // Or use the getEdgeFunctionUrl helper
 * const fullUrl = getEdgeFunctionUrl(EDGE_FUNCTIONS.GET_FEATURE_FLAGS);
 * ```
 */

/**
 * Edge Function endpoint paths (relative to Supabase project)
 * All paths start with `/functions/v1/`
 */
export const EDGE_FUNCTIONS = {
  /**
   * Health Check Endpoint
   * - Public (no auth required)
   * - GET or HEAD
   * - Returns: { status: "ok", timestamp, uptime, version }
   * - Purpose: Network availability checks without authentication
   * - URL: /functions/v1/health
   */
  HEALTH: "/functions/v1/health",

  /**
   * Get Feature Flags Endpoint
   * - Authenticated (requires JWT)
   * - POST
   * - Returns: { flags, entitlements, overrides, fetchedAt, version }
   * - Purpose: Fetch consolidated feature flags, entitlements, and per-user overrides
   * - URL: /functions/v1/get_feature_flags
   * - Called by: lib/feature-flags/server-sync.ts
   */
  GET_FEATURE_FLAGS: "/functions/v1/get_feature_flags",

  /**
   * Delete Account Endpoint
   * - Authenticated (requires JWT)
   * - POST
   * - Returns: { success: true, message, timestamp }
   * - Purpose: Delete user account and all associated data
   * - URL: /functions/v1/delete-account
   * - Called by: lib/database/users.ts (deleteCurrentUser)
   */
  DELETE_ACCOUNT: "/functions/v1/delete-account",

  /**
   * Invite Link Cleanup Endpoint
   * - Scheduled (typically called by Supabase cron or external scheduler)
   * - POST
   * - Query params: ?dry_run=true|false
   * - Returns: { status: "ok", deleted|would_delete, timestamp }
   * - Purpose: Remove expired invite links from database
   * - URL: /functions/v1/invite-link-cleanup
   * - Usage: Typically scheduled via Supabase functions (cron integration)
   */
  INVITE_LINK_CLEANUP: "/functions/v1/invite-link-cleanup",
} as const;

/**
 * Build full Edge Function URL from Supabase project URL and function path
 *
 * @param functionPath - Relative path from EDGE_FUNCTIONS constants
 * @param supabaseUrl - Base Supabase project URL (e.g., https://xxxx.supabase.co)
 * @returns Full Edge Function URL
 *
 * @example
 * ```typescript
 * const url = getEdgeFunctionUrl(EDGE_FUNCTIONS.HEALTH, "https://xxxx.supabase.co");
 * // Returns: "https://xxxx.supabase.co/functions/v1/health"
 * ```
 */
export function getEdgeFunctionUrl(
  functionPath: string,
  supabaseUrl: string,
): string {
  if (!supabaseUrl || !supabaseUrl.trim()) {
    throw new Error("Supabase URL is required to build Edge Function URL");
  }

  // Normalize: strip trailing slashes and spaces
  const normalized = supabaseUrl.replace(/\/+$|\s+/g, "");

  if (!normalized) {
    throw new Error("Supabase URL is required to build Edge Function URL");
  }

  return `${normalized}${functionPath}`;
}
