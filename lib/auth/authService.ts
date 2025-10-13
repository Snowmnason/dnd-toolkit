import { usersDB } from '../database/users';
import { supabase } from '../supabase';
import { logger } from '../utils/logger';
import { isExistingUser, validateEmail, validatePassword } from './validation';

export interface SignUpResult {
  success: boolean;
  error?: string;
  showEmailExistsModal?: boolean;
  redirectTo?: string;
}

export interface SignInResult {
  success: boolean;
  error?: string;
  redirectTo?: string;
}

export interface ResetPasswordResult {
  success: boolean;
  error?: string;
  message?: string;
  showEmailNotFoundModal?: boolean;
}

// Sign up a new user
export const signUpUser = async (
  email: string,
  password: string
): Promise<SignUpResult> => {
  try {
    // Validate and sanitize inputs
    const emailValidation = validateEmail(email);
    const passwordValidation = validatePassword(password);
    
    if (!emailValidation.isValid) {
      return {
        success: false,
        error: 'Please enter a valid email address.'
      };
    }
    
    if (!passwordValidation.isValid) {
      return {
        success: false,
        error: 'Password does not meet security requirements.'
      };
    }
    
    // Use sanitized email
    const sanitizedEmail = emailValidation.sanitized;

    // Check if Supabase is configured before attempting signup
    const { isSupabaseConfigured } = await import('../supabase');
    if (!isSupabaseConfigured()) {
      return {
        success: false,
        error: 'Unable to connect to servers. Please check your internet connection and try again.'
      };
    }

    const baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : 'https://dnd-tool.thesnowpost.com';

    const { data, error } = await supabase.auth.signUp({ 
      email: sanitizedEmail, 
      password,
      options: {
        emailRedirectTo: `${baseUrl}/login/auth-redirect?action=signup-confirm`,
      }
    });

    // Give Supabase a moment to process
    await new Promise(resolve => setTimeout(resolve, 500));

    if (error) {
      // Check for email already exists error
      if (error.message.includes('User already registered') || 
          error.message.includes('already registered') || 
          error.message.includes('already been registered') ||
          error.message.includes('email address not available') ||
          error.message.includes('duplicate key value') ||
          error.code === '23505') {
        return { success: false, showEmailExistsModal: true };
      }
      
      if (error.message.includes('Password')) {
        return { 
          success: false, 
          error: 'Password does not meet requirements. Please check and try again.' 
        };
      } else {
        return { 
          success: false, 
          error: error.message || 'Account creation failed. Please try again.' 
        };
      }
    } else if (data.user) {
      // Check if this is an existing user trying to sign up again
      if (isExistingUser(data)) {
        return { success: false, showEmailExistsModal: true };
      }
      
      // No profile creation during signup - that happens in complete-profile screen
      
      // Successful signup
      return { 
        success: true, 
        redirectTo: `/login/email-confirmation?email=${encodeURIComponent(sanitizedEmail)}` 
      };
    }

    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  } catch (error) {
    logger.error('auth', 'Sign up error:', error);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
};

// Sign in an existing user
export const signInUser = async (
  email: string,
  password: string
): Promise<SignInResult> => {
  try {
    // Validate and sanitize inputs
    const emailValidation = validateEmail(email);
    
    if (!emailValidation.isValid) {
      return {
        success: false,
        error: 'Please enter a valid email address.'
      };
    }
    
    // Use sanitized email
    const sanitizedEmail = emailValidation.sanitized;

    // Check if Supabase is configured before attempting signin
    const { isSupabaseConfigured } = await import('../supabase');
    if (!isSupabaseConfigured()) {
      return {
        success: false,
        error: 'Unable to connect to servers. Please check your internet connection and try again.'
      };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: sanitizedEmail,
      password
    });

    if (error) {
      if (error.message.includes('Invalid login credentials') || 
          error.message.includes('invalid credentials') ||
          error.message.includes('Email not confirmed')) {
        return { 
          success: false, 
          error: 'Invalid email or password. Please check your credentials and try again.' 
        };
      }
      
      return { 
        success: false, 
        error: error.message || 'Sign in failed. Please try again.' 
      };
    }

    if (data.user) {
      // Set local auth state so route guards work immediately
      const { AuthStateManager } = await import('../auth-state');
      await AuthStateManager.setHasAccount(true);

      // Check if user has a complete profile
      try {
        const userProfile = await usersDB.getCurrentUser();
        // Robust profile validation
        const hasValidProfile = userProfile && 
                               userProfile.username && 
                               userProfile.username.trim().length > 0;
        
        // Check for pending invites
        const pendingInvite = checkPendingInvites();
        
        if (hasValidProfile) {
          // Profile is complete
          if (pendingInvite) {
            // Has pending invite - redirect to auth-redirect to process it
            if (typeof window !== 'undefined') {
              localStorage.removeItem('pending_world_invite'); // Clean up
            }
            return { 
              success: true, 
              redirectTo: `/login/auth-redirect?action=world-invite&token=${pendingInvite.token}&worldName=${encodeURIComponent(pendingInvite.worldName)}` 
            };
          } else {
            // No pending invite - go to world selection
            return { 
              success: true, 
              redirectTo: '/select/world-selection' 
            };
          }
        } else {
          // Profile needs completion
          return { 
            success: true, 
            redirectTo: '/login/complete-profile' 
          };
        }
      } catch (profileError) {
        logger.error('auth', 'Database error during sign-in profile check:', profileError);
        // If database is unreachable, let user proceed to main app
        // They can complete profile when database is available
        // This prevents infinite redirect loops during database outages
        return { 
          success: true, 
          redirectTo: '/select/world-selection' 
        };
      }
    }

    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  } catch (error) {
    logger.error('auth', 'Sign in error:', error);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
};

// Check if email already exists error
export const isEmailExistsError = (error: any): boolean => {
  return error?.message?.includes('User already registered') || 
         error?.message?.includes('already registered') || 
         error?.message?.includes('already been registered') ||
         error?.message?.includes('email address not available') ||
         error?.message?.includes('duplicate key value') ||
         error?.code === '23505';
};

// Send password reset email
export const sendPasswordReset = async (email: string): Promise<ResetPasswordResult> => {
  try {
    // Validate and sanitize input
    const emailValidation = validateEmail(email);
    
    if (!emailValidation.isValid) {
      return {
        success: false,
        error: 'Please enter a valid email address.'
      };
    }
    
    // Use sanitized email
    const sanitizedEmail = emailValidation.sanitized;

    // Check if Supabase is configured before attempting password reset
    const { isSupabaseConfigured } = await import('../supabase');
    if (!isSupabaseConfigured()) {
      return {
        success: false,
        error: 'Unable to connect to servers. Please check your internet connection and try again.'
      };
    }

    // First, check if email exists by attempting to get user info
    // We'll use a sign-in attempt with a dummy password to check if email exists
    // This is a common pattern for checking email existence without exposing user data
    const { error: checkError } = await supabase.auth.signInWithPassword({
      email: sanitizedEmail,
      password: 'dummy_password_for_check_only'
    });
    
    // If we get "Invalid login credentials", it means the email exists but password is wrong
    // If we get "User not found" or similar, the email doesn't exist
    if (checkError) {
      if (checkError.message.includes('User not found') || 
          checkError.message.includes('not found') ||
          checkError.message.includes('Invalid email')) {
        return { 
          success: false, 
          showEmailNotFoundModal: true 
        };
      }
      // If we get "Invalid login credentials", the email exists, proceed with reset
    }

    // Email exists, proceed with password reset
    const baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : 'https://dnd-tool.thesnowpost.com';
    const { error } = await supabase.auth.resetPasswordForEmail(sanitizedEmail, {
      redirectTo: `${baseUrl}/login/auth-redirect?action=reset-password`
    });

    if (error) {
      // Handle specific error cases
      if (error.message.includes('Invalid email') || 
          error.message.includes('not valid') ||
          error.message.includes('invalid email format')) {
        return { 
          success: false, 
          error: 'Please enter a valid email address.' 
        };
      }
      
      return { 
        success: false, 
        error: error.message || 'Failed to send reset email. Please try again.' 
      };
    }

    return { 
      success: true, 
      message: 'Password reset email sent! Please check your inbox and follow the instructions.' 
    };
  } catch (error) {
    logger.error('auth', 'Password reset error:', error);
    return { 
      success: false, 
      error: 'An unexpected error occurred. Please try again.' 
    };
  }
};

// Update password after reset (called from reset confirmation page)
export const updatePassword = async (newPassword: string): Promise<ResetPasswordResult> => {
  try {
    // Check if Supabase is configured before attempting password update
    const { isSupabaseConfigured } = await import('../supabase');
    if (!isSupabaseConfigured()) {
      return {
        success: false,
        error: 'Unable to connect to servers. Please check your internet connection and try again.'
      };
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      if (error.message.includes('Password')) {
        return { 
          success: false, 
          error: 'Password does not meet requirements. Please ensure it is at least 6 characters long.' 
        };
      }
      
      return { 
        success: false, 
        error: error.message || 'Failed to update password. Please try again.' 
      };
    }

    return { 
      success: true, 
      message: 'Password updated successfully! You can now sign in with your new password.' 
    };
  } catch (error) {
    logger.error('auth', 'Password update error:', error);
    return { 
      success: false, 
      error: 'An unexpected error occurred. Please try again.' 
    };
  }
};

// Generate world invite link with Supabase-generated token
export const generateWorldInviteLink = async (
  worldId: string, 
  worldName: string,
  hoursValid = 24
): Promise<{ success: boolean; inviteLink?: string; error?: string }> => {
  try {
    if (!worldId || !worldName) {
      return {
        success: false,
        error: 'World ID and name are required'
      };
    }

    // Import invitesDB here to avoid circular dependencies
    const { invitesDB } = await import('../database/invites');
    
    // Create invite link in database with Supabase-generated token
    const result = await invitesDB.createInviteLink({ 
      worldId, 
      hoursValid 
    });

    if (!result.success || !result.inviteLink) {
      return {
        success: false,
        error: result.error || 'Failed to create invite link'
      };
    }

    // Build the full invite URL using the token
    const baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : 'https://dnd-tool.thesnowpost.com';
    
    const inviteLink = `${baseUrl}/login/auth-redirect?action=world-invite&token=${result.inviteLink.token}&worldName=${encodeURIComponent(worldName)}`;

    // Try to copy to clipboard
    if (typeof window !== 'undefined' && window.navigator?.clipboard) {
      try {
        await window.navigator.clipboard.writeText(inviteLink);
        logger.debug('auth', 'Invite link copied to clipboard!');
      } catch {
        logger.debug('auth', 'Could not copy to clipboard automatically');
      }
    }

    logger.info('auth', 'World Invite Link Generated:', {
      world: worldName,
      token: result.inviteLink.token,
      expires: result.inviteLink.expires_at,
      link: inviteLink
    });
    
    return { 
      success: true,
      inviteLink 
    };

  } catch (error) {
    logger.error('auth', 'Failed to generate invite link:', error);
    return {
      success: false,
      error: 'Failed to generate invite link'
    };
  }
};

// Helper function to check for pending invites
export const checkPendingInvites = (): { token: string; worldName: string } | null => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('pending_world_invite');
    if (stored) {
      try {
        const inviteData = JSON.parse(stored);
        // Check if invite is less than 24 hours old
        if (Date.now() - inviteData.timestamp < 24 * 60 * 60 * 1000) {
          return { token: inviteData.token, worldName: inviteData.worldName };
        } else {
          // Clean up expired invite
          localStorage.removeItem('pending_world_invite');
        }
      } catch (error) {
        logger.error('auth', 'Error parsing pending invite:', error);
        localStorage.removeItem('pending_world_invite');
      }
    }
  }
  return null;
};
