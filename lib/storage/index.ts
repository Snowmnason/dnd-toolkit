/**
 * Storage Module
 * 
 * Centralized storage access for all app data.
 * All data is stored encrypted via EncryptedStorage; SecureStorage is the facade/wrapper you should use.
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

export { SecureStorage } from './SecureStorage';
export { FastCache } from './FastCache';

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
  LAST_LOGGED_IN: 'dnd:auth:last_logged_in', // Timestamp of last successful sign-in (used for welcome screen skip)
  
  // Auth attempt rate limiting
  AUTH_ATTEMPTS: 'dnd:auth:attempts',

  // Invites
  PENDING_INVITE: 'dnd:invite:pending',
  
  // User preferences
  THEME_PREFERENCE: 'dnd:user:theme',
  SCALE_PREFERENCE: 'dnd:user:scale',
  
  // Session state (volatile persistence)
  LAST_SELECTED_WORLD: 'dnd:session:last_selected_world',
  LAST_USER_ROLE: 'dnd:session:last_user_role',
  
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
