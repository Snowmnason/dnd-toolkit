import { Platform } from 'react-native';
import { logger } from './utils/logger';

// Simple storage interface for cross-platform compatibility
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return null;
    } else {
      // For mobile, we'll use our encrypted storage
      const { EncryptedStorage } = await import('./auth/encrypted-storage');
      return await EncryptedStorage.getItem(key);
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } else {
      // For mobile, we'll use our encrypted storage
      const { EncryptedStorage } = await import('./auth/encrypted-storage');
      await EncryptedStorage.setItem(key, value);
    }
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } else {
      // For mobile, we'll use our encrypted storage
      const { EncryptedStorage } = await import('./auth/encrypted-storage');
      await EncryptedStorage.removeItem(key);
    }
  }
};

// Storage keys
const STORAGE_KEYS = {
  HAS_ACCOUNT: 'dnd_has_account',
  USER_DATA: 'dnd_user_data',
  USER_DATA_TIMESTAMP: 'dnd_user_data_timestamp'  // Track when cache was last updated
};

export interface AuthState {
  hasAccount: boolean;
}

export interface StoredUserData {
  id: string;
  auth_id: string;
  username: string;
  created_at: string;
}

// Cache expiration: 4 hours in milliseconds
const CACHE_EXPIRATION_MS = 4 * 60 * 60 * 1000; // 14,400,000 ms

export const AuthStateManager = {
  // Get current auth state
  async getAuthState(): Promise<AuthState> {
    try {
      const hasAccount = await storage.getItem(STORAGE_KEYS.HAS_ACCOUNT);

      return {
        hasAccount: hasAccount === 'true'
      };
    } catch (error) {
      logger.error('auth-state', 'Error getting auth state:', error);
      return {
        hasAccount: false
      };
    }
  },

  // Save user data to local storage with timestamp
  async saveUserData(userData: StoredUserData): Promise<void> {
    try {
      await storage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
      // Store the timestamp when this cache was updated
      await storage.setItem(STORAGE_KEYS.USER_DATA_TIMESTAMP, Date.now().toString());
      logger.debug('auth-state', 'User data saved to storage with timestamp:', { id: userData.id, username: userData.username });
    } catch (error) {
      logger.error('auth-state', 'Error saving user data:', error);
    }
  },

  // Get user data from local storage
  async getUserData(): Promise<StoredUserData | null> {
    try {
      const userData = await storage.getItem(STORAGE_KEYS.USER_DATA);
      if (userData) {
        return JSON.parse(userData);
      }
      return null;
    } catch (error) {
      logger.error('auth-state', 'Error getting user data:', error);
      return null;
    }
  },

  // Get userId from local storage (convenience method)
  async getUserId(): Promise<string | null> {
    try {
      const userData = await this.getUserData();
      return userData?.id || null;
    } catch (error) {
      logger.error('auth-state', 'Error getting user ID:', error);
      return null;
    }
  },

  // Set user has created/logged into account
  async setHasAccount(hasAccount: boolean): Promise<void> {
    try {
      await storage.setItem(STORAGE_KEYS.HAS_ACCOUNT, hasAccount.toString());
    } catch (error) {
      logger.error('auth-state', 'Error setting hasAccount:', error);
    }
  },

  // Store session information or mark that user has an account when a session exists
  async setSession(session: any): Promise<void> {
    try {
      // Keep the simple has-account flag in sync
      await storage.setItem(STORAGE_KEYS.HAS_ACCOUNT, 'true');

      // Optionally cache minimal session info on web (not storing full token for security)
      if (Platform.OS === 'web' && session?.user?.email) {
        try {
          const key = 'dnd_session_user_email';
          window.localStorage.setItem(key, session.user.email);
  } catch {
          // ignore
        }
      }
    } catch {
      logger.error('auth-state', '', );
    }
  },

  // Clear all auth state (logout)
  async clearAuthState(): Promise<void> {
    try {
      await storage.removeItem(STORAGE_KEYS.HAS_ACCOUNT);
      await storage.removeItem(STORAGE_KEYS.USER_DATA);
      await storage.removeItem(STORAGE_KEYS.USER_DATA_TIMESTAMP);
      logger.debug('auth-state', 'Auth state cleared');
    } catch (error) {
      logger.error('auth-state', 'Error clearing auth state:', error);
    }
  },

  // Check if cached user data is still fresh (< 4 hours old)
  async isCacheFresh(): Promise<boolean> {
    try {
      const timestampStr = await storage.getItem(STORAGE_KEYS.USER_DATA_TIMESTAMP);
      if (!timestampStr) {
        return false; // No timestamp = no cache
      }
      
      const timestamp = parseInt(timestampStr, 10);
      const age = Date.now() - timestamp;
      const isFresh = age < CACHE_EXPIRATION_MS;
      
      logger.debug('auth-state', 'Cache freshness check:', {
        age: `${Math.round(age / 1000 / 60)} minutes`,
        maxAge: '240 minutes (4 hours)',
        isFresh
      });
      
      return isFresh;
    } catch (error) {
      logger.error('auth-state', 'Error checking cache freshness:', error);
      return false;
    }
  },

  // ==========================================
  // 🔒 AUTHENTICATION CHECK - Quick check for route guards
  // ==========================================
  async isAuthenticated(): Promise<boolean> {
    try {
      const authState = await this.getAuthState();
      
      if (!authState.hasAccount) {
        return false;
      }

      // Import supabase dynamically to avoid circular dependency
      const { supabase, isSupabaseConfigured } = await import('./database/supabase');
      
      // If Supabase isn't configured (like on GitHub Pages without env vars), 
      // fall back to local auth state
      if (!isSupabaseConfigured()) {
        logger.warn('auth-state', 'Supabase not configured, using local auth state');
        return authState.hasAccount;
      }
      
      // Use cached session instead of getUser() to avoid network call
      const { data: { session } } = await supabase.auth.getSession();
      
      // User must have active session and be confirmed
      return !!(session?.user && session.user.email_confirmed_at);
    } catch {
      logger.error('auth-state', '', );
      // On error, fall back to local auth state
      try {
        const authState = await this.getAuthState();
        return authState.hasAccount;
  } catch {
        return false;
      }
    }
  },

  // ==========================================
  // 🎯 MAIN ROUTING LOGIC - This decides where the user goes
  // ==========================================
  async getRoutingDecision(): Promise<{ routingDecision: 'welcome' | 'login' | 'main' | 'complete-profile'; profileId: string | null }> {
    try {
      // First, get local auth flag
      const authState = await this.getAuthState();

      // Import supabase (lazy) and check if configured
      const { supabase, isSupabaseConfigured } = await import('./database/supabase');

      // If Supabase isn't configured, fall back to local state
      if (!isSupabaseConfigured()) {
        logger.warn('auth-state', 'Supabase not configured - defaulting to welcome');
        return { routingDecision: 'welcome', profileId: null };
      }

      // Ask Supabase for an active session
      const { data: { session } } = await supabase.auth.getSession();

      // Try to fetch the user profile once (may fail)
      let userProfile: any = null;
      try {
        const { usersDB } = await import('./database/users');
        userProfile = await usersDB.getCurrentUser();
      } catch (dbError) {
        logger.debug('auth-state', 'Database error checking profile:', dbError);
        // If DB fails, allow user to continue to main (graceful degradation)
        if (session) return { routingDecision: 'main', profileId: userProfile?.id || null };
        // If no session but we can't query profile, prefer 'login' if user has account, else 'welcome'
        return { routingDecision: authState.hasAccount ? 'login' : 'welcome', profileId: null };
      }

      // If there is an active Supabase session
      if (session) {
        // Sanity-check profile identity: prefer auth_id match, fallback to id
        const matchesAuth = !!userProfile && (
          userProfile.auth_id === session.user.id || userProfile.id === session.user.id
        );

        // If profile missing or mismatch -> force complete-profile path
        if (!matchesAuth) {
          return { routingDecision: 'complete-profile', profileId: userProfile?.id || null };
        }

        // If username is missing or blank -> complete-profile
        if (!userProfile.username || userProfile.username.trim().length === 0) {
          return { routingDecision: 'complete-profile', profileId: userProfile.id };
        }

        // Session and profile valid -> main
        return { routingDecision: 'main', profileId: userProfile.id };
      }

      // No active session
      if (authState.hasAccount) {
        // User has an account but no active session -> prompt login
        return { routingDecision: 'login', profileId: null };
      }

      // No account and no session -> welcome
      return { routingDecision: 'welcome', profileId: null };
    } catch (error) {
      logger.error('auth-state', '', error);
      return { routingDecision: 'welcome', profileId: null };
    }
  }
};
