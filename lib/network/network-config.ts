/**
 * Network Configuration Constants
 *
 * Centralized configuration for network detection and monitoring.
 * These constants define behavior for ping detection, timeouts, and external endpoints.
 */

/**
 * Supabase API endpoint used for network health checks
 *
 * Why Supabase?
 * - Already whitelisted in Content Security Policy for API calls
 * - Reliable health endpoint at /rest/v1/
 * - Avoids CSP violations that would occur with Cloudflare or other endpoints
 *
 * This should match the configured Supabase URL in your environment.
 * Currently set to the DnD Toolkit Supabase project.
 */
export const SUPABASE_HEALTH_ENDPOINT =
  "https://xxoibawslmysvfllozyb.supabase.co/rest/v1/";

/**
 * Web platform ping interval (5 minutes)
 * How often to perform network health checks when app is visible
 */
export const WEB_PING_INTERVAL = 5 * 60 * 1000;

/**
 * Web platform ping timeout (5 seconds)
 * Maximum time to wait for ping response before considering it failed
 */
export const WEB_PING_TIMEOUT = 5000;

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
