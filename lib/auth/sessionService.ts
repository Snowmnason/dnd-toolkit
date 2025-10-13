import { AuthStateManager } from '../auth-state';
import { usersDB } from '../database/users';
import { supabase } from '../supabase';
import { logger } from '../utils/logger';

export interface SessionCheckResult {
  hasValidSession: boolean;
  hasCompleteProfile: boolean;
  shouldRedirectTo?: string;
}

/**
 * Check if user has a valid session and complete profile
 * Returns routing information based on auth state
 */
export const checkUserSession = async (): Promise<SessionCheckResult> => {
  try {
    // First, check if user already has valid session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (!session || error) {
      return {
        hasValidSession: false,
        hasCompleteProfile: false,
        shouldRedirectTo: '/login/sign-in'
      };
    }

  logger.info('session', 'Valid session found for:', session.user?.email);
    
    // Update auth state
    await AuthStateManager.setHasAccount(true);
    
    // Check if user has complete profile in database
    try {
      const userProfile = await usersDB.getCurrentUser();
      if (userProfile && userProfile.username) {
        return {
          hasValidSession: true,
          hasCompleteProfile: true,
          shouldRedirectTo: '/select/world-selection'
        };
      }
    } catch (profileError) {
      logger.warn('session', 'Profile check failed:', profileError);
      // Profile doesn't exist or can't be retrieved
    }
    
    // Has session but incomplete profile
    return {
      hasValidSession: true,
      hasCompleteProfile: false,
      shouldRedirectTo: '/login/complete-profile' // Go to complete profile screen
    };
    
  } catch (error) {
    logger.error('session', 'Session check error:', error);
    return {
      hasValidSession: false,
      hasCompleteProfile: false,
      shouldRedirectTo: '/login/sign-in'
    };
  }
};

/**
 * Quick navigation helper for auth state management
 */
export const prepareAuthNavigation = async (): Promise<void> => {
  try {
    await AuthStateManager.setHasAccount(true);
  } catch (error) {
    logger.error('session', 'Auth state preparation error:', error);
    throw new Error('Unable to prepare authentication state');
  }
};