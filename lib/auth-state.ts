import { Platform } from 'react-native';

// ==========================================
// 🔧 DEVELOPMENT CONTROLS - Change these during development:
// ==========================================
const DEV_ALWAYS_SHOW_WELCOME = false; // Set to TRUE to always show welcome screen during development
const DEV_SKIP_STORAGE = false;         // Set to TRUE to bypass storage completely during development

// Simple storage interface for cross-platform compatibility
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (DEV_SKIP_STORAGE) return null; // 🔧 DEV: Bypass storage if flag is set
    
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
    if (DEV_SKIP_STORAGE) return; // 🔧 DEV: Bypass storage if flag is set
    
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
    if (DEV_SKIP_STORAGE) return; // 🔧 DEV: Bypass storage if flag is set
    
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
  // 🎯 MAIN ROUTING LOGIC - This decides where the user goes
  // ==========================================
  async getRoutingDecision(): Promise<'welcome' | 'login' | 'profile' | 'main'> {
    try {
      // 🔧 DEV BYPASS: Change DEV_ALWAYS_SHOW_WELCOME to true at the top of this file
      // to always show the welcome screen during development
      if (DEV_ALWAYS_SHOW_WELCOME) {
        console.log('🔧 DEV: Forced to welcome screen');
        return 'welcome';
      }

      const authState = await this.getAuthState();

      // If user has an account, check if they need to complete profile
      if (authState.hasAccount) {
        console.log('📱 User has account - checking profile completion');
        
        // Import supabase dynamically to avoid circular dependency
        const { supabase } = await import('./supabase');
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user && !user.user_metadata?.username) {
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