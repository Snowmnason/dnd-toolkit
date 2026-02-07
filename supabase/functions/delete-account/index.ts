/**
 * Delete Account Edge Function
 *
 * Securely deletes a user account and all associated data.
 * Requires valid JWT authentication - user can only delete their own account.
 *
 * **Flow:**
 * 1. Validate caller using JWT token
 * 2. Delete user data from app tables (cascades handle dependents)
 * 3. Delete the Supabase auth user
 * 4. Return success
 *
 * **Request:**
 * ```
 * POST /functions/v1/delete-account
 * Authorization: Bearer {JWT_TOKEN}
 * ```
 *
 * **Response (Success):**
 * ```
 * HTTP 200 OK
 * {
 *   "success": true,
 *   "message": "Account deleted successfully",
 *   "timestamp": 1707230400000
 * }
 * ```
 *
 * **Response (Unauthorized):**
 * ```
 * HTTP 401 Unauthorized
 * {
 *   "error": "Missing or invalid Authorization header"
 * }
 * ```
 *
 * **Response (Error):**
 * ```
 * HTTP 500 Internal Server Error
 * {
 *   "error": "Failed to delete account",
 *   "message": "Database error message",
 *   "timestamp": 1707230400000
 * }
 * ```
 */

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// CORS helper (adjust origin if you want to restrict)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

console.info("delete-account function: initialized");

// Deno.serve entry
Deno.serve(async (req: Request) => {
  const startTime = Date.now();

  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    // 1) Validate caller (must be logged in) using the user's JWT
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      console.warn("Missing or invalid Authorization header");
      return json({ error: "Missing or invalid Authorization header" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
      console.error("Missing Supabase environment variables");
      return json({ error: "Server misconfigured" }, 500);
    }

    // Client scoped as the end-user (for auth.getUser)
    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userErr,
    } = await asUser.auth.getUser();

    if (userErr || !user) {
      console.warn("User authentication failed");
      return json({ error: "Unauthorized" }, 401);
    }

    console.info(`Deleting account for user: ${user.id}`);

    // 2) Admin client (service role) to bypass RLS and call Admin API
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 2a) Delete from app tables first (cascades will clear dependents)
    //     Assumes public.users.auth_id stores auth.users.id
    try {
      const { error: appDelErr } = await admin
        .from("users")
        .delete()
        .eq("auth_id", user.id);

      if (appDelErr) {
        console.error("App data deletion failed:", appDelErr.message);
        return json(
          {
            error: "Failed to delete account data",
            message: appDelErr.message,
          },
          400,
        );
      }

      console.info(`App data deleted for user: ${user.id}`);
    } catch (appDeleteError) {
      const errorMsg =
        appDeleteError instanceof Error
          ? appDeleteError.message
          : String(appDeleteError);
      console.error("App deletion error:", errorMsg);
      return json(
        {
          error: "Failed to delete account data",
          message: errorMsg,
        },
        500,
      );
    }

    // Optional: if you keep user files in Storage, delete them here
    // Example: await admin.storage.from('user-avatars').remove([`users/${user.id}/avatar.png`]);

    // 2b) Delete the auth user
    try {
      const { error: authDelErr } = await admin.auth.admin.deleteUser(user.id);

      if (authDelErr) {
        console.error("Auth deletion failed:", authDelErr.message);
        return json(
          {
            error: "Failed to delete auth account",
            message: authDelErr.message,
          },
          400,
        );
      }

      console.info(`Auth deleted for user: ${user.id}`);
    } catch (authDeleteError) {
      const errorMsg =
        authDeleteError instanceof Error
          ? authDeleteError.message
          : String(authDeleteError);
      console.error("Auth deletion error:", errorMsg);
      return json(
        {
          error: "Failed to delete auth account",
          message: errorMsg,
        },
        500,
      );
    }

    const duration = Date.now() - startTime;
    console.info(`Account deleted successfully in ${duration}ms`);

    return json(
      {
        success: true,
        message: "Account deleted successfully",
        timestamp: Date.now(),
      },
      200,
    );
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error("Unexpected error in delete-account:", errorMsg);
    return json(
      {
        error: "Failed to delete account",
        message: errorMsg,
        timestamp: Date.now(),
      },
      500,
    );
  }
});

// Small helper for JSON + CORS
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      Connection: "keep-alive",
      ...corsHeaders,
    },
  });
}
