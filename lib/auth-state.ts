import { Platform } from 'react-native';

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
      const { EncryptedStorage } = await import('./encrypted-storage');
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
      const { EncryptedStorage } = await import('./encrypted-storage');
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
      const { EncryptedStorage } = await import('./encrypted-storage');
      await EncryptedStorage.removeItem(key);
    }
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
      console.error('Error getting auth state:', error);
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
      console.error('Error setting has account:', error);
    }
  },

  // Clear all auth state (logout)
  async clearAuthState(): Promise<void> {
    try {
      await storage.removeItem(STORAGE_KEYS.HAS_ACCOUNT);
    } catch (error) {
      console.error('Error clearing auth state:', error);
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
      const { supabase } = await import('./supabase');
      const { data: { user } } = await supabase.auth.getUser();
      
      // User must exist and have a username to be considered fully authenticated
      return !!(user && user.user_metadata?.username);
    } catch (error) {
      console.error('Error checking authentication:', error);
      return false;
    }
  },

  // ==========================================
  // 🎯 MAIN ROUTING LOGIC - This decides where the user goes
  // ==========================================
  async getRoutingDecision(): Promise<'welcome' | 'login' | 'profile' | 'main'> {
    try {
      const authState = await this.getAuthState();

      // If user has an account, check if they're actually logged in
      if (authState.hasAccount) {
        console.log('📱 User has account - checking authentication status');
        
        // Import supabase dynamically to avoid circular dependency
        const { supabase } = await import('./supabase');
        const { data: { user } } = await supabase.auth.getUser();
        
        // If no user exists (signed out), clear local state and go to welcome
        if (!user) {
          console.log('❌ No authenticated user found - clearing local state');
          await this.clearAuthState();
          return 'welcome';
        }
        
        // User exists, check if they need to complete profile
        if (!user.user_metadata?.username) {
          console.log('👤 User needs to complete profile');
          return 'profile';
        }
        
        console.log('📱 User profile complete - going to main app');
        return 'main';
      }

      // First time user - show welcome screen
      console.log('👋 First time user - showing welcome');
      return 'welcome';
    } catch (error) {
      console.error('Error getting routing decision:', error);
      return 'welcome';
    }
  }
};