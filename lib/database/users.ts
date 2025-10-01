import { supabase } from '../supabase';

export interface User {
  id: string;
  auth_id: string;
  username: string;
  display_name: string | null;
  created_at: string;
}

export interface CreateUserData {
  auth_id: string;
  username: string;
  display_name?: string;
}

export interface UpdateUserData {
  username?: string;
  display_name?: string;
}

export const usersDB = {
  // Create a new user profile (called after auth signup)
  async create(userData: CreateUserData): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating user profile:', error);
      throw new Error(error.message || 'Failed to create user profile');
    }
    
    return data;
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
      console.error('Error fetching current user:', error);
      throw new Error(error.message || 'Failed to fetch user profile');
    }
    
    return data;
  },

  // Update current user's profile
  async updateCurrentUser(updates: UpdateUserData): Promise<User> {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) {
      throw new Error('Not authenticated');
    }

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('auth_id', authUser.id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating user profile:', error);
      throw new Error(error.message || 'Failed to update profile');
    }
    
    return data;
  }
};