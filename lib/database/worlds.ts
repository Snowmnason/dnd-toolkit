import { supabase } from '../supabase';

// User role types for better type safety and maintainability
export type UserRole = 'owner' | 'dm' | 'player';
export type AccessRole = 'dm' | 'player'; // Roles that can be assigned via world_access table

export interface World {
  world_id: string;
  owner_id: string;
  name: string;
  description: string | null;
  system: string;
  is_dm: boolean;
  map_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorldAccess {
  id: string;
  world_id: string;
  user_id: string;
  user_role: AccessRole; // Using the AccessRole type for better type safety
  permissions: any; // JSONB field
  created_at: string;
}

export interface WorldWithAccess extends World {
  world_access?: WorldAccess;
  user_role: UserRole; // Using the UserRole type for complete role coverage
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
    // Get current user's auth ID for lookup
    const { data: { user } } = await supabase.auth.getUser();
    console.log('Auth user:', user); // DEBUG
    if (!user) throw new Error('Not authenticated');

    // Get the user's profile ID (this is what owner_id should reference)
    const { data: currentUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!currentUser) throw new Error('User profile not found');

    // Store profile ID as owner_id (proper FK relationship)
    const insertData = {
      ...worldData,
      owner_id: currentUser.id // This is the profile ID: 797cefa7-6640-40a7-ba7a-91eee369faa3
    };
    console.log('Insert data:', insertData); // DEBUG

    const { data, error } = await supabase
      .from('worlds')
      .insert(insertData)
      .select()
      .single();
    
    console.log('Insert result:', { data, error }); // DEBUG
    
    if (error) {
      console.error('Error creating world:', error);
      throw new Error(error.message || 'Failed to create world');
    }
    
    return data;
  },

  // Get all worlds for current user (both owned and member of)
  async getMyWorlds(userId?: string): Promise<WorldWithAccess[]> {
    let currentUserId: string;
    
    if (userId) {
      // Use provided userId for optimization
      currentUserId = userId;
    } else {
      // Fall back to getting current user from auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: currentUser } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single();

      if (!currentUser) throw new Error('User profile not found');
      currentUserId = currentUser.id;
    }

    // OPTIMIZED: Get both owned worlds and accessible worlds in parallel
    const [ownedWorldsResult, accessWorldsResult] = await Promise.all([
      // Get owned worlds (uses idx_worlds_owner_id index) - owner_id stores profile ID
      supabase
        .from('worlds')
        .select('*')
        .eq('owner_id', currentUserId)
        .order('created_at', { ascending: false }),
      
      // Get worlds where user has access (uses idx_world_access_user_id + idx_world_access_user_created index)
      supabase
        .from('world_access')
        .select(`
          *,
          worlds(*)
        `)
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false })
    ]);

    // Handle errors from parallel queries
    if (ownedWorldsResult.error) {
      console.error('Error fetching owned worlds:', ownedWorldsResult.error);
      throw new Error(ownedWorldsResult.error.message || 'Failed to fetch owned worlds');
    }

    if (accessWorldsResult.error) {
      console.error('Error fetching accessible worlds:', accessWorldsResult.error);
      throw new Error(accessWorldsResult.error.message || 'Failed to fetch accessible worlds');
    }

    // Combine and format results
    const allWorlds: WorldWithAccess[] = [];

    // Add owned worlds
    (ownedWorldsResult.data || []).forEach((world: World) => {
      allWorlds.push({
        ...world,
        user_role: 'owner'
      });
    });

    // Add accessible worlds (where user is not owner)
    (accessWorldsResult.data || []).forEach((access: any) => {
      if (access.worlds && access.worlds.owner_id !== currentUserId) {
        allWorlds.push({
          ...access.worlds,
          world_access: access,
          user_role: access.user_role // Direct assignment since it's already the correct type
        });
      }
    });

    // Sort by created_at (most recent first) - much faster now with pre-sorted data from database
    allWorlds.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return allWorlds;
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
  },

  // Get only worlds I own
  async getOwnedWorlds(): Promise<World[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get user profile ID
    const { data: currentUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!currentUser) throw new Error('User profile not found');

    // owner_id stores profile ID
    const { data, error } = await supabase
      .from('worlds')
      .select('*')
      .eq('owner_id', currentUser.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching owned worlds:', error);
      throw new Error(error.message || 'Failed to fetch owned worlds');
    }
    
    return data || [];
  },

  // Get only worlds I'm a member of (not owner)
  async getMemberWorlds(): Promise<WorldWithAccess[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: currentUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!currentUser) throw new Error('User profile not found');

    const { data, error } = await supabase
      .from('world_access')
      .select(`
        *,
        worlds(*)
      `)
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching member worlds:', error);
      throw new Error(error.message || 'Failed to fetch member worlds');
    }

    return (data || []).map((access: any) => ({
      ...access.worlds,
      world_access: access,
      user_role: access.user_role // Direct assignment since it's already the correct type
    })) as WorldWithAccess[];
  },

  // Add user to world (invite/join)
  async addUserToWorld(worldId: string, userId: string, userRole: AccessRole = 'player', permissions: any = {}): Promise<WorldAccess> {
    const { data, error } = await supabase
      .from('world_access')
      .insert({
        world_id: worldId,
        user_id: userId,
        user_role: userRole,
        permissions
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding user to world:', error);
      throw new Error(error.message || 'Failed to add user to world');
    }

    return data;
  },

  // Remove user from world
  async removeUserFromWorld(worldId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('world_access')
      .delete()
      .eq('world_id', worldId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error removing user from world:', error);
      throw new Error(error.message || 'Failed to remove user from world');
    }
  },

  // Get all members of a world
  async getWorldMembers(worldId: string): Promise<(WorldAccess & { user: any })[]> {
    const { data, error } = await supabase
      .from('world_access')
      .select(`
        *,
        users(id, username, display_name)
      `)
      .eq('world_id', worldId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching world members:', error);
      throw new Error(error.message || 'Failed to fetch world members');
    }

    return data || [];
  }
};