import { usersDB } from '../database/users';
import { supabase } from '../supabase';
import { isExistingUser } from './validation';

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

// Sign up a new user
export const signUpUser = async (
  email: string,
  password: string
): Promise<SignUpResult> => {
  try {
    const { data, error } = await supabase.auth.signUp({ 
      email, 
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
        redirectTo: `/login/email-confirmation?email=${encodeURIComponent(email)}` 
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
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
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