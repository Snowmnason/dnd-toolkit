import { AuthStateManager } from '../auth/auth-state';
import { getSupabaseClient, isSupabaseConfigured } from '../database/supabase';
import { logger } from '../utils/logger';

/**
 * Signs out the current user and clears local auth state
 * @throws Error if sign out fails
 */
export async function signOutUser(): Promise<void> {
  try {
    logger.debug('auth', 'Starting sign out process');
    
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    await AuthStateManager.clearAuthState();
    
    logger.info('auth', 'Sign out completed successfully');
  } catch (error) {
    logger.error('auth', 'Sign out error:', error);
    throw new Error('Failed to sign out. Please try again.');
  }
}
