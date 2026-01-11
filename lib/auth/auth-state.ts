import { SecureStorage } from '../storage';
import { logger } from '../utils/logger';

// Simple storage interface for cross-platform compatibility
const storage = {
  async getItem(key: string): Promise<string | null> {
    return await SecureStorage.getItem(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    await SecureStorage.setItem(key, value);
  },

  async removeItem(key: string): Promise<void> {
    await SecureStorage.removeItem(key);
  }
};

// Storage keys
const STORAGE_KEYS = {
  HAS_ACCOUNT: 'dnd_has_account'
};

export interface AuthState {
  hasAccount: boolean;
}

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

      // Optionally cache minimal session info (encrypted via SecureStorage)
      if (session?.user?.email) {
        try {
          const key = 'dnd_session_user_email';
          await SecureStorage.setItem(key, session.user.email);
        } catch (error) {
          logger.error('auth-state', 'Error caching session email:', error);
        }
      }
    } catch (error) {
      logger.error('auth-state', 'Error saving auth state:', error);
    }
  },

  // Clear all auth state (logout)
  async clearAuthState(): Promise<void> {
    try {
      await storage.removeItem(STORAGE_KEYS.HAS_ACCOUNT);
    } catch (error) {
      logger.error('auth-state', 'Error clearing auth state:', error);
    }
  },

  // ==========================================
  // 🔒 AUTHENTICATION CHECK - Quick check for route guards
  // ==========================================
  async isAuthenticated(): Promise<boolean> {
    try {
      // Step 1: Quick local storage check (fast path)
      const authState = await this.getAuthState();
      
      if (!authState.hasAccount) {
        return false;
      }

      // Import supabase dynamically to avoid circular dependency
      const { supabase, isSupabaseConfigured } = await import('../database/supabase');
      
      // If Supabase isn't configured (like on GitHub Pages without env vars), 
      // fall back to local auth state
      if (!isSupabaseConfigured()) {
        logger.warn('auth-state', 'Supabase not configured, using local auth state');
        return authState.hasAccount;
      }
      
      // Step 2: Try to get cached session with a short timeout
      // This prevents the auth guard from hanging on slow network
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), 2000) // 2 second timeout
        );
        
        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);
        
        // If we got a session, verify it's confirmed
        if (session?.user && session.user.email_confirmed_at) {
          return true;
        }
        
        // If session check timed out or returned null, trust local storage
        // The background session restore will update this later
        return authState.hasAccount;
      } catch {
        // On any error, trust local storage
        return authState.hasAccount;
      }
    } catch (error) {
      logger.error('auth-state', 'Error checking authentication:', error);
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
      const { supabase, isSupabaseConfigured } = await import('../database/supabase');

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
        const { usersDB } = await import('../database/users');
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
          return { routingDecision: 'complete-profile', profileId: userProfile.id };
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
      logger.error('auth-state', 'Error determining routing decision:', error);
      return { routingDecision: 'welcome', profileId: null };
    }
  }
};
