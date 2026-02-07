/**
 * Health Check Edge Function
 *
 * Public endpoint for network availability checks.
 * No authentication required - returns 200 OK if the system is operational.
 *
 * Used by: Network detection code to verify connectivity without auth errors.
 * Prevents 401 noise from unauthenticated pings.
 *
 * **Request:**
 * ```
 * HEAD or GET /functions/v1/health
 * ```
 *
 * **Response (Success):**
 * ```
 * HTTP 200 OK
 * {
 *   "status": "ok",
 *   "timestamp": 1707230400000,
 *   "uptime": 3600000,
 *   "version": "1.0"
 * }
 * ```
 *
 * **Response (Maintenance):**
 * ```
 * HTTP 503 Service Unavailable
 * {
 *   "status": "maintenance",
 *   "message": "System is under maintenance"
 * }
 * ```
 */

const startTime = Date.now();
const VERSION = "1.0";

Deno.serve(async (req: Request) => {
  // Support both HEAD and GET requests
  if (req.method !== "GET" && req.method !== "HEAD") {
    return json(
      {
        error: "Method not allowed",
        allowed: ["GET", "HEAD"],
      },
      405,
    );
  }

  try {
    // Check for maintenance mode (optional environment variable)
    const maintenanceMode = Deno.env.get("MAINTENANCE_MODE") === "true";
    if (maintenanceMode) {
      return json(
        {
          status: "maintenance",
          message: "System is under maintenance",
          timestamp: Date.now(),
        },
        503,
      );
    }

    // Return health status
    const response = {
      status: "ok",
      timestamp: Date.now(),
      uptime: Date.now() - startTime,
      version: VERSION,
    };

    return json(response, 200);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Health check error:", errorMsg);

    return json(
      {
        status: "error",
        message: "Health check failed",
        error: errorMsg,
        timestamp: Date.now(),
      },
      500,
    );
  }
});

/**
 * Helper to return JSON responses
 */
function json(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
