/**
 * Network Configuration Constants
 *
 * Centralized configuration for network detection and monitoring.
 * These constants define behavior for ping detection, timeouts, and external endpoints.
 * Configuration is loaded from appsettings.json/appsettings.dev.json.
 */

import { getAppConfig } from "@/lib/config";
import { getHealthEndpointUrl } from "@/lib/edge-functions/constants";

/**
 * Get the Supabase health endpoint for network checks
 *
 * Why the health Edge Function?
 * - Public endpoint (no authentication required)
 * - Returns 200 OK on success
 * - No 401 errors from unauthenticated pings
 * - CSP policy already permits /functions/v1/ calls
 * - Avoids 401 noise in console logs
 *
 * Configuration fallback chain:
 * 1. EXPO_PUBLIC_SUPABASE_HEALTH_ENDPOINT: Explicit override (for testing)
 * 2. EXPO_PUBLIC_SUPABASE_URL: Environment variable
 * 3. Constants.expoConfig?.extra?.supabaseUrl: From app.json (supports dev/ejected builds)
 * Falls back to: SUPABASE_URL + /functions/v1/health (see lib/edge-functions/constants.ts)
 *
 * This ensures network detection works in all configurations:
 * - Production (env vars set)
 * - Development (app.json extra.supabaseUrl)
 * - Testing (explicit override via EXPO_PUBLIC_SUPABASE_HEALTH_ENDPOINT)
 *
 * @returns The Supabase health endpoint URL, or empty string if not configured
 * @see lib/edge-functions/constants.ts#getHealthEndpointUrl for full fallback logic
 */
export function getSupabaseHealthEndpoint(): string {
  return getHealthEndpointUrl();
}

/**
 * Supabase API endpoint used for network health checks
 * @deprecated Use getSupabaseHealthEndpoint() instead for dynamic configuration
 */
export const SUPABASE_HEALTH_ENDPOINT = getSupabaseHealthEndpoint();

/**
 * Get web platform ping interval from config (default: 10 minutes)
 * How often to perform network health checks when app is visible
 * Note: Increased from 5 to 10 minutes to reduce health check spam
 */
export function getWebPingInterval(): number {
  return getAppConfig().network?.pingIntervalMs ?? 10 * 60 * 1000;
}

/**
 * Get web platform ping timeout from config (default: 5 seconds)
 * Maximum time to wait for ping response before considering it failed
 */
export function getWebPingTimeout(): number {
  return getAppConfig().network?.pingTimeoutMs ?? 5000;
}

/**
 * Get status check timeout from config (default: 30 seconds)
 * Maximum time for network status checks before timeout
 */
export function getStatusCheckTimeout(): number {
  return getAppConfig().network?.statusCheckTimeoutMs ?? 30000;
}

/**
 * Get network status change debounce delay from config (default: 500ms)
 * Prevents excessive notifications on flaky connections
 */
export function getDebounceStatusChangeMs(): number {
  return getAppConfig().network?.debounceStatusChangeMs ?? 500;
}

/**
 * Latency threshold for poor connection detection (500ms)
 * Pings exceeding this latency are considered "bad" connection
 */
export const LATENCY_THRESHOLD = 500;

/**

 * Low battery threshold (20%)
 * When battery drops below this, cellular connections are marked as "expensive"
 */
export const LOW_BATTERY_THRESHOLD = 0.2;
