import { validateUsername } from '../auth/validation';
import { usersDB } from '../database/users';
import { logger } from '../utils/logger';

export interface UpdateUsernameResult {
  success: boolean;
  error?: string;
  validationWarning?: string; // When client validation passed but server validation failed
}

/**
 * Updates the current user's username with validation
 * @param newUsername - The new username to set
 * @returns Promise with success status
 */
export async function updateUsername(newUsername: string): Promise<UpdateUsernameResult> {
  // Validate username outside try block so it's available in catch
  const usernameValidation = validateUsername(newUsername);
  
  try {
    logger.category('other').info('Starting username update');

    logger.category('other').debug('Username validation', {
      isValid: usernameValidation.isValid,
      sanitized: usernameValidation.sanitized
    });

    if (!usernameValidation.isValid) {
      if (!newUsername.trim()) {
        return { success: false, error: 'Username is required' };
      }
      if (!usernameValidation.startsWithLetter) {
        return { success: false, error: 'Username must start with a letter' };
      }
      if (!usernameValidation.minLength || !usernameValidation.maxLength) {
        return { success: false, error: 'Username must be 3-20 characters long' };
      }
      if (!usernameValidation.validChars) {
        return { success: false, error: 'Username can only contain letters, numbers, and underscores' };
      }
      return { success: false, error: 'Invalid username format' };
    }

    // Update username in database
    logger.category('database').debug('Updating username in database');
    await usersDB.updateCurrentUser({
      username: usernameValidation.sanitized
    });
    return { success: true };

  } catch (error: any) {
    logger.category('database').error('Username update error', error);
    
    // Handle specific errors
    if (error.message?.includes('duplicate') || error.code === '23505') {
      return { success: false, error: 'Username already taken. Please choose another.' };
    }
    
    // Check if this is a backend validation failure (client passed Zod, server rejected)
    const isBackendValidationFailure = 
      error.message?.includes('invalid username') ||
      error.message?.includes('username') ||
      error.code === 'INVALID_USERNAME' ||
      (error.message && usernameValidation.isValid);
    
    return {
      success: false,
      validationWarning: isBackendValidationFailure ? 
        'Your username was rejected by the server. Please try a different one.' : 
        undefined,
      error: error?.message || 'Failed to update username. Please try again.'
    };
  }
}
