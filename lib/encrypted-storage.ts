import * as aesjs from 'aes-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import 'react-native-get-random-values';

// Type-safe import for AsyncStorage
let AsyncStorage: any;
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
}

// Storage adapter that uses SecureStore for encryption keys and AsyncStorage for encrypted data
export class EncryptedStorage {
  private static readonly ENCRYPTION_KEY_STORAGE_KEY = 'encryption_key';

  // Generate a new 256-bit encryption key
  private static generateEncryptionKey(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(32)); // 256 bits
  }

  // Get or create encryption key from SecureStore
  private static async getOrCreateEncryptionKey(): Promise<Uint8Array> {
    try {
      // On web, SecureStore isn't available, so we'll use a fixed key (less secure but functional)
      if (Platform.OS === 'web') {
        // Generate a deterministic key for web (not ideal for production)
        const webKey = new Uint8Array(32);
        webKey.fill(42); // Simple fixed key for development
        return webKey;
      }

      const existingKey = await SecureStore.getItemAsync(this.ENCRYPTION_KEY_STORAGE_KEY);
      
      if (existingKey) {
        // Convert stored string back to Uint8Array
        return new Uint8Array(JSON.parse(existingKey));
      } else {
        // Generate new key and store it
        const newKey = this.generateEncryptionKey();
        await SecureStore.setItemAsync(
          this.ENCRYPTION_KEY_STORAGE_KEY,
          JSON.stringify(Array.from(newKey)),
          {
            requireAuthentication: false,
            keychainService: 'dnd-toolkit-keychain',
            accessGroup: 'dnd-toolkit-access-group',
          }
        );
        return newKey;
      }
    } catch (error) {
      console.error('Error managing encryption key:', error);
      // Fallback to a simple key if SecureStore fails
      const fallbackKey = new Uint8Array(32);
      fallbackKey.fill(123);
      return fallbackKey;
    }
  }

  // Encrypt data using AES-CTR
  private static encryptData(data: string, key: Uint8Array): string {
    const textBytes = aesjs.utils.utf8.toBytes(data);
    const aesCtr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(5));
    const encryptedBytes = aesCtr.encrypt(textBytes);
    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  // Decrypt data using AES-CTR
  private static decryptData(encryptedData: string, key: Uint8Array): string {
    const encryptedBytes = aesjs.utils.hex.toBytes(encryptedData);
    const aesCtr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(5));
    const decryptedBytes = aesCtr.decrypt(encryptedBytes);
    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  // Platform-aware storage helper
  private static async platformSetItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } else if (AsyncStorage) {
      await AsyncStorage.setItem(key, value);
    }
  }

  private static async platformGetItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return null;
    } else if (AsyncStorage) {
      return await AsyncStorage.getItem(key);
    }
    return null;
  }

  private static async platformRemoveItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } else if (AsyncStorage) {
      await AsyncStorage.removeItem(key);
    }
  }

  private static async platformClear(): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
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
      const encryptedValue = this.encryptData(value, encryptionKey);
      await this.platformSetItem(key, encryptedValue);
    } catch (error) {
      console.error('Error storing encrypted data:', error);
      throw error;
    }
  }

  // Public API for retrieving encrypted data
  static async getItem(key: string): Promise<string | null> {
    try {
      const encryptedValue = await this.platformGetItem(key);
      
      if (!encryptedValue) {
        return null;
      }

      const encryptionKey = await this.getOrCreateEncryptionKey();
      return this.decryptData(encryptedValue, encryptionKey);
    } catch (error) {
      console.error('Error retrieving encrypted data:', error);
      return null;
    }
  }

  // Public API for removing encrypted data
  static async removeItem(key: string): Promise<void> {
    try {
      await this.platformRemoveItem(key);
    } catch (error) {
      console.error('Error removing encrypted data:', error);
      throw error;
    }
  }

  // Clear all encrypted data (useful for logout)
  static async clear(): Promise<void> {
    try {
      await this.platformClear();
    } catch (error) {
      console.error('Error clearing encrypted data:', error);
      throw error;
    }
  }
}

// Supabase storage adapter using our encrypted storage
export const EncryptedStorageAdapter = {
  getItem: (key: string) => EncryptedStorage.getItem(key),
  setItem: (key: string, value: string) => EncryptedStorage.setItem(key, value),
  removeItem: (key: string) => EncryptedStorage.removeItem(key),
};