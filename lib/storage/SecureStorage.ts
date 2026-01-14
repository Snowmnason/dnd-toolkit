import { logger } from '../utils/logger';
import { CacheSchema, handleCacheMigration, validateCacheEntry, VersionedCacheEntry } from './cache-versioning';

/**
 * SecureStorage
 * 
 * Cross-platform encrypted storage for ALL app data.
 * Uses existing EncryptedStorage implementation under the hood.
 * 
 * Platform support:
 * - Web: localStorage with AES-CTR encryption
 * - Native (iOS/Android): expo-secure-store + AsyncStorage with encryption
 * - Desktop: TBD (likely Electron secure storage)
 * 
 * All methods are async for consistency across platforms.
 */
class SecureStorageService {
  private encryptedStorage: any = null;
  private initialized = false;

  /**
   * Lazy-load EncryptedStorage to avoid circular dependencies
   * and ensure platform-specific imports work correctly
   */
  private async getStorage() {
    if (this.encryptedStorage) {
      return this.encryptedStorage;
    }

    try {
      const module = await import('../auth/encrypted-storage');
      this.encryptedStorage = module.EncryptedStorage;
      this.initialized = true;
      return this.encryptedStorage;
    } catch (error) {
      logger.error('storage', 'Failed to load EncryptedStorage', error);
      throw new Error('SecureStorage initialization failed');
    }
  }

  /**
   * Store a value securely (encrypted on all platforms)
   */
  async setItem(key: string, value: string): Promise<void> {
    try {
      const storage = await this.getStorage();
      await storage.setItem(key, value);
      logger.category('storage').debug('Item stored', { key, length: value.length });
    } catch (error) {
      logger.category('storage').error('setItem failed', { key, error });
      throw error;
    }
  }

  /**
   * Retrieve a value from secure storage
   * Returns null if key doesn't exist or on error
   */
  async getItem(key: string): Promise<string | null> {
    try {
      const storage = await this.getStorage();
      const value = await storage.getItem(key);
      logger.category('storage').debug('Item retrieved', { 
        key, 
        found: !!value,
        length: value?.length || 0 
      });
      return value;
    } catch (error) {
      logger.category('storage').warn('getItem failed', { key, error });
      return null;
    }
  }

  /**
   * Remove a value from secure storage
   */
  async removeItem(key: string): Promise<void> {
    try {
      const storage = await this.getStorage();
      await storage.removeItem(key);
      logger.category('storage').debug('Item removed', { key });
    } catch (error) {
      logger.error(`SecureStorage.removeItem failed for key: ${key}`, error);
      throw error;
    }
  }

  /**
   * Clear all storage (use with caution!)
   */
  async clear(): Promise<void> {
    try {
      const storage = await this.getStorage();
      await storage.clear();
      logger.category('storage').warn('All storage cleared');
    } catch (error) {
      logger.error('SecureStorage.clear failed', error);
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
      logger.error(`SecureStorage.setJSON failed for key: ${key}`, error);
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
      logger.warn(`SecureStorage.getJSON failed for key: ${key} (invalid JSON?)`, error);
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
      const storage = await this.getStorage();
      const keys = await storage.getAllKeys();
      logger.debug(`SecureStorage.getAllKeys: Found ${keys.length} keys`);
      return keys;
    } catch (error) {
      logger.warn('SecureStorage.getAllKeys failed', error);
      return [];
    }
  }

  /**
   * Get and validate a versioned JSON entry with schema
   * Handles cache validation and migration automatically
   */
  async getValidatedJSON<T = any>(
    key: string,
    schema: CacheSchema<T>
  ): Promise<T | null> {
    try {
      const rawEntry = await this.getJSON<VersionedCacheEntry>(key);
      
      if (!rawEntry) {
        logger.debug(`SecureStorage.getValidatedJSON: ${key} not found`);
        return null;
      }

      // Validate against schema
      const validation = validateCacheEntry(rawEntry, schema);
      
      if (validation.valid) {
        logger.debug(`SecureStorage.getValidatedJSON: ${key} validated successfully`);
        return rawEntry.data as T;
      }

      // Handle validation failure
      logger.warn(`SecureStorage.getValidatedJSON: ${key} failed validation`, {
        reason: validation.reason,
        oldVersion: validation.oldVersion,
        currentVersion: validation.currentVersion,
      });

      // Attempt migration
      const migrated = await handleCacheMigration(rawEntry, validation, schema);
      
      if (migrated !== null) {
        // Update storage with migrated data
        await this.setVersionedJSON(key, migrated, schema.version);
        logger.info(`SecureStorage.getValidatedJSON: ${key} migrated and updated`);
        return migrated;
      }

      // Migration failed or not available - clear the entry
      await this.removeItem(key);
      logger.info(`SecureStorage.getValidatedJSON: ${key} cleared due to migration failure`);
      return null;
    } catch (error) {
      logger.error(`SecureStorage.getValidatedJSON failed for key: ${key}`, error);
      return null;
    }
  }

  /**
   * Store a versioned JSON entry with schema version
   */
  async setVersionedJSON<T = any>(
    key: string,
    value: T,
    version: number
  ): Promise<void> {
    try {
      const versionedEntry: VersionedCacheEntry<T> = {
        version,
        data: value,
        timestamp: Date.now(),
      };
      const jsonString = JSON.stringify(versionedEntry);
      await this.setItem(key, jsonString);
      logger.debug(`SecureStorage.setVersionedJSON: ${key} (v${version})`);
    } catch (error) {
      logger.error(`SecureStorage.setVersionedJSON failed for key: ${key}`, error);
      throw error;
    }
  }
}


// Export singleton instance
export const SecureStorage = new SecureStorageService();
