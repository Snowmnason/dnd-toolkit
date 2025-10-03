import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';
import { EncryptedStorageAdapter } from './encrypted-storage';

// Web storage adapter that uses localStorage (browser) instead of AsyncStorage
const WebStorageAdapter = {
  getItem: (key: string) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return Promise.resolve(window.localStorage.getItem(key));
    }
    return Promise.resolve(null);
  },
  setItem: (key: string, value: string) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
    return Promise.resolve();
  },
};

// Get environment variables with fallbacks for development
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Log configuration status for debugging
if (Platform.OS === 'web') {
  console.log('🔧 Supabase Configuration:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    urlLength: supabaseUrl.length,
    keyLength: supabaseAnonKey.length
  });
}

// Check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseAnonKey && supabaseUrl.length > 0 && supabaseAnonKey.length > 0);
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
      console.warn('⚠️  Server connection unavailable - operations will be skipped');
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