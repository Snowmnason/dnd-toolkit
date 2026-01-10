/**
 * Storage Module
 * 
 * Centralized storage access for all app data.
 * All data is stored encrypted via SecureStorage.
 * 
 * Usage:
 * ```ts
 * import { SecureStorage, STORAGE_KEYS } from '@/lib/storage';
 * 
 * // Store data
 * await SecureStorage.setItem(STORAGE_KEYS.CONNECTED_WORLDS, worldIds);
 * 
 * // Store JSON
 * await SecureStorage.setJSON(STORAGE_KEYS.USER_PREFERENCES, { theme: 'dark' });
 * 
 * // Retrieve data
 * const worldIds = await SecureStorage.getItem(STORAGE_KEYS.CONNECTED_WORLDS);
 * const prefs = await SecureStorage.getJSON(STORAGE_KEYS.USER_PREFERENCES);
 * ```
 */

export { SecureStorage, default } from './SecureStorage';

/**
 * Storage Keys
 * 
 * Centralized key constants with namespacing.
 * Format: dnd:<domain>:<key>
 * 
 * NEVER use raw string keys - always use these constants.
 */
export const STORAGE_KEYS = {
  // App-level data
  CONNECTED_WORLDS: 'dnd:app:connected_worlds',
  
  // Auth-related data (migrated from auth-state.ts)
  HAS_ACCOUNT: 'dnd:auth:has_account',
  USER_DATA: 'dnd:auth:user_data',
  USER_DATA_TIMESTAMP: 'dnd:auth:user_data_timestamp',
  
  // Auth attempt rate limiting
  AUTH_ATTEMPTS: 'dnd:auth:attempts',
  
  // User preferences
  THEME_PREFERENCE: 'dnd:user:theme',
  SCALE_PREFERENCE: 'dnd:user:scale',
  
  // Feature flags / dev settings
  DEV_MODE: 'dnd:dev:mode',
  
  // Add more keys as needed...
} as const;

/**
 * Legacy keys (for reference - DO NOT USE in new code)
 * These are old localStorage keys that should be migrated
 */
export const LEGACY_KEYS = {
  CONNECTED_WORLDS: 'dnd_connected_worlds',
  HAS_ACCOUNT: 'hasAccount',
  USER_DATA: 'userData',
  USER_DATA_TIMESTAMP: 'userDataTimestamp',
} as const;
