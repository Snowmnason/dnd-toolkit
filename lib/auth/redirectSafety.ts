/**
 * Safety mechanisms to prevent infinite redirects in authentication flow
 */

import { Platform } from 'react-native';

const REDIRECT_SAFETY_KEY = 'dnd_redirect_attempts';
const MAX_REDIRECT_ATTEMPTS = 3;
const RESET_TIME_MS = 5 * 60 * 1000; // 5 minutes

interface RedirectAttempt {
  count: number;
  lastAttempt: number;
  targetRoute: string;
}

// Storage interface
const getStorage = async () => {
  if (Platform.OS === 'web') {
    return {
      getItem: (key: string) => localStorage.getItem(key),
      setItem: (key: string, value: string) => localStorage.setItem(key, value),
      removeItem: (key: string) => localStorage.removeItem(key)
    };
  } else {
    const { EncryptedStorage } = await import('../encrypted-storage');
    return {
      getItem: (key: string) => EncryptedStorage.getItem(key),
      setItem: (key: string, value: string) => EncryptedStorage.setItem(key, value),
      removeItem: (key: string) => EncryptedStorage.removeItem(key)
    };
  }
};

/**
 * Check if a redirect is safe to perform (not creating infinite loop)
 */
export const isSafeToRedirect = async (targetRoute: string): Promise<boolean> => {
  try {
    const storage = await getStorage();
    const stored = await storage.getItem(REDIRECT_SAFETY_KEY);
    
    if (!stored) {
      // First redirect attempt
      await recordRedirectAttempt(targetRoute);
      return true;
    }
    
    const attempt: RedirectAttempt = JSON.parse(stored);
    const now = Date.now();
    
    // Reset counter if enough time has passed
    if (now - attempt.lastAttempt > RESET_TIME_MS) {
      await recordRedirectAttempt(targetRoute);
      return true;
    }
    
    // Different route - reset counter
    if (attempt.targetRoute !== targetRoute) {
      await recordRedirectAttempt(targetRoute);
      return true;
    }
    
    // Same route too many times
    if (attempt.count >= MAX_REDIRECT_ATTEMPTS) {
      console.warn(`🚨 Redirect safety: Too many attempts to redirect to ${targetRoute}`);
      return false;
    }
    
    // Safe to redirect
    await recordRedirectAttempt(targetRoute, attempt.count + 1);
    return true;
    
  } catch (error) {
    console.error('Error checking redirect safety:', error);
    // If we can't check, allow the redirect
    return true;
  }
};

/**
 * Record a redirect attempt
 */
const recordRedirectAttempt = async (targetRoute: string, count = 1): Promise<void> => {
  try {
    const storage = await getStorage();
    const attempt: RedirectAttempt = {
      count,
      lastAttempt: Date.now(),
      targetRoute
    };
    
    await storage.setItem(REDIRECT_SAFETY_KEY, JSON.stringify(attempt));
  } catch (error) {
    console.error('Error recording redirect attempt:', error);
  }
};

/**
 * Clear redirect safety tracking (call on successful app load)
 */
export const clearRedirectSafety = async (): Promise<void> => {
  try {
    const storage = await getStorage();
    await storage.removeItem(REDIRECT_SAFETY_KEY);
  } catch (error) {
    console.error('Error clearing redirect safety:', error);
  }
};

/**
 * Force allow next redirect (emergency escape hatch)
 */
export const forceAllowRedirect = async (): Promise<void> => {
  await clearRedirectSafety();
};