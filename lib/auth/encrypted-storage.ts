import * as aes from "aes-js";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import "react-native-get-random-values";
import { logger } from "../utils/logger";

// Type-safe import for AsyncStorage
let AsyncStorage: any;
if (Platform.OS !== "web") {
  AsyncStorage = require("@react-native-async-storage/async-storage").default;
}

/**
 * Encrypted Storage using expo-crypto
 * Works uniformly across web, desktop, and mobile platforms
 */
export class EncryptedStorage {
  private static readonly ENCRYPTION_KEY_STORAGE_KEY = "dnd_encryption_key";
  private static cachedKey: Uint8Array | null = null;

  private static generateEncryptionKey(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(32));
  }

  private static async getOrCreateEncryptionKey(): Promise<Uint8Array> {
    if (this.cachedKey) return this.cachedKey;

    const key = await this._initializeKey();
    return key;
  }

  private static async _initializeKey(): Promise<Uint8Array> {
    try {
      if (Platform.OS === "web") {
        // Web: use localStorage
        if (typeof window !== "undefined" && window.localStorage) {
          const storedKey = window.localStorage.getItem(
            this.ENCRYPTION_KEY_STORAGE_KEY
          );
          if (storedKey) {
            const key = new Uint8Array(JSON.parse(storedKey));
            this.cachedKey = key;
            return key;
          }
          const newKey = this.generateEncryptionKey();
          window.localStorage.setItem(
            this.ENCRYPTION_KEY_STORAGE_KEY,
            JSON.stringify(Array.from(newKey))
          );
          this.cachedKey = newKey;
          return newKey;
        }
      } else {
        // Mobile: use AsyncStorage
        if (AsyncStorage) {
          const storedKey = await AsyncStorage.getItem(
            this.ENCRYPTION_KEY_STORAGE_KEY
          );
          if (storedKey) {
            const parsed = JSON.parse(storedKey);
            const key = new Uint8Array(parsed);
            this.cachedKey = key;
            return key;
          }
          const newKey = this.generateEncryptionKey();
          await AsyncStorage.setItem(
            this.ENCRYPTION_KEY_STORAGE_KEY,
            JSON.stringify(Array.from(newKey))
          );
          this.cachedKey = newKey;
          return newKey;
        }
      }
    } catch (error) {
      logger.error("storage", "Error initializing encryption key:", error);
    }

    // Fallback
    const fallbackKey = new Uint8Array(32);
    fallbackKey.fill(42);
    this.cachedKey = fallbackKey;
    return fallbackKey;
  }

  /**
   * Encrypt data using AES-CTR with HMAC authentication
   */
  private static async encryptData(
    data: string,
    key: Uint8Array
  ): Promise<string> {
    try {
      // Generate random 16-byte IV
      const iv = Crypto.getRandomBytes(16);

      // Convert plaintext to bytes (UTF-8)
      const textBytes = aes.utils.utf8.toBytes(data);

      // Create counter from IV for AES-CTR mode
      const counter = new aes.Counter(Array.from(iv));

      // Perform AES-CTR encryption
      const aesCtr = new aes.ModeOfOperation.ctr(Array.from(key), counter);
      const encryptedBytes = aesCtr.encrypt(textBytes);

      // Convert to base64
      const ciphertextBase64 = btoa(String.fromCharCode(...encryptedBytes));
      const ivBase64 = btoa(String.fromCharCode(...iv));

      // Generate HMAC over IV + ciphertext + key for authentication
      const keyHex = this.bytesToHex(key);
      const hmacInput = ivBase64 + ciphertextBase64 + keyHex;
      const hmac = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        hmacInput
      );

      const combined = {
        v: 2, // Version 2: AES-CTR with HMAC
        iv: ivBase64,
        hmac: hmac,
        data: ciphertextBase64,
      };

      return btoa(JSON.stringify(combined));
    } catch (error) {
      logger.error("storage", "Encryption failed:", error);
      throw error;
    }
  }

  /**
   * Decrypt data and verify HMAC
   */
  private static async decryptData(
    encryptedData: string,
    key: Uint8Array
  ): Promise<string> {
    try {
      const combined = JSON.parse(atob(encryptedData));
      const {
        iv: ivBase64,
        hmac: storedHmac,
        data: ciphertextBase64,
        v: version,
      } = combined;

      // Verify HMAC first (over IV + ciphertext + key)
      const keyHex = this.bytesToHex(key);
      const hmacInput = ivBase64 + ciphertextBase64 + keyHex;
      const computedHmac = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        hmacInput
      );

      if (computedHmac !== storedHmac) {
        logger
          .category("storage")
          .warn(`HMAC verification failed for key: ${key}`);
        return "";
      }

      // Convert base64 back to bytes
      const ivBytes = Uint8Array.from(atob(ivBase64), (c) => c.charCodeAt(0));
      const ciphertextBytes = Uint8Array.from(atob(ciphertextBase64), (c) =>
        c.charCodeAt(0)
      );

      // Create counter from IV for AES-CTR mode
      const counter = new aes.Counter(Array.from(ivBytes));

      // Perform AES-CTR decryption
      const aesCtr = new aes.ModeOfOperation.ctr(Array.from(key), counter);
      const decryptedBytes = aesCtr.decrypt(ciphertextBytes);

      // Convert decrypted bytes back to string (UTF-8)
      const plaintext = aes.utils.utf8.fromBytes(Array.from(decryptedBytes));

      return plaintext;
    } catch (error) {
      logger.error("storage", "Decryption failed:", error);
      // Return empty string on error to handle corrupted data gracefully
      return "";
    }
  }

  /**
   * Convert bytes to hex string
   */
  private static bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // Platform-aware storage helper
  private static async platformSetItem(
    key: string,
    value: string
  ): Promise<void> {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } else if (AsyncStorage) {
      // On mobile, wrap in JSON to prevent string corruption during AsyncStorage I/O
      // (AsyncStorage may not preserve base64 strings exactly without wrapping)
      await AsyncStorage.setItem(key, JSON.stringify(value));
    }
  }

  private static async platformGetItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return null;
    } else if (AsyncStorage) {
      const stored = await AsyncStorage.getItem(key);
      if (!stored) return null;
      try {
        // Unwrap from JSON on mobile
        return JSON.parse(stored);
      } catch (error) {
        logger.error("storage", "Failed to parse stored value:", error);
        return null;
      }
    }
    return null;
  }

  private static async platformRemoveItem(key: string): Promise<void> {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } else if (AsyncStorage) {
      await AsyncStorage.removeItem(key);
    }
  }

  private static async platformClear(): Promise<void> {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.clear();
      }
    } else if (AsyncStorage) {
      await AsyncStorage.clear();
    }
  }

  // Public API for storing encrypted data
  static async setItem(key: string, value: string): Promise<void> {
    try {
      const encryptionKey = await this.getOrCreateEncryptionKey();
      const encryptedValue = await this.encryptData(value, encryptionKey);
      await this.platformSetItem(key, encryptedValue);
      logger.category("storage").debug(`Item stored: ${key}`);
    } catch (error) {
      logger.error("storage", `Error storing ${key}:`, error);
      throw error;
    }
  }

  // Public API for retrieving encrypted data
  static async getItem(key: string): Promise<string | null> {
    try {
      const encryptedValue = await this.platformGetItem(key);

      if (!encryptedValue) {
        logger.category("storage").warn(`Item not found in storage: ${key}`);
        return null;
      }

      const encryptionKey = await this.getOrCreateEncryptionKey();
      const decrypted = await this.decryptData(encryptedValue, encryptionKey);

      // If decryption returned empty string (HMAC failure or error), clear corrupted data
      if (decrypted === "" && encryptedValue !== "") {
        logger
          .category("storage")
          .warn(`Clearing corrupted/incompatible data for key: ${key}`);
        await this.platformRemoveItem(key);
        return null;
      }

      return decrypted;
    } catch (error) {
      logger.error(
        "storage",
        `Error retrieving encrypted data for ${key}:`,
        error
      );
      // Try to clear corrupted data
      try {
        await this.platformRemoveItem(key);
      } catch (removeError) {
        logger.error(
          "storage",
          "Failed to remove corrupted data:",
          removeError
        );
      }
      return null;
    }
  }

  // Public API for removing encrypted data
  static async removeItem(key: string): Promise<void> {
    try {
      await this.platformRemoveItem(key);
    } catch (error) {
      logger.error("storage", "Error removing encrypted data:", error);
      throw error;
    }
  }

  // Clear all encrypted data (useful for logout)
  static async clear(): Promise<void> {
    try {
      await this.platformClear();
      // Clear the cached key
      this.cachedKey = null;
      // Clear the encryption key from storage
      if (Platform.OS === "web") {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.removeItem(this.ENCRYPTION_KEY_STORAGE_KEY);
        }
      } else if (AsyncStorage) {
        await AsyncStorage.removeItem(this.ENCRYPTION_KEY_STORAGE_KEY);
      }
    } catch (error) {
      logger.error("storage", "Error clearing encrypted data:", error);
      throw error;
    }
  }

  // Get all keys from storage (for debugging/migration)
  static async getAllKeys(): Promise<string[]> {
    try {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined" && window.localStorage) {
          const keys: string[] = [];
          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key) keys.push(key);
          }
          return keys;
        }
        return [];
      } else if (AsyncStorage) {
        return await AsyncStorage.getAllKeys();
      }
      return [];
    } catch (error) {
      logger.error("storage", "Error getting all keys:", error);
      return [];
    }
  }
}

// Supabase storage adapter using our encrypted storage
export const EncryptedStorageAdapter = {
  getItem: (key: string) => EncryptedStorage.getItem(key),
  setItem: (key: string, value: string) => EncryptedStorage.setItem(key, value),
  removeItem: (key: string) => EncryptedStorage.removeItem(key),
};
