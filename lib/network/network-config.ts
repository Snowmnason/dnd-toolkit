/**
 * Network Configuration Constants
 *
 * Centralized configuration for network detection and monitoring.
 * These constants define behavior for ping detection, timeouts, and external endpoints.
 * Configuration is loaded from appsettings.json/appsettings.dev.json.
 */

import { getAppConfig } from "@/lib/config";
import Constants from "expo-constants";

/**
 * Get the Supabase health endpoint for network checks
 *
 * Why Supabase?
 * - Already whitelisted in Content Security Policy for API calls
 * - Reliable health endpoint at /rest/v1/
 * - Avoids CSP violations that would occur with Cloudflare or other endpoints
 *
 * Uses environment variables for environment-agnostic configuration:
 * - EXPO_PUBLIC_SUPABASE_URL: Configured via .env or app.json
 * - Falls back to Constants.expoConfig?.extra?.supabaseUrl for development
 *
 * @returns The Supabase health endpoint URL, or empty string if not configured
 */
export function getSupabaseHealthEndpoint(): string {
  // Allow explicit override of the health endpoint for testing or to point
  // to a public, unauthenticated health route (recommended to avoid 401 noise).
  const explicit = process.env.EXPO_PUBLIC_SUPABASE_HEALTH_ENDPOINT;
  if (explicit) return explicit;

  const supabaseUrl =
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    Constants.expoConfig?.extra?.supabaseUrl;

  if (!supabaseUrl) {
    return "";
  }

  // Normalize: strip any trailing slashes then append the path
  const normalized = supabaseUrl.replace(/\/+$|\s+/g, "");
  return `${normalized}/rest/v1/`;
}

/**
 * Supabase API endpoint used for network health checks
 * @deprecated Use getSupabaseHealthEndpoint() instead for dynamic configuration
 */
export const SUPABASE_HEALTH_ENDPOINT = getSupabaseHealthEndpoint();

/**
 * Get web platform ping interval from config (default: 5 minutes)
 * How often to perform network health checks when app is visible
 */
export function getWebPingInterval(): number {
  return getAppConfig().network?.pingIntervalMs ?? 5 * 60 * 1000;
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
 * Latency threshold for poor connection detection (500ms)
 * Pings exceeding this latency are considered "bad" connection
 */
export const LATENCY_THRESHOLD = 500;

/**
 * Low battery threshold (20%)
 * When battery drops below this, cellular connections are marked as "expensive"
 */
export const LOW_BATTERY_THRESHOLD = 0.2;
