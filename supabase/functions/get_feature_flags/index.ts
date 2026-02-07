/**
 * get_feature_flags Edge Function
 *
 * Consolidates feature flags, entitlements, and per-user overrides into a single RPC call.
 * Runs server-side to optimize performance and prepare for Phase 2 additions (bucketing, conditions, audit).
 *
 * **Flow:**
 * 1. Validate Bearer token (JWT from Supabase auth)
 * 2. Extract userId from token
 * 3. Fetch flags + entitlements + overrides in parallel
 * 4. Filter overrides by target_type on server-side
 * 5. Return consolidated response
 *
 * **Client-side responsibilities (unchanged):**
 * - Cache response (SecureStorage)
 * - Merge logic (override > entitlement > flag)
 * - Offline handling (use cached values)
 *
 * **Priority (in FeatureFlagsManager):**
 * 1. Manual override (admin testing, local)
 * 2. Remote override (server-side, per-user)
 * 3. Remote config (server flags + entitlements)
 * 4. Local config (hardcoded fallback)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { jwtVerify } from "https://esm.sh/jose@5.0.0";
import {
    fetchEntitlementsByUserId,
    fetchFeatureFlags,
    fetchOverridesByUserId,
} from "./queries.ts";
import type { GetFeatureFlagsResponse, JWTClaims } from "./types.ts";

/**
 * Verify JWT token and extract claims
 * Uses Supabase's JWT secret to validate token authenticity
 */
async function verifyToken(
  authHeader: string | null,
): Promise<JWTClaims | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("Missing or invalid Authorization header");
    return null;
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix
  const jwtSecret = Deno.env.get("SUPABASE_JWT_SECRET");

  if (!jwtSecret) {
    console.error("SUPABASE_JWT_SECRET not configured");
    throw new Error("Server misconfiguration: JWT secret not found");
  }

  try {
    // Verify JWT signature using Supabase secret
    const secret = new TextEncoder().encode(jwtSecret);
    const verified = await jwtVerify(token, secret);

    // Extract claims
    const claims = verified.payload as JWTClaims;

    if (!claims.sub) {
      console.log("JWT does not contain sub (user ID)");
      return null;
    }

    return claims;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log("JWT verification failed:", errorMsg);
    return null;
  }
}

/**
 * Main handler for get_feature_flags function
 */
serve(async (req: Request) => {
  const startTime = Date.now();

  // Only allow POST requests
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    // 1. Validate Bearer token
    const authHeader = req.headers.get("Authorization");
    const claims = await verifyToken(authHeader);

    if (!claims) {
      console.warn("Token verification failed");
      return json({ error: "Unauthorized" }, 401);
    }

    const userId = claims.sub;
    console.info(`Authenticated user: ${userId}`);

    // 2. Fetch all three data sources in parallel
    let flags, entitlements, overrides;

    try {
      [flags, entitlements, overrides] = await Promise.all([
        fetchFeatureFlags(),
        fetchEntitlementsByUserId(userId),
        fetchOverridesByUserId(userId),
      ]);
    } catch (fetchError) {
      const errorMsg =
        fetchError instanceof Error ? fetchError.message : String(fetchError);
      console.error("Failed to fetch data sources:", errorMsg);
      return json(
        {
          error: "Failed to fetch configuration",
          message: errorMsg,
        },
        500,
      );
    }

    console.info("Data fetched successfully", {
      flags: flags.length,
      entitlements: entitlements.length,
      overrides: overrides.length,
    });

    // 3. Build response
    const response: GetFeatureFlagsResponse = {
      flags,
      entitlements,
      overrides, // Both flag and entitlement type overrides; client filters as needed
      fetchedAt: Date.now(),
      version: "v1",
    };

    const duration = Date.now() - startTime;
    console.info(`Request completed in ${duration}ms`);

    return json(response, 200);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Unexpected error in get_feature_flags:", errorMsg);

    return json(
      {
        error: "Internal server error",
        message: errorMsg,
        timestamp: Date.now(),
      },
      500,
    );
  }
});

/**
 * Helper to return JSON responses with consistent formatting
 */
function json(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
  });
}
