import { EncryptedStorageAdapter } from '@/lib/auth/encrypted-storage';
import { logger } from '@/lib/utils/logger';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

// Web auth session persistence:
// - Default to 'local' for persistent sessions across tabs/browser restarts
// - Allow override via EXPO_PUBLIC_AUTH_STORAGE_MODE ('local' | 'session')
//   Set to 'session' if you want users to be signed out when the tab closes
const rawStorageMode = (process.env.EXPO_PUBLIC_AUTH_STORAGE_MODE || 'local').toLowerCase();
const webStorageMode = rawStorageMode === 'session' ? 'session' : 'local';

const resolveWebStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;

  if (webStorageMode === 'session' && window.sessionStorage) {
    return window.sessionStorage;
  }

  if (window.localStorage) {
    return window.localStorage;
  }

  return null;
};

const WebStorageAdapter = {
  getItem: (key: string) => {
    const storage = resolveWebStorage();
    if (storage) {
      return Promise.resolve(storage.getItem(key));
    }
    return Promise.resolve(null);
  },
  setItem: (key: string, value: string) => {
    const storage = resolveWebStorage();
    if (storage) {
      storage.setItem(key, value);
    }
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    const storage = resolveWebStorage();
    if (storage) {
      storage.removeItem(key);
    }
    return Promise.resolve();
  },
};

// Get environment variables with fallbacks for development
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  Constants.expoConfig?.extra?.supabaseUrl;

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  Constants.expoConfig?.extra?.supabaseAnonKey;

// Log configuration status for debugging
if (Platform.OS === 'web') {
  logger.debug('supabase', 'Supabase Configuration:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    urlLength: supabaseUrl?.length || 0,
    keyLength: supabaseAnonKey?.length || 0
  });
}

// Check if Supabase is properly configured
// Check if Supabase is properly configured
let hasLoggedSupabaseConfig = false;

// Check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  const configured = !!(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.length > 0 &&
    supabaseAnonKey.length > 0
  );

  if (!hasLoggedSupabaseConfig) {
    logger.debug('supabase', 'Supabase Config:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey,
      urlLength: supabaseUrl?.length || 0,
      keyLength: supabaseAnonKey?.length || 0,
      configured,
    });
    hasLoggedSupabaseConfig = true;
  }

  return configured;
};



// Lazy initialization of Supabase client - only create when variables are available
let _supabaseClient: any = null;

export const getSupabaseClient = () => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Missing URL or API key.');
  }
  
  if (!_supabaseClient) {
    _supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          storage: Platform.OS === 'web' ? WebStorageAdapter : EncryptedStorageAdapter,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          flowType: 'pkce',
        },
      },
    );
  }
  
  return _supabaseClient;
};

// For backward compatibility, create a proxy that throws helpful errors
export const supabase = new Proxy({} as any, {
  get(target, prop) {
    if (!isSupabaseConfigured()) {
      logger.warn('supabase', 'Server connection unavailable - operations will be skipped');
      // Return a mock object that doesn't throw but logs warnings
      return new Proxy({} as any, {
        get() {
          return () => Promise.resolve({ data: null, error: { message: 'Connection unavailable' } });
        }
      });
    }
    return getSupabaseClient()[prop];
  }
});

