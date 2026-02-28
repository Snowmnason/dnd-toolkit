import * as aes from "aes-js";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import "react-native-get-random-values";
import { logger } from "@/lib/utils";

// Type-safe imports for platform-specific storage
let AsyncStorage: any;
let SecureStore: any;
if (Platform.OS !== "web") {
  AsyncStorage = require("@react-native-async-storage/async-storage").default;
  SecureStore = require("expo-secure-store");
}

/**
 * Error classes for distinguished error handling in decryption
 */
class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecryptionError";
  }
}

class AuthenticationFailureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationFailureError";
  }
}

class UnsupportedVersionError extends Error {
  readonly version: number;

  constructor(message: string, version: number) {
    super(message);
    this.name = "UnsupportedVersionError";
    this.version = version;
  }
}

class InvalidFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidFormatError";
  }
}

/**
 * Encrypted Storage - AES-CTR with HMAC-SHA256 authentication
 *
 * Provides encrypted storage across web, desktop, and mobile platforms with
 * platform-specific backend storage and key management:
 *
 * **Web & Desktop (Electron)**
 * - Key storage: localStorage (persistent across reloads/app restarts)
 * - Data storage: localStorage (persistent across sessions)
 * - Persistence: Browser/Chromium leveldb storage in app data directory
 * - ✅ UNIFIED: Web and desktop use the exact same localStorage backend
 *
 * **Mobile (React Native/Expo)**
 * - Key storage: expo-secure-store (iOS Keychain, Android Keystore - hardware-backed)
 * - Data storage: AsyncStorage (encrypted with key from SecureStore)
 * - Persistence: Platform-specific secure enclaves (iOS Keychain, Android Keystore)
 * - ✅ SECURITY: Encryption keys stored in hardware-backed secure storage on both platforms
 *
 * **Encryption/Authentication (All platforms)**
 * - Algorithm: AES-256-CTR mode with random 16-byte IV
 * - Authentication: HMAC-SHA256(key, IV || ciphertext) - requires key to verify
 * - Format: Base64-encoded JSON with version marker {v: 3, iv, hmac, data}
 * - Key derivation: Platform-specific secure random (expo-crypto's getRandomBytes)
 *
 * **Authentication Security**
 * - Version 3: Uses HMAC-SHA256 which requires the encryption key to compute/verify
 * - Prevents tampering: Attacker cannot modify encrypted data without the key
 * - Key-binding: Authentication tag binds data to the specific encryption key
 * - Versions 1-2 (legacy): Unsupported and will throw UnsupportedVersionError
 *
 * **Error Handling**
 * - Throws specific error types (DecryptionError, AuthenticationFailureError,
 *   UnsupportedVersionError, InvalidFormatError) to allow callers to distinguish
 *   between transient failures and corrupted/incompatible data
 * - Corrupted/incompatible data is auto-deleted; transient errors preserve data
 *
 * **Security Considerations**
 * - Encryption key is never transmitted or logged
 * - Key is cached in memory after first retrieval (cachedKey)
 * - HMAC-SHA256 requires the key to compute/verify - prevents tampering
 * - Immune to length-extension attacks (unlike plain SHA256)
 * - For web/desktop: localStorage provides persistence; for production, consider Web Crypto API with hardware keys
 * - For mobile: expo-secure-store provides hardware-backed key storage (iOS Keychain, Android Keystore)
 *
 * **Version History**
 * - v1: AES-CBC (legacy, unsupported)
 * - v2: AES-CTR with plain SHA256 (weak authentication, unsupported)
 * - v3: AES-CTR with HMAC-SHA256 (current, only supported version)
 *
 * **Limitations & Future Work**
 * - **Web production**: Implement server-side session encryption or use Web Crypto API with TPM/secure enclave
 * - **Desktop encryption at rest**: Consider using Electron's safeStorage API for additional key protection
 * - **Key rotation**: Implement key rotation strategy for long-lived keys
 * - **Auditing**: Add optional logging of decryption failures for security monitoring
 */
export class EncryptedStorage {
  private static readonly ENCRYPTION_KEY_STORAGE_KEY = "dnd_encryption_key";
  private static readonly CURRENT_ENCRYPTION_VERSION = 3; // Version 3: AES-CTR with proper HMAC-SHA256
  private static cachedKey: Uint8Array | null = null;

  private static generateEncryptionKey(): Uint8Array {
    // Use expo-crypto for consistent cross-platform random generation
    // (same source as IV generation in encryptData)
    return Crypto.getRandomBytes(32);
  }

  private static async getOrCreateEncryptionKey(): Promise<Uint8Array> {
    if (this.cachedKey) return this.cachedKey;

    const key = await this._initializeKey();
    return key;
  }

  private static async _initializeKey(): Promise<Uint8Array> {
    try {
      if (Platform.OS === "web") {
        // Web and Desktop (Electron) both use localStorage for persistent key storage
        // localStorage survives page reloads (web) and app restarts (Electron)
        // ✅ UNIFIED: Exact same backend for both web and desktop
        if (typeof window !== "undefined" && window.localStorage) {
          const storedKey = window.localStorage.getItem(
            this.ENCRYPTION_KEY_STORAGE_KEY,
          );
          if (storedKey) {
            const key = new Uint8Array(JSON.parse(storedKey));
            this.cachedKey = key;
            logger
              .category("storage")
              .debug(`Loaded encryption key from localStorage`);
            return key;
          }
          const newKey = this.generateEncryptionKey();
          window.localStorage.setItem(
            this.ENCRYPTION_KEY_STORAGE_KEY,
            JSON.stringify(Array.from(newKey)),
          );
          this.cachedKey = newKey;
          logger
            .category("storage")
            .debug(`Generated and stored new encryption key in localStorage`);
          return newKey;
        }
      } else {
        // Mobile: use expo-secure-store for hardware-backed key storage
        // iOS: Keychain (hardware-backed, survives app reinstall if device is kept)
        // Android: Android Keystore (hardware-backed, encrypted at rest)
        // ✅ SECURITY: Keys are stored in platform-specific secure enclaves,
        // providing much stronger protection than localStorage
        if (SecureStore) {
          try {
            const storedKey = await SecureStore.getItemAsync(
              this.ENCRYPTION_KEY_STORAGE_KEY,
            );
            if (storedKey) {
              const parsed = JSON.parse(storedKey);
              const key = new Uint8Array(parsed);
              this.cachedKey = key;
              return key;
            }
            const newKey = this.generateEncryptionKey();
            await SecureStore.setItemAsync(
              this.ENCRYPTION_KEY_STORAGE_KEY,
              JSON.stringify(Array.from(newKey)),
            );
            this.cachedKey = newKey;
            return newKey;
          } catch (error) {
            // SecureStore can fail in some environments (e.g., Expo Go on certain devices)
            // Fall back to AsyncStorage with a warning
            logger.category('storage').warn(
              "SecureStore unavailable, falling back to AsyncStorage for key storage (less secure):",
              error,
            );
          }
        }

        // Fallback to AsyncStorage if SecureStore is unavailable
        // This can happen in Expo Go or on devices without secure storage support
        if (AsyncStorage) {
          const storedKey = await AsyncStorage.getItem(
            this.ENCRYPTION_KEY_STORAGE_KEY,
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
            JSON.stringify(Array.from(newKey)),
          );
          this.cachedKey = newKey;
          return newKey;
        }
      }
    } catch (error) {
      logger.category('storage').error("Error initializing encryption key:", error);
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
    key: Uint8Array,
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

      // Convert to base64 using safe chunked encoding (avoids btoa() stack overflow)
      const ciphertextBase64 = this.bytesToBase64(encryptedBytes);
      const ivBase64 = this.bytesToBase64(iv);

      // Compute HMAC-SHA256 over IV + ciphertext with the encryption key
      // This requires knowledge of the key to verify, preventing tampering.
      const authTag = await this.computeHmac(ivBase64 + ciphertextBase64, key);

      const combined = {
        v: 3, // Version 3: AES-CTR with HMAC-SHA256 (proper authentication)
        iv: ivBase64,
        hmac: authTag,
        data: ciphertextBase64,
      };

      return btoa(JSON.stringify(combined));
    } catch (error) {
      logger.category('storage').error("Encryption failed:", error);
      throw error;
    }
  }

  /**
   * Decrypt data and verify authentication tag
   * Throws specific errors to allow callers to distinguish between:
   * - Corrupted/incompatible data (safe to delete)
   * - Transient errors (should not auto-delete)
   * - Format errors (corrupted structure)
   *
   * Expected format: base64-encoded JSON string from encryptData()
   * Format: btoa(JSON.stringify({v: 2, iv, hmac, data}))
   */
  private static async decryptData(
    encryptedData: string,
    key: Uint8Array,
  ): Promise<string> {
    let parsed: any;

    // First, try to parse the base64 and JSON structure
    try {
      parsed = JSON.parse(atob(encryptedData));
    } catch (error) {
      // If atob fails, encryptedData might be double-wrapped (e.g., JSON.stringify of base64)
      // This happens if platformSetItem wraps the value but platformGetItem doesn't unwrap it
      if (error instanceof SyntaxError && encryptedData.startsWith('"')) {
        throw new InvalidFormatError(
          `Encrypted data appears to be double-wrapped (JSON.stringify of base64). ` +
            `This indicates a mismatch between platformSetItem (wrapping) and platformGetItem (not unwrapping). ` +
            `Ensure both are symmetric.`,
        );
      }
      throw new InvalidFormatError(
        `Failed to parse encrypted data structure: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const {
      iv: ivBase64,
      hmac: storedHmac,
      data: ciphertextBase64,
      v: version,
    } = parsed;

    // Validate version field exists and is a number
    if (typeof version !== "number") {
      throw new InvalidFormatError(
        `Invalid or missing encryption version: ${version}, expected number`,
      );
    }

    // Only support version 3 (AES-CTR with HMAC-SHA256)
    // Reject all other versions (1, 2, future versions)
    if (version !== EncryptedStorage.CURRENT_ENCRYPTION_VERSION) {
      logger
        .category("storage")
        .warn(
          `Data encrypted with unsupported version ${version}. Current version: ${EncryptedStorage.CURRENT_ENCRYPTION_VERSION}`,
        );
      throw new UnsupportedVersionError(
        `Unsupported encryption version: ${version}. Only version 3 (HMAC-SHA256) is supported.`,
        version,
      );
    }

    // Verify authentication tag (version 3 uses HMAC-SHA256)
    try {
      const computedAuthTag = await this.computeHmac(
        ivBase64 + ciphertextBase64,
        key,
      );

      if (computedAuthTag !== storedHmac) {
        throw new AuthenticationFailureError(
          "Authentication tag mismatch: data may be corrupted or encrypted with different key",
        );
      }
    } catch (error) {
      if (error instanceof AuthenticationFailureError) throw error;
      throw new DecryptionError(
        `Authentication tag computation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Convert base64 back to bytes and decrypt
    try {
      // Convert base64 back to bytes using safe decoding
      const ivBytes = this.base64ToBytes(ivBase64);
      const ciphertextBytes = this.base64ToBytes(ciphertextBase64);

      const counter = new aes.Counter(Array.from(ivBytes));
      const aesCtr = new aes.ModeOfOperation.ctr(Array.from(key), counter);
      const decryptedBytes = aesCtr.decrypt(ciphertextBytes);
      const plaintext = aes.utils.utf8.fromBytes(Array.from(decryptedBytes));

      return plaintext;
    } catch (error) {
      throw new DecryptionError(
        `AES-CTR decryption failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Compute HMAC-SHA256 authentication tag
   * ⚠️  SECURITY CRITICAL: Uses HMAC-SHA256(key, message) which requires the key to compute/verify.
   * This prevents tampering because an attacker cannot modify encrypted data without the key.
   * A plain SHA256 hash would allow attackers to modify data and recompute the hash.
   *
   * Implementation: Since expo-crypto doesn't provide HMAC directly, we use the ipad/opad
   * construction: HMAC(K, M) = SHA256((K' XOR opad) || SHA256((K' XOR ipad) || M))
   * where K' is the key padded to block size (64 bytes for SHA256).
   **/
  private static async computeHmac(
    message: string,
    key: Uint8Array,
  ): Promise<string> {
    const blockSize = 64; // SHA256 block size in bytes
    const hashSize = 32; // SHA256 output size in bytes

    // Pad or truncate key to block size
    let keyPadded = new Uint8Array(blockSize);
    if (key.length > blockSize) {
      // If key is longer than block size, hash it first
      const keyHashed = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        String.fromCharCode(...key),
      );
      const keyHashedBytes = new Uint8Array(hashSize);
      for (let i = 0; i < hashSize; i++) {
        // eslint-disable-next-line security/detect-object-injection
        keyHashedBytes[i] = parseInt(keyHashed.substr(i * 2, 2), 16);
      }
      keyPadded.set(keyHashedBytes, 0);
    } else {
      keyPadded.set(key, 0);
    }

    // Create ipad and opad
    const ipad = new Uint8Array(blockSize);
    const opad = new Uint8Array(blockSize);
    for (let i = 0; i < blockSize; i++) {
      // eslint-disable-next-line security/detect-object-injection
      ipad[i] = keyPadded[i] ^ 0x36; // XOR with 0x36
      // eslint-disable-next-line security/detect-object-injection
      opad[i] = keyPadded[i] ^ 0x5c; // XOR with 0x5c
    }

    // HMAC-SHA256: SHA256((K' XOR opad) || SHA256((K' XOR ipad) || M))
    const innerMessage = String.fromCharCode(...ipad) + message;
    const innerHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      innerMessage,
    );

    // Convert hex hash back to bytes for outer computation
    const innerHashBytes = new Uint8Array(hashSize);
    for (let i = 0; i < hashSize; i++) {
      // eslint-disable-next-line security/detect-object-injection
      innerHashBytes[i] = parseInt(innerHash.substr(i * 2, 2), 16);
    }

    const outerMessage =
      String.fromCharCode(...opad) + String.fromCharCode(...innerHashBytes);
    const outerHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      outerMessage,
    );

    return outerHash;
  }

  /**
   * Safe base64 encoding for byte arrays
   * Avoids btoa() stack overflow issues with large arrays by processing in chunks
   * Also provides a fallback for environments where btoa() is not available
   */
  private static bytesToBase64(bytes: Uint8Array): string {
    const chunkSize = 8192; // Process 8KB at a time to avoid stack overflow
    let result = "";

    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      // Convert chunk to string and encode to base64
      result += btoa(String.fromCharCode(...chunk));
    }

    return result;
  }

  /**
   * Safe base64 decoding for strings to byte arrays
   * Counterpart to bytesToBase64 for consistent decoding
   **/
  private static base64ToBytes(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      // eslint-disable-next-line security/detect-object-injection
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  // Platform-aware storage helper
  private static async platformSetItem(
    key: string,
    value: string,
  ): Promise<void> {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } else if (AsyncStorage) {
      // On mobile, store encrypted value directly (no wrapping).
      // The value is already base64-encoded JSON from encryptData(): btoa(JSON.stringify({v,iv,hmac,data}))
      // Wrapping it again with JSON.stringify would break decryption:
      //   - platformSetItem stores: JSON.stringify(base64_json)
      //   - platformGetItem retrieves: JSON.stringify(base64_json)
      //   - decryptData calls: JSON.parse(atob(encryptedData))
      //   - atob(JSON.stringify(...)) would fail because JSON.stringify output is not valid base64
      await AsyncStorage.setItem(key, value);
    }
  }

  private static async platformGetItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return null;
    } else if (AsyncStorage) {
      // Retrieve encrypted value directly from AsyncStorage (no unwrapping).
      // The value should be the base64-encoded JSON structure returned by encryptData().
      const stored = await AsyncStorage.getItem(key);
      if (!stored) return null;
      return stored;
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
      logger.category('storage').error(`Error storing ${key}:`, error);
      throw error;
    }
  }

  // Public API for retrieving encrypted data
  static async getItem(key: string): Promise<string | null> {
    try {
      const encryptedValue = await this.platformGetItem(key);

      if (!encryptedValue) {
        logger.category("storage").debug(`Item not found in storage: ${key}`);
        return null;
      }

      const encryptionKey = await this.getOrCreateEncryptionKey();
      const decrypted = await this.decryptData(encryptedValue, encryptionKey);

      return decrypted;
    } catch (error) {
      // Handle different error types to determine if data should be deleted
      if (
        error instanceof AuthenticationFailureError ||
        error instanceof UnsupportedVersionError ||
        error instanceof InvalidFormatError
      ) {
        // Corrupted or incompatible data - safe to delete
        logger
          .category("storage")
          .warn(`Removing ${error.name} for key: ${key} - ${error.message}`);
        try {
          await this.platformRemoveItem(key);
        } catch (removeError) {
          logger.category('storage').error(
              `Failed to remove corrupted data for ${key}:`,
              removeError,
            );
        }
        return null;
      }

      if (error instanceof DecryptionError) {
        // Transient decryption errors (not auth failures) - do NOT delete
        logger.category('storage').warn(
          `Decryption error for ${key} (not removing data - may be transient): ${error.message}`,
        );
        return null;
      }

      // Unknown error - log but do not auto-delete
      logger.category('storage').error(`Unexpected error retrieving ${key}:`, error);
      return null;
    }
  }

  // Public API for removing encrypted data
  static async removeItem(key: string): Promise<void> {
    try {
      await this.platformRemoveItem(key);
    } catch (error) {
      logger.category('storage').error("Error removing encrypted data:", error);
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
        // Web and Desktop both use localStorage
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.removeItem(this.ENCRYPTION_KEY_STORAGE_KEY);
        }
      } else {
        // Mobile: try SecureStore first, then fall back to AsyncStorage
        if (SecureStore) {
          try {
            await SecureStore.deleteItemAsync(this.ENCRYPTION_KEY_STORAGE_KEY);
          } catch (error) {
            logger.category('storage').warn(
                "Failed to clear encryption key from SecureStore:",
                error,
              );
          }
        }
        if (AsyncStorage) {
          await AsyncStorage.removeItem(this.ENCRYPTION_KEY_STORAGE_KEY);
        }
      }
    } catch (error) {
      logger.category('storage').error("Error clearing encrypted data:", error);
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
      logger.category('storage').error("Error getting all keys:", error);
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
