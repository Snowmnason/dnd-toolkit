/**
 * Safety mechanisms to prevent infinite redirects in authentication flow
 */

import { SecureStorage } from '../storage';
import { logger } from '../utils/logger';

const REDIRECT_SAFETY_KEY = 'dnd_redirect_attempts';
const MAX_REDIRECT_ATTEMPTS = 3;
const RESET_TIME_MS = 5 * 60 * 1000; // 5 minutes

interface RedirectAttempt {
  count: number;
  lastAttempt: number;
  targetRoute: string;
}

// Storage interface using SecureStorage for consistency
const getStorage = () => {
  return {
    getItem: (key: string) => SecureStorage.getItem(key),
    setItem: (key: string, value: string) => SecureStorage.setItem(key, value),
    removeItem: (key: string) => SecureStorage.removeItem(key)
  };
};

/**
 * Check if a redirect is safe to perform (not creating infinite loop)
 */
export const isSafeToRedirect = async (targetRoute: string): Promise<boolean> => {
  try {
    const storage = getStorage();
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
      logger.category('security').warn(`Too many attempts to redirect to ${targetRoute}`);
      return false;
    }
    
    // Safe to redirect
    await recordRedirectAttempt(targetRoute, attempt.count + 1);
    return true;
    
  } catch (error) {
    logger.category('security').error('Error checking redirect safety:', error);
    // If we can't check, allow the redirect
    return true;
  }
};

/**
 * Record a redirect attempt
 */
const recordRedirectAttempt = async (targetRoute: string, count = 1): Promise<void> => {
  try {
    const storage = getStorage();
    const attempt: RedirectAttempt = {
      count,
      lastAttempt: Date.now(),
      targetRoute
    };
    
    await storage.setItem(REDIRECT_SAFETY_KEY, JSON.stringify(attempt));
  } catch (error) {
    logger.category('security').error('Error recording redirect attempt:', error);
  }
};

/**
 * Clear redirect safety tracking (call on successful app load)
 */
export const clearRedirectSafety = async (): Promise<void> => {
  try {
    const storage = getStorage();
    await storage.removeItem(REDIRECT_SAFETY_KEY);
  } catch (error) {
    logger.category('security').error('Error clearing redirect safety:', error);
  }
};

/**
 * Force allow next redirect (emergency escape hatch)
 */
export const forceAllowRedirect = async (): Promise<void> => {
  await clearRedirectSafety();
};