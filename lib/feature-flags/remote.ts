/**
 * Remote Feature Flags Client
 *
 * Calls Supabase Edge Function `get_feature_flags` to fetch server-side flags and entitlements.
 * Handles auth token injection via AuthLayer.
 * Supports ETag/version-based caching to avoid full payloads.
 */

import { AuthLayer, type AuthContext } from "@/lib/api/auth-layer";
import { logger } from "@/lib/utils/logger";

/**
 * Response from Supabase Edge Function `get_feature_flags`
 */
export interface GetFeatureFlagsResponse {
  flags: Record<string, { enabled: boolean; ttlMs?: number }>;
  entitlements: Record<string, { granted: boolean; expiresAt?: string | null }>;
  fetchedAt: number;
  version?: string;
  etag?: string;
}

/**
 * Call Supabase Edge Function to fetch feature flags and entitlements
 *
 * @param supabaseClient - Supabase client instance
 * @param options - Optional ETag/version for change detection
 * @returns Response or null on error (non-blocking)
 */
export async function getFeatureFlagsFromServer(
  supabaseClient: any,
  options?: {
    version?: string;
    etag?: string;
  },
): Promise<GetFeatureFlagsResponse | null> {
  try {
    // Build request body for version/ETag check
    const body: any = {};
    if (options?.version) {
      body.version = options.version;
    }
    if (options?.etag) {
      body.etag = options.etag;
    }

    // Call Edge Function with auth token injection via AuthLayer
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Inject auth header for 'user' strategy
    // This ensures the Edge Function knows which user is making the request
    const context: AuthContext = {
      url: "/functions/v1/get_feature_flags",
      method: "POST",
      endpoint: "feature_flags",
    };

    const headersWithAuth = await AuthLayer.injectAuthHeader(
      headers,
      "user",
      context,
    );

    logger.debug("feature_flags", "Calling get_feature_flags Edge Function", {
      hasAuth: !!headersWithAuth.Authorization,
      hasVersion: !!options?.version,
      hasEtag: !!options?.etag,
    });

    const response = await supabaseClient.functions.invoke(
      "get_feature_flags",
      {
        headers: headersWithAuth,
        body: Object.keys(body).length > 0 ? body : undefined,
      },
    );

    // Handle 304 Not Modified (use cache)
    if (response.status === 304 || response.data?.status === 304) {
      logger.debug(
        "feature_flags",
        "Edge Function returned 304 Not Modified - using cache",
      );
      return null; // Signal to use cached values
    }

    if (response.error) {
      logger.warn("feature_flags", "Edge Function call failed", {
        error: response.error,
      });
      return null;
    }

    const data: GetFeatureFlagsResponse = response.data;

    logger.info("feature_flags", "Feature flags fetched from server", {
      flagCount: Object.keys(data.flags || {}).length,
      entitlementCount: Object.keys(data.entitlements || {}).length,
      version: data.version,
    });

    return data;
  } catch (error) {
    logger.error(
      "feature_flags",
      "Failed to fetch feature flags from server:",
      error,
    );
    return null; // Non-blocking: return null to use cache
  }
}
