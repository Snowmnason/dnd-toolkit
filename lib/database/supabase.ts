import { SecureStorage } from '@/lib/storage';
import { logger } from '@/lib/utils/logger';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

// Auth session persistence via SecureStorage
// SecureStorage handles encryption on all platforms (web, iOS, Android)

// Supabase auth adapter using SecureStorage (encrypted on all platforms)
const SecureStorageAdapter = {
  getItem: (key: string) => SecureStorage.getItem(key),
  setItem: (key: string, value: string) => SecureStorage.setItem(key, value),
  removeItem: (key: string) => SecureStorage.removeItem(key),
};

// Get environment variables with fallbacks for development
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  Constants.expoConfig?.extra?.supabaseUrl;

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  Constants.expoConfig?.extra?.supabaseAnonKey;

// Log configuration status for debugging
logger.debug('supabase', 'Loading Supabase Configuration:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  urlLength: supabaseUrl?.length || 0,
  keyLength: supabaseAnonKey?.length || 0,
  platform: Platform.OS,
});

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
    logger.info('supabase', `Supabase Configuration Status: ${configured ? '✅ CONFIGURED' : '❌ NOT CONFIGURED'}`, {
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
          storage: SecureStorageAdapter,
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

