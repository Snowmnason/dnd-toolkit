import { validateUsername } from '../auth/validation';
import { usersDB } from '../database/users';
import { logger } from '../utils/logger';

export interface UpdateUsernameResult {
  success: boolean;
  error?: string;
}

/**
 * Updates the current user's username with validation
 * @param newUsername - The new username to set
 * @returns Promise with success status
 */
export async function updateUsername(newUsername: string): Promise<UpdateUsernameResult> {
  try {
    logger.info('updateUsername', 'Starting username update');

    // Validate username
    const usernameValidation = validateUsername(newUsername);
    logger.debug('updateUsername', 'Username validation:', {
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
    logger.debug('updateUsername', 'Updating username in database');
    await usersDB.updateCurrentUser({
      username: usernameValidation.sanitized
    });

    logger.info('updateUsername', 'Username updated successfully');
    return { success: true };

  } catch (error: any) {
    logger.error('updateUsername', 'Username update error:', error);
    
    // Handle specific errors
    if (error.message?.includes('duplicate') || error.code === '23505') {
      return { success: false, error: 'Username already taken. Please choose another.' };
    }
    
    return {
      success: false,
      error: error?.message || 'Failed to update username. Please try again.'
    };
  }
}
