/**
 * Storage Backend Configuration
 *
 * Defines which backend and encryption strategy each storage key should use:
 * - 'localStorage': Persistent across sessions, ENCRYPTED via EncryptedStorage
 *   Used for: sensitive auth/user data (user_data, connected_worlds, preferences)
 * - 'sessionStorage': Ephemeral (cleared on session end), UNENCRYPTED for performance
 *   Used for: query cache and metadata (refetchable from server)
 * - 'secure': Persistent, ENCRYPTED via EncryptedStorage (same as localStorage)
 *   Used for: explicitly sensitive data requiring encryption guarantee
 *
 * ENCRYPTION STRATEGY:
 * - 'localStorage' and 'secure': Always encrypted via EncryptedStorage (AES-256-CTR + HMAC-SHA256)
 * - 'sessionStorage': Never encrypted (performance optimization for ephemeral cache)
 *
 * This is the single source of truth for storage routing.
 * Update here when adding new storage keys.
 */

export type StorageBackend = "localStorage" | "sessionStorage" | "secure";

export interface StorageKeyConfig {
  key: string;
  backend: StorageBackend;
  description: string;
}

/**
 * Storage configuration mapping
 * Format: Record<STORAGE_KEY, StorageBackend>
 */
export const STORAGE_BACKEND_CONFIG: Record<string, StorageBackend> = {
  // =============== localStorage (Persistent, Sensitive) ===============
  // Auth state - must persist across sessions (shared infrastructure)
  "sno:auth:has_account": "localStorage",
  "sno:auth:user_data": "localStorage",
  "sno:auth:user_data_meta": "localStorage",
  "sno:auth:user_data_timestamp": "localStorage",
  "sno:auth:last_logged_in": "localStorage",
  "sno:auth:attempts": "localStorage",

  // App-level state - must persist across sessions (DnD-specific)
  "dnd:app:connected_worlds": "localStorage",

  // User preferences - must persist across sessions (shared infrastructure)
  "sno:user:theme": "localStorage",
  "sno:user:theme_mode": "localStorage",
  "sno:user:scale": "localStorage",

  // Dev settings - must persist across sessions (shared infrastructure)
  "sno:dev:mode": "localStorage",

  // Invites - important auth flow state (DnD-specific)
  "dnd:invite:pending": "localStorage",

  // Offline sync queue - user mutations with sensitive payload data, must be encrypted (shared infrastructure)
  "sno:offline:mutation_queue": "secure",

  // =============== sessionStorage (Ephemeral, Cache) ===============
  // Query cache - refetchable on demand, can use faster unencrypted storage
  // Pattern: query_cache_*
  "query_cache_worlds:ids:*": "sessionStorage",
  "query_cache_worlds:user:*": "sessionStorage",
  "query_cache_worlds:user:current": "sessionStorage",

  // World access cache - loadable from Supabase, can be cleared
  // Pattern: world_access_*, world_access_meta_*
  "world_access_*": "sessionStorage",
  "world_access_meta_*": "sessionStorage",

  // Session-specific tracking
  ldcsv: "sessionStorage", // Last cache sync value
  "dnd:session:last_selected_world": "sessionStorage",
  "dnd:session:last_user_role": "sessionStorage",

  // =============== Secure (Encrypted, Default) ===============
  // All other keys default to secure storage
  "*": "secure",
};

/**
 * Determine which backend a storage key should use
 * Supports wildcards: 'prefix*' matches any key starting with 'prefix'
 */
export function getStorageBackend(key: string): StorageBackend {
  // Exact match first

  if (key in STORAGE_BACKEND_CONFIG) {
    // eslint-disable-next-line security/detect-object-injection
    return STORAGE_BACKEND_CONFIG[key];
  }

  // Wildcard match (e.g., 'query_cache_*' matches 'query_cache_worlds:ids:abc123')
  for (const configKey of Object.keys(STORAGE_BACKEND_CONFIG)) {
    if (configKey.endsWith("*")) {
      const prefix = configKey.slice(0, -1);
      if (key.startsWith(prefix)) {
        // eslint-disable-next-line security/detect-object-injection
        return STORAGE_BACKEND_CONFIG[configKey];
      }
    }
  }

  // Default to secure storage

  return STORAGE_BACKEND_CONFIG["*"] || "secure";
}

/**
 * Documentation: Storage Strategy
 *
 * PERSISTENT & ENCRYPTED (localStorage backend):
 * ✅ has_account, last_logged_in, attempts - Authentication state
 * ✅ user_data, user_data_meta, user_data_timestamp - User identity and profile
 * ✅ theme, theme_mode, scale - User preferences
 * ✅ connected_worlds - App state for world selection
 * ✅ dev_mode - Developer settings
 *
 * These keys use localStorage backend because:
 * - Critical to app startup and authentication
 * - Sensitive data (encrypted before storage)
 * - User preferences that should survive restarts
 * - ✅ ALL encrypted via EncryptedStorage (AES-256-CTR + HMAC-SHA256)
 * - Only stored on persistent storage (localStorage/AsyncStorage)
 *
 * EPHEMERAL & UNENCRYPTED (sessionStorage backend):
 * ✅ query_cache_* - API response cache (refetchable on demand)
 * ✅ world_access_* - World metadata (loadable from Supabase)
 * ✅ ldcsv - Session sync tracking (per-session only)
 * ✅ last_selected_world, last_user_role - Session UI state
 *
 * These keys use sessionStorage backend because:
 * - Refetchable from server if missing (no data loss risk)
 * - Optimization-only (don't block app startup)
 * - Cleared automatically on session end (browser tab close)
 * - ❌ NOT encrypted (performance optimization)
 * - Only stored in ephemeral sessionStorage (cleared with tab/session)
 *
 * IMPLEMENTATION:
 * - SecureStorage routes each key to the correct backend based on STORAGE_BACKEND_CONFIG
 * - localStorage/secure backends: Encrypted via EncryptedStorage (always encrypted)
 * - sessionStorage backend: Unencrypted FastCache or direct sessionStorage (performance)
 * - EncryptedStorage always uses localStorage on web/desktop, expo-secure-store on mobile
 * - Mobile (iOS/Android): expo-secure-store for encrypted keys, AsyncStorage for others
 */
