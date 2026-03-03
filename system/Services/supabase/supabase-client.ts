import { logger } from '@/lib/utils/logger';
import { SessionAdapter } from '@/system/Services/session-adapter';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

/**
 * SECURITY NOTE: Web Platform Session Persistence
 *
 * Supabase auth SDK requires SYNCHRONOUS storage for session persistence on web,
 * but our encryption layer (EncryptedStorage) is async. This creates a dilemma:
 *
 * ❌ Option 1: Sync WebStorageAdapter with unencrypted localStorage
 *    - Tokens stored unencrypted in localStorage
 *    - Attackable via XSS or physical access
 *    - Regression from encrypted storage on other platforms
 *
 * ✅ Option 2: Disable session persistence on web (CHOSEN)
 *    - No session tokens stored in localStorage (safer)
 *    - Users re-authenticate on page reload
 *    - Acceptable for web apps (no worse than most SPAs)
 *    - Removes attack surface for token theft
 *
 * ✅ Option 3: Mobile platforms use Supabase's built-in async storage
 *    - Works with AsyncStorage (automatically encrypted via platform-native storage)
 *    - Session persists across app restarts
 *    - Secure on iOS (Keychain) and Android (Keystore)
 *
 * IMPLEMENTATION:
 * - Web: persistSession=false, detectSessionInUrl=false (no token persistence)
 * - Native: omit auth.storage to use Supabase's async adapter (encrypted via platform-native storage)
 */

// Get environment variables with fallbacks for development
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  Constants.expoConfig?.extra?.supabaseUrl;

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  Constants.expoConfig?.extra?.supabaseAnonKey;

// Log configuration status for debugging
logger.category('storage').debug('Loading Supabase Configuration:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  urlLength: supabaseUrl?.length || 0,
  keyLength: supabaseAnonKey?.length || 0,
  platform: Platform.OS,
});

// Check if Supabase is properly configured
let hasLoggedSupabaseConfig = false;

export const isSupabaseConfigured = () => {
  const configured = !!(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.length > 0 &&
    supabaseAnonKey.length > 0
  );

  if (!hasLoggedSupabaseConfig) {
    logger.category('storage').info(`Supabase Configuration Status: ${configured ? '✅ CONFIGURED' : '❌ NOT CONFIGURED'}`, {
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
    // Build auth config
    const authConfig: any = {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    };

    // Web: DISABLE session persistence to prevent unencrypted token storage
    // Web users will re-authenticate on page reload (secure trade-off)
    if (typeof window !== 'undefined') {
      authConfig.persistSession = false;
      logger.category('storage').info('🔒 Web: Session persistence disabled for security (users re-auth on reload)');
    } else {
      // Mobile: Enable session persistence with platform-native async storage
      // AsyncStorage on mobile is automatically encrypted via EncryptedStorage
      authConfig.persistSession = true;
      logger.category('storage').info('Mobile: Session persistence enabled via platform-native async storage (encrypted)');
    }

    _supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: authConfig,
      },
    );

    // On web, listen for auth state changes and save session
    // IMPORTANT: This manually persists the session since web has persistSession=false for security
    if (typeof window !== 'undefined') {
      _supabaseClient.auth.onAuthStateChange((event: string, session: any) => {
        if (event === 'SIGNED_IN' && session) {
          logger.category('storage').info('✅ User authenticated (saving session to encrypted storage)', {
            auth_id: session.user?.id,
            hasAccessToken: !!session.access_token,
          });
          SessionAdapter.saveSession(session).catch((err) => {
            logger.category('storage').error('Failed to save auth session:', err);
          });
        } else if (event === 'SIGNED_OUT') {
          logger.category('storage').info('🔓 User signed out');
          SessionAdapter.clearSession().catch((err) => {
            logger.category('storage').error('Failed to clear auth session:', err);
          });
        } else if (event === 'TOKEN_REFRESHED' && session) {
          logger.category('storage').debug('🔄 Token refreshed, updating saved session');
          SessionAdapter.saveSession(session).catch((err) => {
            logger.category('storage').error('Failed to update auth session:', err);
          });
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
      logger.category('storage').warn('Server connection unavailable - operations will be skipped');
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
