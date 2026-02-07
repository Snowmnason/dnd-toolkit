/**
 * Invite Link Cleanup Edge Function
 *
 * Periodic cleanup of expired invite links from the database.
 * Designed to be called by Supabase scheduled functions or external cron jobs.
 *
 * **Request:**
 * ```
 * POST /functions/v1/invite-link-cleanup?dry_run=false
 * ```
 *
 * **Query Parameters:**
 * - `dry_run` (boolean): If true, returns count without deleting. Default: false
 *
 * **Response (Success):**
 * ```
 * HTTP 200 OK
 * {
 *   "status": "ok",
 *   "deleted": 42,
 *   "message": "42 expired invite link(s) removed.",
 *   "timestamp": 1707230400000
 * }
 * ```
 *
 * **Response (Dry Run):**
 * ```
 * HTTP 200 OK
 * {
 *   "status": "ok",
 *   "dry_run": true,
 *   "would_delete": 42,
 *   "timestamp": 1707230400000
 * }
 * ```
 *
 * **Response (Error):**
 * ```
 * HTTP 500 Internal Server Error
 * {
 *   "status": "error",
 *   "message": "Failed to run cleanup",
 *   "details": "Connection timeout",
 *   "timestamp": 1707230400000
 * }
 * ```
 */

import process from "node:process";
import { Client } from "npm:pg@8.11.0";

const DATABASE_URL = process.env.SUPABASE_DB_URL;

Deno.serve(async (req: Request) => {
  const startTime = Date.now();

  // Only allow POST requests
  if (req.method !== "POST") {
    return json(
      {
        error: "Method not allowed",
        allowed: ["POST"],
      },
      405,
    );
  }

  if (!DATABASE_URL) {
    console.error("SUPABASE_DB_URL not configured");
    return json(
      {
        status: "error",
        message: "Database not configured",
        timestamp: Date.now(),
      },
      500,
    );
  }

  const client = new Client({ connectionString: DATABASE_URL });
  let connected = false;

  try {
    await client.connect();
    connected = true;
    console.log("Connected to database");

    // Support dry run: ?dry_run=true returns count without deleting
    const url = new URL(req.url);
    const dryRun = url.searchParams.get("dry_run") === "true";

    if (dryRun) {
      console.log("Running in dry-run mode");
      const countRes = await client.query(
        "SELECT count(*)::int AS cnt FROM public.invite_links WHERE expires_at < now();",
      );
      const cnt =
        countRes && countRes.rows && countRes.rows[0]
          ? countRes.rows[0].cnt
          : 0;

      console.log(`Dry run: would delete ${cnt} expired invite link(s)`);

      return json(
        {
          status: "ok",
          dry_run: true,
          would_delete: cnt,
          timestamp: Date.now(),
        },
        200,
      );
    }

    // Execute actual deletion
    console.log("Running actual cleanup");
    const result = await client.query(
      "DELETE FROM public.invite_links WHERE expires_at < now();",
    );
    const deleted =
      result && (result as any).rowCount ? (result as any).rowCount : 0;

    console.log(`Successfully deleted ${deleted} expired invite link(s)`);

    return json(
      {
        status: "ok",
        deleted,
        message: `${deleted} expired invite link(s) removed.`,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
      },
      200,
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Cleanup failed:", errorMsg, {
      connected,
      duration: Date.now() - startTime,
    });

    return json(
      {
        status: "error",
        message: "Failed to run cleanup",
        details: errorMsg,
        timestamp: Date.now(),
      },
      500,
    );
  } finally {
    // Properly close the connection and log any errors
    if (connected) {
      try {
        await client.end();
        console.log("Connection closed");
      } catch (closeError) {
        const errorMsg =
          closeError instanceof Error ? closeError.message : String(closeError);
        console.warn("Failed to close database connection:", errorMsg);
        // Don't return error - connection close failure shouldn't fail the request
      }
    }
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
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
