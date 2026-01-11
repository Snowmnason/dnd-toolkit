import type { AuthResponse, AuthTokenResponse } from '@supabase/supabase-js';

import { RequestManager } from '../api/request-manager';
import { supabase } from '../database/supabase';
import { usersDB } from '../database/users';
import { SecureStorage, STORAGE_KEYS } from '../storage';
import { logger } from '../utils/logger';
import { checkAuthGuard, recordAuthFailure, recordAuthSuccess } from './auth-attempt-guard';
import { isExistingUser, validateEmail, validatePassword } from './validation';

export interface SignUpResult {
  success: boolean;
  error?: string;
  validationWarning?: string; // When client validation passed but server validation failed
  showEmailExistsModal?: boolean;
  redirectTo?: string;
}

export interface SignInResult {
  success: boolean;
  error?: string;
  validationWarning?: string; // When client validation passed but server validation failed
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
    const { isSupabaseConfigured } = await import('../database/supabase');
    if (!isSupabaseConfigured()) {
      return {
        success: false,
        error: 'Unable to connect to servers. Please check your internet connection and try again.'
      };
    }

    const guard = await checkAuthGuard(sanitizedEmail, 'signup');
    if (!guard.allowed) {
      const retrySeconds = guard.retryAfterMs ? Math.ceil(guard.retryAfterMs / 1000) : undefined;
      return {
        success: false,
        error: retrySeconds
          ? `Too many sign up attempts. Try again in ${retrySeconds} seconds.`
          : 'Too many sign up attempts. Please wait before trying again.'
      };
    }

    const baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : 'https://dnd-tool.thesnowpost.com';

    const signupResponse = await RequestManager.fetch<AuthResponse>(
      `auth:signup:${sanitizedEmail}`,
      () =>
        supabase.auth.signUp({ 
          email: sanitizedEmail, 
          password,
          options: {
            emailRedirectTo: `${baseUrl}/login/auth-redirect?action=signup-confirm`,
          }
        }),
      {
        rateLimitKey: `auth:signup:${sanitizedEmail}`,
        retries: 1,
        timeout: 10000,
      }
    );

    const signupError = signupResponse?.error ?? null;
    const signupData = signupResponse?.data;

    // Give Supabase a moment to process
    await new Promise(resolve => setTimeout(resolve, 500));

    if (signupError) {
      await recordAuthFailure(sanitizedEmail, 'signup');
      // Check for email already exists error
      if (signupError.message.includes('User already registered') || 
          signupError.message.includes('already registered') || 
          signupError.message.includes('already been registered') ||
          signupError.message.includes('email address not available') ||
          signupError.message.includes('duplicate key value') ||
          signupError.code === '23505') {
        return { success: false, showEmailExistsModal: true };
      }
      
      if (signupError.message.includes('Password')) {
        return { 
          success: false, 
          error: 'Password does not meet requirements. Please check and try again.' 
        };
      } else {
        return { 
          success: false, 
          error: signupError.message || 'Account creation failed. Please try again.' 
        };
      }
    } else if (signupData?.user) {
      await recordAuthSuccess(sanitizedEmail, 'signup');
      // Check if this is an existing user trying to sign up again
      if (isExistingUser(signupData)) {
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
    const message = (error as Error)?.message?.includes('Request timeout')
      ? 'The server took too long to respond. Please try again.'
      : 'An unexpected error occurred. Please try again.';
    return { success: false, error: message };
  }
};

// Sign in an existing user
export const signInUser = async (
  email: string,
  password: string
): Promise<SignInResult> => {
  logger.debug('auth', `🔐 Sign-in attempt for email: ${email}`);
  
  try {
    // Validate and sanitize inputs
    const emailValidation = validateEmail(email);
    
    if (!emailValidation.isValid) {
      logger.warn('auth', '❌ Invalid email format');
      return {
        success: false,
        error: 'Please enter a valid email address.'
      };
    }
    
    // Use sanitized email
    const sanitizedEmail = emailValidation.sanitized;
    logger.debug('auth', `✅ Email validated: ${sanitizedEmail}`);

    // Check if Supabase is configured before attempting signin
    const { isSupabaseConfigured } = await import('../database/supabase');
    if (!isSupabaseConfigured()) {
      logger.error('auth', '❌ Supabase not configured');
      return {
        success: false,
        error: 'Unable to connect to servers. Please check your internet connection and try again.'
      };
    }
    
    logger.debug('auth', '✅ Supabase configured, proceeding with sign-in');

    const guard = await checkAuthGuard(sanitizedEmail, 'signin');
    if (!guard.allowed) {
      const retrySeconds = guard.retryAfterMs ? Math.ceil(guard.retryAfterMs / 1000) : undefined;
      logger.warn('auth', `🚫 Auth guard blocked sign-in for ${sanitizedEmail}`);
      return {
        success: false,
        error: retrySeconds
          ? `Too many login attempts. Try again in ${retrySeconds} seconds.`
          : 'Too many login attempts. Please wait before trying again.'
      };
    }

    logger.debug('auth', `🔐 Calling Supabase signInWithPassword for ${sanitizedEmail}...`);
    const signInStartTime = Date.now();
    
    const signInResponse = await RequestManager.fetch<AuthTokenResponse>(
      `auth:signin:${sanitizedEmail}`,
      () => supabase.auth.signInWithPassword({
        email: sanitizedEmail,
        password
      }),
      {
        rateLimitKey: `auth:signin:${sanitizedEmail}`,
        retries: 1,
        timeout: 10000,
      }
    );

    const signInElapsed = Date.now() - signInStartTime;
    logger.debug('auth', `⏱️ Sign-in API call completed in ${signInElapsed}ms`);

    const signInError = signInResponse?.error ?? null;
    const signInData = signInResponse?.data;

    if (signInError) {
      await recordAuthFailure(sanitizedEmail, 'signin');
      logger.error('auth', `❌ Sign-in error:`, signInError.message);
      if (signInError.message.includes('Invalid login credentials') || 
          signInError.message.includes('invalid credentials') ||
          signInError.message.includes('Email not confirmed')) {
        return { 
          success: false, 
          error: 'Invalid email or password. Please check your credentials and try again.' 
        };
      }
      
      return { 
        success: false, 
        error: signInError.message || 'Sign in failed. Please try again.' 
      };
    }

    if (signInData?.user) {
      await recordAuthSuccess(sanitizedEmail, 'signin');
      logger.info('auth', `✅ Sign-in successful for ${sanitizedEmail}, setting auth state...`);
      
      // Set local auth state so route guards work immediately
      const { AuthStateManager } = await import('../auth-state');
      await AuthStateManager.setHasAccount(true);
      logger.debug('auth', '✅ Auth state set, checking user profile...');

      // Check if user has a complete profile
      try {
        const profileStartTime = Date.now();
        const userProfile = await usersDB.getCurrentUser();
        const profileElapsed = Date.now() - profileStartTime;
        logger.debug('auth', `⏱️ User profile fetch completed in ${profileElapsed}ms`);
        
        // Robust profile validation
        const hasValidProfile = userProfile && 
                               userProfile.username && 
                               userProfile.username.trim().length > 0;
        
        logger.debug('auth', `Profile validation: hasValidProfile=${hasValidProfile}`);
        
        // Check for pending invites
        const pendingInvite = await checkPendingInvites();
        logger.debug('auth', `Pending invite check: ${pendingInvite ? 'found' : 'none'}`);
        
        if (hasValidProfile) {
          // Profile is complete
          if (pendingInvite) {
            // Has pending invite - redirect to auth-redirect to process it
            logger.info('auth', `🎫 Redirecting to auth-redirect for pending invite`);
            if (typeof window !== 'undefined') {
              await SecureStorage.removeItem(STORAGE_KEYS.PENDING_INVITE); // Clean up
            }
            return { 
              success: true, 
              redirectTo: `/login/auth-redirect?action=world-invite&token=${pendingInvite.token}&worldName=${encodeURIComponent(pendingInvite.worldName)}` 
            };
          } else {
            // No pending invite - go to world selection
            logger.info('auth', `🌍 Redirecting to world selection`);
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
    const message = (error as Error)?.message?.includes('Request timeout')
      ? 'The server took too long to respond. Please try again.'
      : 'An unexpected error occurred. Please try again.';
    return { success: false, error: message };
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
    const { isSupabaseConfigured } = await import('../database/supabase');
    if (!isSupabaseConfigured()) {
      return {
        success: false,
        error: 'Unable to connect to servers. Please check your internet connection and try again.'
      };
    }

    const guard = await checkAuthGuard(sanitizedEmail, 'reset');
    if (!guard.allowed) {
      const retrySeconds = guard.retryAfterMs ? Math.ceil(guard.retryAfterMs / 1000) : undefined;
      return {
        success: false,
        error: retrySeconds
          ? `Too many reset attempts. Try again in ${retrySeconds} seconds.`
          : 'Too many reset attempts. Please wait before trying again.'
      };
    }

    // Proceed with password reset; backend will send email only if account exists.
    const baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : 'https://dnd-tool.thesnowpost.com';
    const resetResponse = await RequestManager.fetch<AuthResponse>(
      `auth:reset:${sanitizedEmail}`,
      () =>
        supabase.auth.resetPasswordForEmail(sanitizedEmail, {
          redirectTo: `${baseUrl}/login/auth-redirect?action=reset-password`
        }),
      {
        rateLimitKey: `auth:reset:${sanitizedEmail}`,
        retries: 1,
        timeout: 10000,
      }
    );

    const resetError = resetResponse?.error ?? null;

    if (resetError) {
      // Log full error details for debugging (helps identify network failures, config issues, rate limiting, etc.)
      // But return generic message to user to prevent email enumeration
      logger.error('auth', 'Password reset API error (full details for debugging):', {
        message: resetError.message,
        code: resetError.code,
        status: (resetError as any)?.status,
        details: resetError,
      });
      return { 
        success: true, 
        message: 'If that email exists, a reset link has been sent. Please check your inbox.' 
      };
    }

    await recordAuthSuccess(sanitizedEmail, 'reset');

    return { 
      success: true, 
      message: 'If that email exists, a reset link has been sent. Please check your inbox.' 
    };
  } catch (error) {
    logger.error('auth', 'Password reset error:', error);
    const message = (error as Error)?.message?.includes('Request timeout')
      ? 'The server took too long to respond. Please try again.'
      : 'An unexpected error occurred. Please try again.';
    return { success: false, error: message };
  }
};

// Update password after reset (called from reset confirmation page)
export const updatePassword = async (newPassword: string): Promise<ResetPasswordResult> => {
  try {
    // Check if Supabase is configured before attempting password update
    const { isSupabaseConfigured } = await import('../database/supabase');
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
export const checkPendingInvites = async (): Promise<{ token: string; worldName: string } | null> => {
  if (typeof window !== 'undefined') {
    const stored = await SecureStorage.getItem(STORAGE_KEYS.PENDING_INVITE);
    if (stored) {
      try {
        const inviteData = JSON.parse(stored);
        // Check if invite is less than 24 hours old
        if (Date.now() - inviteData.timestamp < 24 * 60 * 60 * 1000) {
          return { token: inviteData.token, worldName: inviteData.worldName };
        } else {
          // Clean up expired invite
          await SecureStorage.removeItem(STORAGE_KEYS.PENDING_INVITE);
        }
      } catch (error) {
        logger.error('auth', 'Error parsing pending invite:', error);
        await SecureStorage.removeItem(STORAGE_KEYS.PENDING_INVITE);
      }
    }
  }
  return null;
};
