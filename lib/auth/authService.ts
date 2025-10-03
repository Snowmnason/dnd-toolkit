import { usersDB } from '../database/users';
import { supabase } from '../supabase';
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

    const { data, error } = await supabase.auth.signUp({ 
      email: sanitizedEmail, 
      password 
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
    console.error('Sign up error:', error);
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
        if (hasValidProfile) {
          // Profile is complete - go to world selection
          return { 
            success: true, 
            redirectTo: '/select/world-selection' 
          };
        } else {
          // Profile needs completion
          return { 
            success: true, 
            redirectTo: '/login/complete-profile' 
          };
        }
      } catch (profileError) {
        console.error('Database error during sign-in profile check:', profileError);
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
    console.error('Sign in error:', error);
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
    const { error } = await supabase.auth.resetPasswordForEmail(sanitizedEmail, {
      redirectTo: `${window.location.origin}/login/reset-password`
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
    console.error('Password reset error:', error);
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
    console.error('Password update error:', error);
    return { 
      success: false, 
      error: 'An unexpected error occurred. Please try again.' 
    };
  }
};