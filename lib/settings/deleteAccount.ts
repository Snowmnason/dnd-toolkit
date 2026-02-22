import { getAuthProvider } from '@/lib/services';
import { AuthStateManager } from '../auth/auth-state';
import { validatePassword } from '../auth/validation';
import { validateCurrentUser } from '../database/common';
import { usersDB } from '../database/users';
import { logger } from '../utils/logger';

export interface DeleteAccountResult {
  success: boolean;
  error?: string;
  validationWarning?: string; // When client validation passed but server validation failed
}

/**
 * Deletes the current user's account with password verification
 * @param password - The user's password for re-authentication
 * @returns Promise with success status
 * @throws Error with user-friendly message if deletion fails
 */
export async function deleteUserAccount(password: string): Promise<DeleteAccountResult> {
  // Validate password outside try block so it's available in catch
  const passwordValidation = validatePassword(password);
  
  try {
    if (!password || password.trim().length === 0) {
      throw new Error('Password is required to confirm account deletion');
    }
    if (!passwordValidation.hasNoSqlKeywords || !passwordValidation.hasNoControlChars) {
      throw new Error('Password contains invalid characters');
    }

    // Get current authenticated user - MUST validate with server for security-critical operation
    // Account deletion is a security-critical operation that requires fresh server validation
    // Do NOT use cache-first approach here
    const authUser = await validateCurrentUser();
    if (!authUser?.email) {
      throw new Error('Unable to verify current user');
    }

    // Re-authenticate with password before deletion for security
    logger.debug('auth', 'Re-authenticating user before account deletion');
    const authProvider = await getAuthProvider();
    const reAuthResult = await authProvider.signIn(authUser.email, password);

    if (!reAuthResult.success) {
      const reAuthError = reAuthResult.error;
      logger.error('auth', 'Re-authentication failed:', reAuthError);
      // If password passed client validation but failed auth, mark as validation warning
      const isBackendValidationFailure = passwordValidation.isValid;
      throw Object.assign(new Error('Password verification failed. Please check your password and try again.'), {
        isBackendValidationFailure
      });
    }

    // Call the edge function to delete everything
    logger.info('auth', 'Starting account deletion process');
    const result = await usersDB.deleteCurrentUser();
    
    if (!result) {
      throw new Error('Account deletion failed. Please try again later.');
    }

    // Success - log and proceed with cleanup
    logger.info('auth', 'Account deletion completed successfully, result:', result);
    
    // Clean up local state and sign out
    logger.debug('auth', 'Clearing local auth state');
    await AuthStateManager.clearAuthState();
    try {
      await (await getAuthProvider()).signOut();
    } catch {
      // Ignore signout errors during account deletion cleanup
    }
    
    logger.info('auth', 'Account deletion and cleanup completed');
    
    return { success: true };
    
  } catch (error: any) {
    logger.error('auth', 'Delete account error:', error);
    
    // Check if this is a backend validation failure (client passed, server rejected)
    const isBackendValidationFailure = (error as any)?.isBackendValidationFailure || 
      (passwordValidation.isValid && error.message?.includes('Password verification failed'));
    
    return {
      success: false,
      validationWarning: isBackendValidationFailure ?
        'An authentication issue occurred. Please try again.' :
        undefined,
      error: error?.message || 'Failed to delete account. Please try again.'
    };
  }
}
