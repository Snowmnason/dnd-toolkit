import { Platform } from "react-native";
import { getAppConfig } from "../config";

// Lazy import logger to avoid circular dependency with config
let loggerCache: any = null;
const getLogger = () => {
  if (!loggerCache) {
    loggerCache = require("../utils/logger").logger;
  }
  return loggerCache;
};

// Type-safe import for AsyncStorage
let AsyncStorage: any;
if (Platform.OS !== "web") {
  AsyncStorage = require("@react-native-async-storage/async-storage").default;
}

// Storage API interface for type safety
interface StorageAPI {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
  length: number;
  key(index: number): string | null;
}

// Get sessionStorage for web (ephemeral cache, cleared on session end)
const getSessionStorage = (): StorageAPI => {
  if (typeof sessionStorage !== "undefined") {
    return sessionStorage;
  }

  // Return no-op implementation for Node.js environments
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    length: 0,
    key: () => null,
  };
};

/**
 * FastCache
 *
 * High-performance unencrypted storage for query cache and non-sensitive data.
 * Uses platform-native storage without encryption overhead.
 *
 * Platform support:
 * - Web: sessionStorage (synchronous, ~2-5ms access, ephemeral)
 * - Native: AsyncStorage (asynchronous, ~5-10ms access)
 *
 * Performance: 5-10x faster than SecureStorage due to no encryption
 *
 * Use for:
 * - Query results and API cache (refetchable on demand)
 * - Non-sensitive user preferences
 * - Temporary session data
 *
 * Don't use for:
 * - Auth tokens, passwords, encryption keys
 * - Sensitive user data or permissions
 * - Any data that requires persistence or security
 *
 * Features:
 * - Per-item TTL (time-to-live) support
 * - Storage quota monitoring
 * - Prefix-based operations
 * - Batch operations for efficiency
 * - Automatic expiration cleanup
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl?: number; // Time-to-live in milliseconds (optional)
  size: number; // For quota tracking
}

interface StorageStats {
  itemCount: number;
  estimatedSize: number; // in bytes
  quotaPercentage: number;
}

class FastCacheService {
  private readonly QUOTA_LIMIT = 5 * 1024 * 1024; // 5MB quota
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();

  constructor() {
    // Start cleanup timer for expired entries (every 5 minutes)
    this.startCleanupTimer();
  }

  // ==========================================
  // Core Operations
  // ==========================================

  /**
   * Store a value in fast cache
   */
  async setItem(key: string, value: string, ttl?: number): Promise<void> {
    try {
      const entry: CacheEntry<string> = {
        data: value,
        timestamp: Date.now(),
        ttl,
        size: value.length,
      };

      const entryJson = JSON.stringify(entry);

      if (Platform.OS === "web") {
        getSessionStorage().setItem(key, entryJson);
      } else {
        await AsyncStorage.setItem(key, entryJson);
      }

      this.notifySubscribers(key, value);
      getLogger().debug(
        "cache",
        `FastCache.setItem: ${key} (${value.length} bytes${ttl ? `, TTL: ${ttl}ms` : ""})`,
      );
    } catch (error) {
      getLogger().error("cache", `FastCache.setItem failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve a value from fast cache, checking TTL
   * Returns null if key doesn't exist, is expired, or on error
   */
  async getItem(key: string): Promise<string | null> {
    try {
      let rawValue: string | null;

      if (Platform.OS === "web") {
        rawValue = getSessionStorage().getItem(key);
      } else {
        rawValue = await AsyncStorage.getItem(key);
      }

      if (!rawValue) return null;

      // Parse and check TTL
      const entry: CacheEntry<string> = JSON.parse(rawValue);

      if (entry.ttl) {
        const age = Date.now() - entry.timestamp;
        if (age > entry.ttl) {
          // Expired - remove and return null
          await this.removeItem(key);
          return null;
        }
      }

      return entry.data;
    } catch (error) {
      getLogger().error("cache", `FastCache.getItem failed for ${key}:`, error);
      return null;
    }
  }

  /**
   * Store JSON data in fast cache with optional TTL
   */
  async setJSON<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const json = JSON.stringify(value);
      await this.setItem(key, json, ttl);
      getLogger().debug(
        "cache",
        `FastCache.setJSON: ${key}${ttl ? ` (TTL: ${ttl}ms)` : ""}`,
      );
    } catch (error) {
      getLogger().error("cache", `FastCache.setJSON failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve JSON data from fast cache, checking TTL
   * Returns null if key doesn't exist, is expired, or JSON is invalid
   */
  async getJSON<T>(key: string): Promise<T | null> {
    try {
      const value = await this.getItem(key);
      if (!value) return null;

      return JSON.parse(value) as T;
    } catch (error) {
      getLogger().error("cache", `FastCache.getJSON failed for ${key}:`, error);
      return null;
    }
  }

  /**
   * Remove an item from fast cache
   */
  async removeItem(key: string): Promise<void> {
    try {
      if (Platform.OS === "web") {
        getSessionStorage().removeItem(key);
      } else {
        await AsyncStorage.removeItem(key);
      }
      getLogger().debug("cache", `FastCache.removeItem: ${key}`);
    } catch (error) {
      getLogger().error("cache", `FastCache.removeItem failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * Check if a key exists in fast cache (doesn't check TTL)
   */
  async hasItem(key: string): Promise<boolean> {
    try {
      const value = await this.getItem(key);
      return value !== null;
    } catch {
      return false;
    }
  }

  // ==========================================
  // Batch Operations
  // ==========================================

  /**
   * Remove all items matching a prefix
   * Example: removeByPrefix('cache:world:') removes all 'cache:world:*' items
   */
  async removeByPrefix(prefix: string): Promise<number> {
    try {
      let matchingKeys: string[] = [];

      if (Platform.OS === "web") {
        const storage = getSessionStorage();
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key && key.startsWith(prefix)) {
            matchingKeys.push(key);
          }
        }
        matchingKeys.forEach((key) => storage.removeItem(key));
      } else {
        const allKeys = await AsyncStorage.getAllKeys();
        matchingKeys = allKeys.filter((key: string) => key.startsWith(prefix));
        await AsyncStorage.multiRemove(matchingKeys);
      }

      getLogger().debug(
        "cache",
        `FastCache.removeByPrefix: ${prefix} (removed ${matchingKeys.length} items)`,
      );
      return matchingKeys.length;
    } catch (error) {
      getLogger().error(
        "cache",
        `FastCache.removeByPrefix failed for ${prefix}:`,
        error,
      );
      return 0;
    }
  }

  /**
   * Set multiple items atomically
   */
  async multiSet(
    items: [key: string, value: string, ttl?: number][],
  ): Promise<void> {
    try {
      if (Platform.OS === "web") {
        for (const [key, value, ttl] of items) {
          await this.setItem(key, value, ttl);
        }
      } else {
        const entries = items.map(([key, value, ttl]) => {
          const entry: CacheEntry<string> = {
            data: value,
            timestamp: Date.now(),
            ttl,
            size: value.length,
          };
          return [key, JSON.stringify(entry)];
        });
        await AsyncStorage.multiSet(entries);

        // Notify subscribers for each key (matching web platform behavior)
        for (const [key, value] of items) {
          this.notifySubscribers(key, value);
        }
      }

      getLogger().debug("cache", `FastCache.multiSet: ${items.length} items`);
    } catch (error) {
      getLogger().error("cache", "FastCache.multiSet failed:", error);
      throw error;
    }
  }

  /**
   * Get multiple items atomically
   */
  async multiGet(keys: string[]): Promise<Map<string, string | null>> {
    try {
      const result = new Map<string, string | null>();

      if (Platform.OS === "web") {
        for (const key of keys) {
          const value = await this.getItem(key);
          result.set(key, value);
        }
      } else {
        const values = await AsyncStorage.multiGet(keys);
        for (const [key, rawValue] of values) {
          if (!rawValue) {
            result.set(key, null);
          } else {
            try {
              const entry: CacheEntry<string> = JSON.parse(rawValue);

              // Check TTL
              if (entry.ttl) {
                const age = Date.now() - entry.timestamp;
                if (age > entry.ttl) {
                  await this.removeItem(key);
                  result.set(key, null);
                  continue;
                }
              }

              result.set(key, entry.data);
            } catch {
              result.set(key, null);
            }
          }
        }
      }

      return result;
    } catch (error) {
      getLogger().error("cache", "FastCache.multiGet failed:", error);
      return new Map();
    }
  }

  // ==========================================
  // Subscription System
  // ==========================================

  /**
   * Subscribe to changes for a specific key
   */
  subscribe(key: string, callback: (data: any) => void): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);

    return () => {
      const subs = this.subscribers.get(key);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(key);
        }
      }
    };
  }

  private notifySubscribers(key: string, data: any): void {
    const subs = this.subscribers.get(key);
    if (subs) {
      subs.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          getLogger().error("cache", "Subscriber notification failed:", error);
        }
      });
    }
  }

  // ==========================================
  // Monitoring & Cleanup
  // ==========================================

  /**
   * Get storage statistics
   */
  async getStats(): Promise<StorageStats> {
    try {
      let itemCount = 0;
      let estimatedSize = 0;

      if (Platform.OS === "web") {
        const storage = getSessionStorage();
        itemCount = storage.length;
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key) {
            const value = storage.getItem(key);
            if (value) {
              estimatedSize += key.length + value.length;
            }
          }
        }
      } else {
        const keys = await AsyncStorage.getAllKeys();
        itemCount = keys.length;
        const values = await AsyncStorage.multiGet(keys);
        for (const [key, value] of values) {
          if (value) {
            estimatedSize += key.length + value.length;
          }
        }
      }

      const quotaPercentage = (estimatedSize / this.QUOTA_LIMIT) * 100;

      return {
        itemCount,
        estimatedSize,
        quotaPercentage,
      };
    } catch (error) {
      getLogger().error("cache", "FastCache.getStats failed:", error);
      return { itemCount: 0, estimatedSize: 0, quotaPercentage: 0 };
    }
  }

  /**
   * Clear all items from fast cache
   * WARNING: This clears ALL sessionStorage/AsyncStorage
   * Prefer removeByPrefix() for selective cleanup
   */
  async clear(): Promise<void> {
    try {
      if (Platform.OS === "web") {
        getSessionStorage().clear();
      } else {
        await AsyncStorage.clear();
      }
      getLogger().info("cache", "FastCache cleared");
    } catch (error) {
      getLogger().error("cache", "FastCache.clear failed:", error);
      throw error;
    }
  }

  /**
   * Remove all expired entries (TTL-based cleanup)
   */
  private async cleanupExpired(): Promise<void> {
    try {
      let keysToRemove: string[] = [];

      if (Platform.OS === "web") {
        const storage = getSessionStorage();
        const now = Date.now();
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key) {
            const value = storage.getItem(key);
            if (value) {
              try {
                const entry: CacheEntry<any> = JSON.parse(value);
                if (entry.ttl) {
                  const age = now - entry.timestamp;
                  if (age > entry.ttl) {
                    keysToRemove.push(key);
                  }
                }
              } catch {
                // Skip invalid entries
              }
            }
          }
        }
        keysToRemove.forEach((key) => storage.removeItem(key));
      } else {
        const keys = await AsyncStorage.getAllKeys();
        const now = Date.now();

        for (const key of keys) {
          const value = await AsyncStorage.getItem(key);
          if (value) {
            try {
              const entry: CacheEntry<any> = JSON.parse(value);
              if (entry.ttl) {
                const age = now - entry.timestamp;
                if (age > entry.ttl) {
                  keysToRemove.push(key);
                }
              }
            } catch {
              // Skip invalid entries
            }
          }
        }

        if (keysToRemove.length > 0) {
          await AsyncStorage.multiRemove(keysToRemove);
        }
      }

      if (keysToRemove.length > 0) {
        getLogger().debug(
          "cache",
          `FastCache cleanup: removed ${keysToRemove.length} expired entries`,
        );
      }
    } catch (error) {
      getLogger().error("cache", "FastCache cleanup failed:", error);
    }
  }

  private startCleanupTimer(): void {
    if (this.cleanupTimer) return;

    const cleanupIntervalMs =
      getAppConfig().storage?.cleanupIntervalMs ?? 5 * 60 * 1000;

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, cleanupIntervalMs);

    if (typeof this.cleanupTimer === "object" && "unref" in this.cleanupTimer) {
      (this.cleanupTimer as any).unref();
    }
  }
}

// Export singleton instance
export const FastCache = new FastCacheService();
export default FastCache;
