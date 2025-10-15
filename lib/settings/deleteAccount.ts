import { AuthStateManager } from '../auth-state';
import { validatePassword } from '../auth/validation';
import { supabase } from '../database/supabase';
import { usersDB } from '../database/users';
import { logger } from '../utils/logger';

export interface DeleteAccountResult {
  success: boolean;
  error?: string;
}

/**
 * Deletes the current user's account with password verification
 * @param password - The user's password for re-authentication
 * @returns Promise with success status
 * @throws Error with user-friendly message if deletion fails
 */
export async function deleteUserAccount(password: string): Promise<DeleteAccountResult> {
  try {
    // Validate password using utility function
    const passwordValidation = validatePassword(password);
    if (!password || password.trim().length === 0) {
      throw new Error('Password is required to confirm account deletion');
    }
    if (!passwordValidation.hasNoSqlKeywords || !passwordValidation.hasNoControlChars) {
      throw new Error('Password contains invalid characters');
    }

    // Get current authenticated user
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser?.email) {
      throw new Error('Unable to verify current user');
    }

    // Re-authenticate with password before deletion for security
    logger.debug('deleteAccount', 'Re-authenticating user before account deletion');
    const { error: reAuthError } = await supabase.auth.signInWithPassword({
      email: authUser.email,
      password: password
    });

    if (reAuthError) {
      logger.error('deleteAccount', 'Re-authentication failed:', reAuthError);
      throw new Error('Password verification failed. Please check your password and try again.');
    }

    // Call the edge function to delete everything
    logger.info('deleteAccount', 'Starting account deletion process');
    const result = await usersDB.deleteCurrentUser();
    
    if (!result) {
      throw new Error('Account deletion failed. Please try again later.');
    }

    // Success - log and proceed with cleanup
    logger.info('deleteAccount', 'Account deletion completed successfully, result:', result);
    
    // Clean up local state and sign out
    logger.debug('deleteAccount', 'Clearing local auth state');
    await AuthStateManager.clearAuthState();
    await supabase.auth.signOut();
    
    logger.info('deleteAccount', 'Account deletion and cleanup completed');
    
    return { success: true };
    
  } catch (error: any) {
    logger.error('deleteAccount', 'Delete account error:', error);
    return {
      success: false,
      error: error?.message || 'Failed to delete account. Please try again.'
    };
  }
}
