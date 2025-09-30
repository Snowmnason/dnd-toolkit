import { Platform } from 'react-native';

// ==========================================
// 🔧 DEVELOPMENT CONTROLS - Change these during development:
// ==========================================
const DEV_ALWAYS_SHOW_WELCOME = true; // Set to TRUE to always show welcome screen during development
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
  HAS_ACCOUNT: 'dnd_has_account',
  SKIP_AUTH: 'dnd_skip_auth',
  USER_CHOICE: 'dnd_user_choice'
};

export interface AuthState {
  hasAccount: boolean;
  skipAuth: boolean;
  userChoice: 'account' | 'skip' | null;
}

export const AuthStateManager = {
  // Get current auth state
  async getAuthState(): Promise<AuthState> {
    try {
      const [hasAccount, skipAuth, userChoice] = await Promise.all([
        storage.getItem(STORAGE_KEYS.HAS_ACCOUNT),
        storage.getItem(STORAGE_KEYS.SKIP_AUTH),
        storage.getItem(STORAGE_KEYS.USER_CHOICE)
      ]);

      return {
        hasAccount: hasAccount === 'true',
        skipAuth: skipAuth === 'true',
        userChoice: userChoice as 'account' | 'skip' | null
      };
    } catch (error) {
      console.error('Error getting auth state:', error);
      return {
        hasAccount: false,
        skipAuth: false,
        userChoice: null
      };
    }
  },

  // Set user has created/logged into account
  async setHasAccount(hasAccount: boolean): Promise<void> {
    try {
      await storage.setItem(STORAGE_KEYS.HAS_ACCOUNT, hasAccount.toString());
      if (hasAccount) {
        await storage.setItem(STORAGE_KEYS.USER_CHOICE, 'account');
        await storage.removeItem(STORAGE_KEYS.SKIP_AUTH);
      }
    } catch (error) {
      console.error('Error setting has account:', error);
    }
  },

  // Set user chose to skip authentication
  async setSkipAuth(skipAuth: boolean): Promise<void> {
    try {
      await storage.setItem(STORAGE_KEYS.SKIP_AUTH, skipAuth.toString());
      if (skipAuth) {
        await storage.setItem(STORAGE_KEYS.USER_CHOICE, 'skip');
      }
    } catch (error) {
      console.error('Error setting skip auth:', error);
    }
  },

  // Clear all auth state (logout)
  async clearAuthState(): Promise<void> {
    try {
      await Promise.all([
        storage.removeItem(STORAGE_KEYS.HAS_ACCOUNT),
        storage.removeItem(STORAGE_KEYS.SKIP_AUTH),
        storage.removeItem(STORAGE_KEYS.USER_CHOICE)
      ]);
    } catch (error) {
      console.error('Error clearing auth state:', error);
    }
  },

  // ==========================================
  // 🎯 MAIN ROUTING LOGIC - This decides where the user goes
  // ==========================================
  async getRoutingDecision(): Promise<'welcome' | 'login' | 'main'> {
    try {
      // 🔧 DEV BYPASS: Change DEV_ALWAYS_SHOW_WELCOME to true at the top of this file
      // to always show the welcome screen during development
      if (DEV_ALWAYS_SHOW_WELCOME) {
        console.log('🔧 DEV: Forced to welcome screen');
        return 'welcome';
      }

      const authState = await this.getAuthState();

      // If user has an account, try to log them in automatically
      if (authState.hasAccount) {
        console.log('📱 User has account - going to main app');
        return 'main'; // You could change this to 'login' if you want them to re-enter password
      }

      // If user chose to skip auth, go directly to main app
      if (authState.skipAuth) {
        console.log('📱 User skipped auth - going to main app');
        return 'main';
      }

      // First time or no preference - show welcome screen
      console.log('� First time user - showing welcome');
      return 'welcome';
    } catch (error) {
      console.error('Error getting routing decision:', error);
      return 'welcome';
    }
  }
};