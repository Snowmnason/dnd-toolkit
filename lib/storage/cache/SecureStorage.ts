import { Platform } from "react-native";
import {
  CacheSchema,
  handleCacheMigration,
  validateCacheEntry,
  VersionedCacheEntry,
} from "../cache-versioning";
import { getStorageBackend, type StorageBackend } from "../storage-config";

// Lazy-load logger to avoid circular dependency with storage
let loggerCache: any = null;
const getLogger = () => {
  if (!loggerCache) {
    loggerCache = require("../../utils/logger").logger;
  }
  return loggerCache;
};

// Type-safe import for AsyncStorage
let AsyncStorage: any;
if (typeof window === "undefined" || Platform.OS !== "web") {
  try {
    AsyncStorage = require("@react-native-async-storage/async-storage").default;
  } catch {
    // AsyncStorage not available in non-RN environments
  }
}

/**
 * Get localStorage safely
 */
// `getLocalStorage` removed — not used in codebase; session/local access goes through
// `getSessionStorage` or the encrypted backend loader above.

/**
 * Get sessionStorage safely
 */
const getSessionStorage = (): Storage | null => {
  if (typeof window !== "undefined" && window.sessionStorage) {
    return window.sessionStorage;
  }
  return null;
};

/**
 * SecureStorage with Backend Routing
 *
 * Cross-platform storage that respects STORAGE_BACKEND_CONFIG:
 * - localStorage: Persistent, ENCRYPTED sensitive data (user_data, connected_worlds, auth)
 *   → Routes to EncryptedStorage (which uses localStorage as physical backend)
 * - sessionStorage: Ephemeral, UNENCRYPTED cache (query_cache, metadata)
 *   → Routes to FastCache (faster, cleared on session end)
 * - secure: Persistent, ENCRYPTED (default for sensitive data)
 *   → Routes to EncryptedStorage (encrypted)
 *
 * Platform support:
 * - Web: localStorage/sessionStorage with selective encryption
 * - Native (iOS/Android): expo-secure-store + AsyncStorage with encryption
 * - Desktop: Same as web (Electron)
 *
 * All methods are async for consistency across platforms.
 *
 * ROUTING LOGIC:
 * 1. Check STORAGE_BACKEND_CONFIG for the key
 * 2. If 'localStorage' or 'secure': Route to EncryptedStorage (encrypted, persistent)
 * 3. If 'sessionStorage': Route to FastCache (unencrypted, ephemeral)
 * 4. EncryptedStorage internally uses localStorage/AsyncStorage as the physical backend
 */
class SecureStorageService {
  private encryptedStorage: any = null;
  private initialized = false;

  /**
   * Lazy-load EncryptedStorage to avoid circular dependencies
   * and ensure platform-specific imports work correctly
   */
  private async getEncryptedStorage() {
    if (this.encryptedStorage) {
      return this.encryptedStorage;
    }

    try {
      const module = await import("../../auth/encrypted-storage");
      this.encryptedStorage = module.EncryptedStorage;
      this.initialized = true;
      return this.encryptedStorage;
    } catch (error) {
      getLogger().error("storage", "Failed to load EncryptedStorage", error);
      throw new Error("SecureStorage initialization failed");
    }
  }

  /**
   * Get the appropriate storage backend for a key
   */
  private getBackendForKey(key: string): StorageBackend {
    return getStorageBackend(key);
  }

  /**
   * Store a value using the configured backend
   */
  async setItem(key: string, value: string): Promise<void> {
    const backend = this.getBackendForKey(key);

    try {
      if (backend === "localStorage") {
        // localStorage keys are ENCRYPTED via EncryptedStorage
        // This keeps sensitive data (user_data, connected_worlds, auth) encrypted in localStorage
        const storage = await this.getEncryptedStorage();
        await storage.setItem(key, value);
        getLogger()
          .category("storage")
          .debug(
            `[EncryptedStorage→localStorage] Item stored: ${key} (${value.length} chars)`,
          );
      } else if (backend === "sessionStorage") {
        // sessionStorage keys are UNENCRYPTED for performance
        // Used for query cache and metadata (refetchable from server)
        // Cleared on session end anyway, so encryption not critical
        if (Platform.OS === "web") {
          const storage = getSessionStorage();
          if (storage) {
            storage.setItem(key, value);
            getLogger()
              .category("storage")
              .debug(
                `[sessionStorage] Item stored: ${key} (${value.length} chars)`,
              );
          }
        } else {
          // Mobile: use AsyncStorage (cleared on app close anyway)
          await AsyncStorage?.setItem(key, value);
          getLogger()
            .category("storage")
            .debug(
              `[AsyncStorage/sessionStorage] Item stored: ${key} (${value.length} chars)`,
            );
        }
      } else {
        // 'secure' backend: use EncryptedStorage (same as localStorage, for clarity)
        const storage = await this.getEncryptedStorage();
        await storage.setItem(key, value);
        getLogger()
          .category("storage")
          .debug(
            `[EncryptedStorage] Item stored: ${key} (${value.length} chars)`,
          );
      }
    } catch (error) {
      getLogger()
        .category("storage")
        .error(`setItem failed [${backend}]`, { key, error });
      throw error;
    }
  }

  /**
   * Retrieve a value using the configured backend
   * Returns null if key doesn't exist or on error
   */
  async getItem(key: string): Promise<string | null> {
    const backend = this.getBackendForKey(key);

    try {
      if (backend === "localStorage") {
        // localStorage keys are ENCRYPTED via EncryptedStorage
        const storage = await this.getEncryptedStorage();
        const value = await storage.getItem(key);
        if (value) {
          getLogger()
            .category("storage")
            .debug(`[EncryptedStorage→localStorage] Item retrieved: ${key}`);
        }
        return value;
      } else if (backend === "sessionStorage") {
        // sessionStorage keys are UNENCRYPTED (for performance)
        if (Platform.OS === "web") {
          const storage = getSessionStorage();
          if (storage) {
            const value = storage.getItem(key);
            if (value) {
              getLogger()
                .category("storage")
                .debug(`[sessionStorage] Item retrieved: ${key}`);
            }
            return value;
          }
        } else {
          // Mobile: use AsyncStorage
          const value = await AsyncStorage?.getItem(key);
          if (value) {
            getLogger()
              .category("storage")
              .debug(`[AsyncStorage/sessionStorage] Item retrieved: ${key}`);
          }
          return value;
        }
      } else {
        // 'secure' backend: use EncryptedStorage
        const storage = await this.getEncryptedStorage();
        const value = await storage.getItem(key);
        if (value) {
          getLogger()
            .category("storage")
            .debug(`[EncryptedStorage] Item retrieved: ${key}`);
        }
        return value;
      }
      return null;
    } catch (error) {
      getLogger()
        .category("storage")
        .warn(`getItem failed [${backend}]`, { key, error });
      return null;
    }
  }

  /**
   * Remove a value using the configured backend
   */
  async removeItem(key: string): Promise<void> {
    const backend = this.getBackendForKey(key);

    try {
      if (backend === "localStorage") {
        // localStorage keys are ENCRYPTED via EncryptedStorage
        const storage = await this.getEncryptedStorage();
        await storage.removeItem(key);
        getLogger()
          .category("storage")
          .debug(`[EncryptedStorage→localStorage] Item removed: ${key}`);
      } else if (backend === "sessionStorage") {
        // sessionStorage keys are UNENCRYPTED
        if (Platform.OS === "web") {
          const storage = getSessionStorage();
          if (storage) {
            storage.removeItem(key);
            getLogger()
              .category("storage")
              .debug(`[sessionStorage] Item removed: ${key}`);
          }
        } else {
          // Mobile: use AsyncStorage
          await AsyncStorage?.removeItem(key);
          getLogger()
            .category("storage")
            .debug(`[AsyncStorage/sessionStorage] Item removed: ${key}`);
        }
      } else {
        // 'secure' backend: use EncryptedStorage
        const storage = await this.getEncryptedStorage();
        await storage.removeItem(key);
        getLogger()
          .category("storage")
          .debug(`[EncryptedStorage] Item removed: ${key}`);
      }
    } catch (error) {
      getLogger().error(
        `SecureStorage.removeItem failed [${backend}] for key: ${key}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Clear all storage (use with caution!)
   * Encrypted backends: delegates to EncryptedStorage
   * Unencrypted backends: clears directly from sessionStorage
   */
  async clear(): Promise<void> {
    try {
      // Clear encrypted storage (includes localStorage-routed keys)
      const storage = await this.getEncryptedStorage();
      await storage.clear();
      getLogger()
        .category("storage")
        .warn("[EncryptedStorage] All encrypted storage cleared");

      // Clear unencrypted sessionStorage
      const sessionStorage = getSessionStorage();
      if (sessionStorage) {
        sessionStorage.clear();
        getLogger()
          .category("storage")
          .warn("[sessionStorage] All ephemeral cache cleared");
      }
    } catch (error) {
      getLogger().error("SecureStorage.clear failed", error);
      throw error;
    }
  }

  /**
   * Store a JSON object (convenience helper)
   */
  async setJSON<T = any>(key: string, value: T): Promise<void> {
    try {
      const jsonString = JSON.stringify(value);
      await this.setItem(key, jsonString);
    } catch (error) {
      getLogger().error(`SecureStorage.setJSON failed for key: ${key}`, error);
      throw error;
    }
  }

  /**
   * Retrieve and parse a JSON object (convenience helper)
   * Returns null if key doesn't exist, can't be parsed, or on error
   */
  async getJSON<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.getItem(key);
      if (!value) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      getLogger().warn(
        `SecureStorage.getJSON failed for key: ${key} (invalid JSON?)`,
        error,
      );
      return null;
    }
  }

  /**
   * Check if a key exists in storage
   */
  async hasItem(key: string): Promise<boolean> {
    const value = await this.getItem(key);
    return value !== null;
  }

  /**
   * Get all keys in storage (for debugging/migration)
   * Delegates to EncryptedStorage for consistent platform handling
   */
  async getAllKeys(): Promise<string[]> {
    try {
      const storage = await this.getEncryptedStorage();
      const keys = await storage.getAllKeys();
      getLogger().debug(`SecureStorage.getAllKeys: Found ${keys.length} keys`);
      return keys;
    } catch (error) {
      getLogger().warn("SecureStorage.getAllKeys failed", error);
      return [];
    }
  }

  /**
   * Get and validate a versioned JSON entry with schema
   * Handles cache validation and migration automatically
   */
  async getValidatedJSON<T = any>(
    key: string,
    schema: CacheSchema<T>,
  ): Promise<T | null> {
    try {
      const rawEntry = await this.getJSON<VersionedCacheEntry>(key);

      if (!rawEntry) {
        getLogger().debug(`SecureStorage.getValidatedJSON: ${key} not found`);
        return null;
      }

      // Validate against schema
      const validation = validateCacheEntry(rawEntry, schema);

      if (validation.valid) {
      getLogger().debug(
        `SecureStorage.getValidatedJSON: ${key} validated successfully`,
      );
        return rawEntry.data as T;
      }

      // Handle validation failure
      getLogger().warn(`SecureStorage.getValidatedJSON: ${key} failed validation`, {
        reason: validation.reason,
        oldVersion: validation.oldVersion,
        currentVersion: validation.currentVersion,
      });

      // Attempt migration
      const migrated = await handleCacheMigration(rawEntry, validation, schema);

      if (migrated !== null) {
        // Update storage with migrated data
        await this.setVersionedJSON(key, migrated, schema.version);
        getLogger().info(
          `SecureStorage.getValidatedJSON: ${key} migrated and updated`,
        );
        return migrated;
      }

      // Migration failed or not available - clear the entry
      await this.removeItem(key);
      getLogger().info(
        `SecureStorage.getValidatedJSON: ${key} cleared due to migration failure`,
      );
      return null;
    } catch (error) {
      getLogger().error(
        `SecureStorage.getValidatedJSON failed for key: ${key}`,
        error,
      );
      return null;
    }
  }

  /**
   * Store a versioned JSON entry with schema version
   */
  async setVersionedJSON<T = any>(
    key: string,
    value: T,
    version: number,
  ): Promise<void> {
    try {
      const versionedEntry: VersionedCacheEntry<T> = {
        version,
        data: value,
        timestamp: Date.now(),
      };
      const jsonString = JSON.stringify(versionedEntry);
      await this.setItem(key, jsonString);
      getLogger().debug(`SecureStorage.setVersionedJSON: ${key} (v${version})`);
    } catch (error) {
      getLogger().error(
        `SecureStorage.setVersionedJSON failed for key: ${key}`,
        error,
      );
      throw error;
    }
  }
}

// Export singleton instance
export const SecureStorage = new SecureStorageService();
