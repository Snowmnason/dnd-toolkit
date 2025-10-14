import { validateUsername } from '../auth/validation';
import { supabase } from '../supabase';
import { logger } from '../utils/logger';

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
    // Validate and sanitize username if provided
    if (userData.username) {
      const usernameValidation = validateUsername(userData.username);
      if (!usernameValidation.isValid) {
        throw new Error('Username contains invalid characters or format');
      }
      userData.username = usernameValidation.sanitized;
    }
    
    // Note: display_name removed from schema

    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();
    
    if (error) {
      logger.error('users', 'Error creating user profile:', error);
      throw new Error(error.message || 'Failed to create user profile');
    }
    
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
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) {
      return null;
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', authUser.id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No profile exists yet
        return null;
      }
      logger.error('users', 'Error fetching current user:', error);
      throw new Error(error.message || 'Failed to fetch user profile');
    }
    
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