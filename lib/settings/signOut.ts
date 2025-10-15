import { AuthStateManager } from '../auth-state';
import { supabase } from '../database/supabase';
import { logger } from '../utils/logger';

/**
 * Signs out the current user and clears local auth state
 * @throws Error if sign out fails
 */
export async function signOutUser(): Promise<void> {
  try {
    logger.debug('signOut', 'Starting sign out process');
    
    await supabase.auth.signOut();
    await AuthStateManager.clearAuthState();
    
    logger.info('signOut', 'Sign out completed successfully');
  } catch (error) {
    logger.error('signOut', 'Sign out error:', error);
    throw new Error('Failed to sign out. Please try again.');
  }
}
