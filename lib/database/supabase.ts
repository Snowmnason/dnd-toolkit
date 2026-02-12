import { logger } from '@/lib/utils/logger';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

// Auth session persistence via synchronous storage
// Supabase auth SDK REQUIRES synchronous storage access (cannot use async methods)
// On web: let Supabase use its default localStorage (it detects web environment automatically)
// On mobile: return null so Supabase uses its AsyncStorage integration
const StorageAdapter = {
  getItem: (key: string) => {
    // Web: let Supabase's default handle it (it uses localStorage automatically)
    if (typeof window !== 'undefined' && window.localStorage) {
      const value = window.localStorage.getItem(key);
      if (value) {
        logger.debug('storage', `StorageAdapter.getItem: ${key} (${value.length} chars)`);
      }
      return value;
    }
    // Mobile: return null - Supabase SDK will use its internal AsyncStorage
    return null;
  },
  setItem: (key: string, value: string) => {
    // Web: use localStorage (synchronous)
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      logger.debug('storage', `StorageAdapter.setItem: ${key} (${value.length} chars)`);
    }
    // Mobile: handled by Supabase SDK's AsyncStorage integration
  },
  removeItem: (key: string) => {
    // Web: use localStorage (synchronous)
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
      logger.debug('storage', `StorageAdapter.removeItem: ${key}`);
    }
    // Mobile: handled by Supabase SDK's AsyncStorage integration
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
logger.debug('storage', 'Loading Supabase Configuration:', {
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
    logger.info('storage', `Supabase Configuration Status: ${configured ? '✅ CONFIGURED' : '❌ NOT CONFIGURED'}`, {
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
          storage: StorageAdapter,
          storageKey: 'sb-auth-token', // Explicit key for session storage
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          flowType: 'pkce',
        },
      },
    );

    // On web, ensure session persists to our StorageAdapter
    if (typeof window !== 'undefined') {
      // Listen for auth state changes and persist session
      _supabaseClient.auth.onAuthStateChange((event: string, session: any) => {
        if (event === 'SIGNED_IN' && session) {
          logger.info('storage', '✅ Session persisted to localStorage', {
            userId: session.user?.id?.substring(0, 8),
            hasAccessToken: !!session.access_token,
          });
        } else if (event === 'SIGNED_OUT') {
          logger.info('storage', '🔓 Session cleared from localStorage');
        }
      });
    }
  }
  
  return _supabaseClient;
};

// For backward compatibility, create a proxy that throws helpful errors
export const supabase = new Proxy({} as any, {
  get(target, prop) {
    if (!isSupabaseConfigured()) {
      logger.warn('storage', 'Server connection unavailable - operations will be skipped');
      // Return a mock object that doesn't throw but logs warnings
      return new Proxy({} as any, {
        get() {
          return () => Promise.resolve({ data: null, error: { message: 'Connection unavailable' } });
        }
      });
    }
    // eslint-disable-next-line security/detect-object-injection
    return getSupabaseClient()[prop];
  }
});

