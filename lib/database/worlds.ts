import { supabase } from '../supabase';

export interface World {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  system: string;
  is_dm: boolean;
  map_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateWorldData {
  name: string;
  description: string;
  system: string;
  is_dm: boolean;
  map_image_url?: string;
}

export const worldsDB = {
  // Create a new world
  async create(worldData: CreateWorldData): Promise<World> {
    const { data, error } = await supabase
      .from('worlds')
      .insert(worldData)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating world:', error);
      throw new Error(error.message || 'Failed to create world');
    }
    
    return data;
  },

  // Get all worlds for current user (both owned and member of)
  async getMyWorlds(): Promise<World[]> {
    const { data, error } = await supabase
      .from('worlds')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching worlds:', error);
      throw new Error(error.message || 'Failed to fetch worlds');
    }
    
    return data || [];
  },

  // Get a specific world by ID
  async getById(worldId: string): Promise<World | null> {
    const { data, error } = await supabase
      .from('worlds')
      .select('*')
      .eq('id', worldId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      console.error('Error fetching world:', error);
      throw new Error(error.message || 'Failed to fetch world');
    }
    
    return data;
  },

  // Update a world
  async update(worldId: string, updates: Partial<CreateWorldData>): Promise<World> {
    const { data, error } = await supabase
      .from('worlds')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', worldId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating world:', error);
      throw new Error(error.message || 'Failed to update world');
    }
    
    return data;
  },

  // Delete a world
  async delete(worldId: string): Promise<void> {
    const { error } = await supabase
      .from('worlds')
      .delete()
      .eq('id', worldId);
    
    if (error) {
      console.error('Error deleting world:', error);
      throw new Error(error.message || 'Failed to delete world');
    }
  }
};