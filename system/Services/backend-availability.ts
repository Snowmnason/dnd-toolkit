/**
 * Backend Availability — Provider-agnostic backend checks
 *
 * Wraps the concrete backend implementation (Supabase) so that callers
 * outside `system/Services/supabase/` never import the concrete client.
 *
 * Used by:
 *   - system/Kernel/app-kernel.ts (capability detection)
 *   - system/Network/ (health endpoint URL)
 */

import Constants from 'expo-constants';

/**
 * Check whether the backend is configured with valid credentials.
 * Returns `true` when the required env vars / config values are present.
 *
 * This is a **static** check (env vars at build time) — it does NOT
 * verify the backend is reachable or that the provider is initialised.
 */
export async function isBackendAvailable(): Promise<boolean> {
  try {
    const { isSupabaseConfigured } = await import(
      './supabase/supabase-client'
    );
    return isSupabaseConfigured();
  } catch {
    return false;
  }
}

/**
 * Get the base backend project URL (e.g. `https://xxxx.supabase.co`).
 * Returns an empty string when no URL is configured.
 *
 * This is read from the same env var / expo-constants value that the
 * concrete Supabase client uses, so it stays in sync automatically.
 */
export function getBackendProjectUrl(): string {
  const url =
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    Constants.expoConfig?.extra?.supabaseUrl;

  if (!url || !url.trim()) return '';
  return url.replace(/\/+$|\s+/g, '');
}

/**
 * Get the backend health-check endpoint URL.
 *
 * Priority:
 *  1. Explicit override via `EXPO_PUBLIC_SUPABASE_HEALTH_ENDPOINT`
 *  2. Built from project URL + `/functions/v1/health`
 *  3. Empty string (not configured)
 */
export function getBackendHealthUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_SUPABASE_HEALTH_ENDPOINT;
  if (explicit && explicit.trim()) return explicit.trim();

  const base = getBackendProjectUrl();
  if (!base) return '';

  return `${base}/functions/v1/health`;
}
