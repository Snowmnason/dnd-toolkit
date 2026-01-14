import { RequestManager } from '../api/request-manager';
import { logger } from '../utils/logger';
import { QueryCache } from '../cache';
import { executeParallelQueries, getCurrentUserProfile, validateUserForWrite } from './common';
import { supabase } from './supabase';

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
    // IMPORTANT: Always validate user before write operations
    // Prevents orphaned data if account is suspended/deleted between check and write
    const currentUser = await validateUserForWrite();
    
    logger.category('storage').debug('Creating world', {
      ownerId: currentUser.id,
      worldName: worldData.name,
      system: worldData.system,
      isDm: worldData.is_dm
    });

    // Store profile ID as owner_id (proper FK relationship)
    const insertData = {
      ...worldData,
      owner_id: currentUser.id
    };

    const { data, error } = await supabase
      .from('worlds')
      .insert(insertData)
      .select()
      .single();
    
    if (error) {
      logger.category('storage').error('Failed to create world', {
        ownerId: currentUser.id,
        worldName: worldData.name,
        error: error.message,
        code: error.code
      });
      throw new Error(error.message || 'Failed to create world');
    }
    
    logger.category('storage').info('World created successfully', {
      worldId: data.world_id,
      ownerId: currentUser.id,
      name: data.name
    });

    // Invalidate world lists cache
    await QueryCache.invalidateByTags(['worlds', `user:${currentUser.id}`]);
    
    return data;
  },

  // Get all worlds for current user (both owned and member of)
  async getMyWorlds(userId?: string): Promise<WorldWithAccess[]> {
    // Handle case where user is not authenticated (e.g., during logout)
    let currentUserId = userId;
    if (!currentUserId) {
      // Use getCurrentUserProfile to handle logout gracefully
      const currentUser = await getCurrentUserProfile();
      if (!currentUser) {
        return []; // Return empty array if not authenticated (graceful during logout)
      }
      currentUserId = currentUser.id;
    }

    // STEP 1: Get world IDs from both world_access and owned worlds in parallel
    // Uses indexes: idx_world_access_user_id, idx_worlds_owner_id
    const [accessRecordsResult, ownedWorldIdsResult] = await executeParallelQueries<
      [
        { data: any[] | null; error: any },
        { data: any[] | null; error: any }
      ]
    >(
      // Get world_access records where user_id matches (includes world_id and role)
      supabase
        .from('world_access')
        .select('world_id, user_role, permissions')
        .eq('user_id', currentUserId),
      
      // Get world IDs where owner_id matches
      supabase
        .from('worlds')
        .select('world_id')
        .eq('owner_id', currentUserId)
    );

    if (accessRecordsResult.error) {
      logger.error('storage', 'Error fetching access records:', accessRecordsResult.error);
      throw new Error(accessRecordsResult.error.message || 'Failed to fetch access records');
    }

    if (ownedWorldIdsResult.error) {
      logger.error('storage', 'Error fetching owned world IDs:', ownedWorldIdsResult.error);
      throw new Error(ownedWorldIdsResult.error.message || 'Failed to fetch owned world IDs');
    }

    // STEP 2: Collect all unique world IDs and build role mapping
    const worldIdSet = new Set<string>();
    const roleMap = new Map<string, { role: UserRole; permissions: any }>();

    // Add world IDs from world_access (user is a member/dm)
    (accessRecordsResult.data || []).forEach((access: any) => {
      worldIdSet.add(access.world_id);
      roleMap.set(access.world_id, {
        role: access.user_role,
        permissions: access.permissions || {}
      });
    });

    // Add world IDs from owned worlds (user is owner) - owner takes precedence
    (ownedWorldIdsResult.data || []).forEach((world: any) => {
      worldIdSet.add(world.world_id);
      roleMap.set(world.world_id, {
        role: 'owner',
        permissions: {}
      });
    });

    // DEBUGGING: Uncomment to see collected IDs
    logger.debug('storage', 'Unique world IDs:', worldIdSet.size);
    logger.debug('storage', 'World IDs:', Array.from(worldIdSet));

    // STEP 3: Early return if no worlds found
    if (worldIdSet.size === 0) {
      // DEBUGGING: Uncomment to trace empty results
      logger.info('storage', 'No worlds found for user');
      return [];
    }

    // STEP 4: Fetch all worlds in ONE query using the collected IDs
    const worldIds = Array.from(worldIdSet);
    const { data: worldsData, error: worldsError } = await supabase
      .from('worlds')
      .select('*')
      .in('world_id', worldIds)
      .order('created_at', { ascending: false });

    if (worldsError) {
      logger.error('storage', 'Error fetching worlds:', worldsError);
      throw new Error(worldsError.message || 'Failed to fetch worlds');
    }

    // DEBUGGING: Uncomment to see fetched worlds count
    logger.debug('storage', 'Worlds fetched:', worldsData?.length || 0);

    // STEP 5: Map worlds with their roles
    const allWorlds: WorldWithAccess[] = (worldsData || []).map((world: World) => {
      const roleInfo = roleMap.get(world.world_id);
      
      // DEBUGGING: Uncomment to trace each world
      logger.debug('storage', `Adding world: ${world.name} (role: ${roleInfo?.role})`);
      
      return {
        ...world,
        user_role: roleInfo?.role || 'player',
        world_access: roleInfo?.role !== 'owner' ? {
          id: '',
          world_id: world.world_id,
          user_id: currentUserId,
          user_role: roleInfo?.role as AccessRole,
          permissions: roleInfo?.permissions || {},
          created_at: world.created_at
        } : undefined
      };
    });

    // DEBUGGING: Uncomment to see final count
    logger.debug('storage', `Total worlds returned: ${allWorlds.length}`);
    
    return allWorlds;
  },

    // Update a world name (only owner)
  async updateName(worldId: string, newName: string): Promise<World> {
    // Validate before write
    const user = await validateUserForWrite();
    
    const { data, error } = await supabase
      .from('worlds')
      .update({name: newName, updated_at: 'now()'})
      .eq('world_id', worldId)
      .eq('owner_id', user.id)
      .select()
      .single();
    
    if (error) {
      logger.error('storage', 'Error updating world:', error);
      throw new Error(error.message || 'Failed to update world');
    }

    // Invalidate specific world and lists cache
    await QueryCache.invalidate(`world:${worldId}:*`);
    await QueryCache.invalidateByTags(['worlds']);
    
    return data;
  },

  // Update a world
  async update(worldId: string, updates: Partial<CreateWorldData>): Promise<World> {
    // Validate before write
    await validateUserForWrite();
    
    const { data, error } = await supabase
      .from('worlds')
      .update({
        ...updates,
        updated_at: 'now()'
      })
      .eq('world_id', worldId)
      .select()
      .single();
    
    if (error) {
      logger.error('storage', 'Error updating world:', error);
      throw new Error(error.message || 'Failed to update world');
    }

    // Invalidate specific world and lists cache
    await QueryCache.invalidate(`world:${worldId}:*`);
    await QueryCache.invalidateByTags(['worlds']);
    
    return data;
  },

  // Delete a world
  async delete(worldId: string): Promise<void> {
    // Validate before write
    const user = await validateUserForWrite();
    
    const { error } = await supabase
      .from('worlds')
      .delete()
      .eq('world_id', worldId)
      .eq('owner_id', user.id); // Ensure only owner can delete
    
    if (error) {
      logger.error('storage', 'Error deleting world:', error);
      throw new Error(error.message || 'Failed to delete world');
    }

    // Invalidate specific world and lists cache
    await QueryCache.invalidate(`world:${worldId}:*`);
    await QueryCache.invalidateByTags(['worlds']);
  },

    // Remove user from world
  async removeUserFromWorld(worldId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('world_access')
      .delete()
      .eq('world_id', worldId)
      .eq('user_id', userId);

    if (error) {
      logger.error('storage', 'Error removing user from world:', error);
      throw new Error(error.message || 'Failed to remove user from world');
    }

    // Invalidate world members and user's worlds cache
    await QueryCache.invalidate(`world:${worldId}:members`);
    await QueryCache.invalidate(`user:${userId}:worlds`);
    await QueryCache.invalidateByTags(['worlds']);
  },

  // Check if user is already in a world (either as owner or member)
  // Uses RequestManager for deduplication and retry
  async isUserInWorld(worldId: string, userId: string): Promise<boolean> {
    const result = await RequestManager.fetch(
      `world:access:${worldId}:${userId}`,
      async () => {
        // Combine both checks into parallel queries for efficiency
        const [worldResult, accessResult] = await executeParallelQueries<
          [
            { data: any | null; error: any },
            { data: any | null; error: any }
          ]
        >(
          supabase
            .from('worlds')
            .select('owner_id')
            .eq('world_id', worldId)
            .eq('owner_id', userId)
            .maybeSingle(),
          
          supabase
            .from('world_access')
            .select('id')
            .eq('world_id', worldId)
            .eq('user_id', userId)
            .maybeSingle()
        );

        return !!worldResult.data || !!accessResult.data;
      },
      {
        dedupe: true,
        retries: 2,
        timeout: 10000
      }
    );
    
    // If RequestManager returns null (failOpen flag), default to false for safety
    return result ?? false;
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
      logger.error('storage', 'Error adding user to world:', error);
      throw new Error(error.message || 'Failed to add user to world');
    }

    return data;
  },

  // Get all members of a world
  // Uses RequestManager for deduplication and retry
  // Note: Returns null if RequestManager fails with failOpen enabled
  async getWorldMembers(worldId: string): Promise<(WorldAccess & { user: any })[] | null> {
    return RequestManager.fetch(
      `world:members:${worldId}`,
      async () => {
        const { data, error } = await supabase
          .from('world_access')
          .select(`
            *,
            users(id, username)
          `)
          .eq('world_id', worldId)
          .order('created_at', { ascending: false });

        if (error) {
          logger.error('storage', 'Error fetching world members:', error);
          throw new Error(error.message || 'Failed to fetch world members');
        }

        return data || [];
      },
      {
        dedupe: true,
        retries: 2,
        timeout: 15000
      }
    );
  },

  /**
   * Get a specific world by ID
   * Uses RequestManager for deduplication and retry
   * 
   * Returns null only when world is not found (error code PGRST116).
   * Throws error on database failures or request failures.
   * 
   * @param worldId - The unique identifier of the world
   * @returns The world data or null if not found
   * @throws Error if database query fails or RequestManager encounters an error
   */
  async getById(worldId: string): Promise<World | null> {
    return RequestManager.fetch(
      `world:detail:${worldId}`,
      async () => {
        const { data, error } = await supabase
          .from('worlds')
          .select('*')
          .eq('world_id', worldId)
          .single();
        
        if (error) {
          if (error.code === 'PGRST116') {
            // No rows returned
            return null;
          }
          logger.error('storage', 'Error fetching world:', error);
          throw new Error(error.message || 'Failed to fetch world');
        }
        
        return data;
      },
      {
        dedupe: true,
        retries: 3,
        timeout: 15000
      }
    );
  },
};
