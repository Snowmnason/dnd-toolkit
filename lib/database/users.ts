import { validateUsername } from '../auth/validation';
import { logger } from '../utils/logger';
import { supabase } from './supabase';

export interface User {
  id: string;
  auth_id: string;
  username: string;
  created_at: string;
}

export interface CreateUserData {
  auth_id: string;
  username: string;
}

export interface UpdateUserData {
  username?: string;
}

export const usersDB = {
  // Create a new user profile (called after auth signup) with input validation
  async create(userData: CreateUserData): Promise<User> {
    logger.info('usersDB', 'Starting user profile creation', {
      auth_id: userData.auth_id,
      username: userData.username,
      usernameLength: userData.username?.length
    });

    // Validate and sanitize username if provided
    if (userData.username) {
      const usernameValidation = validateUsername(userData.username);
      logger.debug('usersDB', 'Username validation result:', {
        isValid: usernameValidation.isValid,
        sanitized: usernameValidation.sanitized,
        original: userData.username
      });
      
      if (!usernameValidation.isValid) {
        logger.error('usersDB', 'Username validation failed');
        throw new Error('Username contains invalid characters or format');
      }
      userData.username = usernameValidation.sanitized;
    }
    
    // Note: display_name removed from schema
    logger.debug('usersDB', 'Inserting user data into database:', userData);

    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();
    
    if (error) {
      logger.error('usersDB', 'Database error during user creation:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      throw new Error(error.message || 'Failed to create user profile');
    }
    
    logger.info('usersDB', 'User profile created successfully:', {
      id: data.id,
      auth_id: data.auth_id,
      username: data.username,
      created_at: data.created_at
    });
    
    return data;
  },

  // Create user with default values after signup (called from auth triggers or signup)
  async createWithDefaults(authId: string): Promise<User> {
    const defaultUserData: CreateUserData = {
      auth_id: authId,
      username: `user_${authId.slice(-8)}`, // Default username using last 8 chars of auth_id
    };

    return this.create(defaultUserData);
  },

  // Get current user's profile
  async getCurrentUser(): Promise<User | null> {
    logger.debug('usersDB', 'Starting getCurrentUser');
    
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    
    logger.debug('usersDB', 'Auth user fetch result:', {
      hasAuthUser: !!authUser,
      authUserId: authUser?.id,
      authError: authError?.message
    });
    
    if (authError) {
      logger.error('usersDB', 'Auth error in getCurrentUser:', authError);
      throw new Error(authError.message || 'Authentication error');
    }
    
    if (!authUser) {
      logger.debug('usersDB', 'No authenticated user found');
      return null;
    }

    logger.debug('usersDB', 'Fetching user profile from database for auth_id:', authUser.id);

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', authUser.id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // This is expected for new users who haven't created a profile yet
        logger.debug('usersDB', 'No profile exists yet for user - this is expected for new users');
        return null;
      }
      
      // Only log as error for unexpected database issues
      logger.error('usersDB', 'Unexpected database error in getCurrentUser:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        auth_id: authUser.id
      });
      
      throw new Error(error.message || 'Failed to fetch user profile');
    }
    
    logger.info('usersDB', 'User profile fetched successfully:', {
      id: data?.id,
      auth_id: data?.auth_id,
      username: data?.username,
      created_at: data?.created_at
    });
    
    return data;
  },

  // Update current user's profile with input validation
  async updateCurrentUser(updates: UpdateUserData): Promise<User> {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) {
      throw new Error('Not authenticated');
    }

    // Validate and sanitize username if being updated
    if (updates.username) {
      const usernameValidation = validateUsername(updates.username);
      if (!usernameValidation.isValid) {
        throw new Error('Username contains invalid characters or format');
      }
      updates.username = usernameValidation.sanitized;
    }
    
    // Note: display_name removed from schema

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('auth_id', authUser.id)
      .select()
      .single();
    
    if (error) {
      logger.error('users', 'Error updating user profile:', error);
      throw new Error(error.message || 'Failed to update user profile');
    }
    
    return data;
  },


  async deleteCurrentUser(): Promise<boolean> {
    // make sure we’re logged in so invoke sends a valid Authorization header
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw new Error(error.message || 'Auth check failed');
    if (!user) throw new Error('Not authenticated');

    // call your Edge Function by name (no URL needed, no body needed)
    const { data, error: fnError } = await supabase.functions.invoke('delete-account');
    if (fnError) throw new Error(fnError.message || 'Failed to delete account');
    logger.debug('users', 'Account deletion function response:', data);
    return true;
  }

};