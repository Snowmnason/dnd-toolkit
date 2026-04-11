/**
 * Trusted URL Origins
 *
 * Persists a user-approved set of external URL origins across sessions.
 * Origins are stored as `scheme://hostname(:port)` strings (e.g., `https://example.com`).
 *
 * Only the origin is stored — never the full path or query string.
 * This lets `https://example.com/page1` and `https://example.com/page2`
 * share a single trust decision.
 *
 * **Two levels of trust:**
 * 1. **Dev-approved** (below) — E.g., dnd-wiki, dnd-beyond tested and safe by team
 * 2. **User-approved** (persisted) — From "Trust and open" in the consent modal
 *
 * Used by `executeExternalNavigation` in navManager.ts:
 * - Check both lists before showing the consent modal.
 * - When the user selects "Trust and open", call `storeTrustedOrigin(url)` to persist.
 *
 * **To add dev-approved origins:**
 * Add the origin string to `DEV_APPROVED_ORIGINS` below (e.g., `https://dnd-wiki.com`).
 * No user consent needed for these links.
 */

import { STORAGE_KEYS } from '@/maps/storage-keys';
import { DEV_APPROVED_ORIGINS } from '@/maps/trusted-origins';
import { persistValue, retrieveValue } from '@/middleware/storage';

/**
 * Extract the origin (scheme + hostname + port) from a URL string.
 * Returns null if the URL is malformed.
 */
function extractOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Check if the origin of the given URL has been previously trusted (by user or dev).
 *
 * Checks two lists in order:
 * 1. Dev-approved origins (always allowed)
 * 2. User-approved origins (from "Trust and open" consent)
 *
 * @param url - Full external URL (e.g., `https://example.com/some/path`).
 * @returns true if the origin is in either list; false otherwise or on any error.
 */
export async function isTrustedOrigin(url: string): Promise<boolean> {
  const origin = extractOrigin(url);
  if (!origin) return false;

  // Check dev-approved origins first (always allowed)
  if (DEV_APPROVED_ORIGINS.includes(origin)) return true;

  // Check user-approved origins (persisted)
  const result = await retrieveValue<string[]>(STORAGE_KEYS.TRUSTED_URL_ORIGINS);
  if (!result.success || !result.data) return false;

  return result.data.includes(origin);
}

/**
 * Add the origin of the given URL to the trusted origins list.
 *
 * Reads the current list, appends the new origin (if not already present),
 * and writes it back. Silent on storage failure — trust storage is best-effort.
 *
 * @param url - Full external URL whose origin should be trusted.
 */
export async function storeTrustedOrigin(url: string): Promise<void> {
  const origin = extractOrigin(url);
  if (!origin) return;
    //TODO: move to storge manager and add error handling/logging if storage fails
  const result = await retrieveValue<string[]>(STORAGE_KEYS.TRUSTED_URL_ORIGINS);
  const current = result.success && Array.isArray(result.data) ? result.data : [];

  if (current.includes(origin)) return;

  await persistValue(STORAGE_KEYS.TRUSTED_URL_ORIGINS, [...current, origin]);
}
