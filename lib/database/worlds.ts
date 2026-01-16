import { RequestManager } from '../api/request-manager';
import { QueryCache } from '../cache';
import { CACHE_TAGS } from '../cache/keys';
import { logger } from '../utils/logger';
import { worldAccessCache } from '../storage/world-access-cache';
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
    return RequestManager.fetch(
      `worlds:create:${Date.now()}`,
      async () => {
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

        // Invalidate world lists cache (notify all subscribers)
        await QueryCache.invalidateByTags([
          CACHE_TAGS.worlds,
          CACHE_TAGS.user(currentUser.id)
        ]);

        // Update SecureStorage access flag for new world (owner has access)
        await worldAccessCache.updateAccessFlag(data.world_id, true, 'create');
        
        return data;
      },
      {
        dedupe: false,
        retries: 3,
        timeout: 15000,
      }
    );
  },

  // Get all worlds for current user (both owned and member of)
  // NOTE: This is a convenience wrapper around getMyWorldsPaginated() that returns all worlds
  // without pagination. Uses the same caching and optimization logic internally.
  async getMyWorlds(userId?: string): Promise<WorldWithAccess[]> {
    // Call the paginated version without pagination params to get all worlds
    // This ensures we get the caching benefits without code duplication
    const result = await this.getMyWorldsPaginated(userId);
    return result.items;
  },

  // Get paginated worlds for current user (both owned and member of)
  async getMyWorldsPaginated(
    userId?: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ items: WorldWithAccess[]; total: number }> {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    // Handle case where user is not authenticated (e.g., during logout)
    let currentUserId = userId;
    if (!currentUserId) {
      // Use getCurrentUserProfile to handle logout gracefully
      const currentUser = await getCurrentUserProfile();
      if (!currentUser) {
        return { items: [], total: 0 }; // Return empty result if not authenticated
      }
      currentUserId = currentUser.id;
    }

    // OPTIMIZATION: Try to get world IDs from cache first
    // This avoids re-fetching the same world access data for every page
    const cacheKey = `worlds:ids:${currentUserId}`;
    let worldIdSet: Set<string>;
    let roleMap: Map<string, { role: UserRole; permissions: any }>;
    
    const cachedData = await QueryCache.get<{
      worldIds: string[];
      roles: [string, { role: UserRole; permissions: any }][];
    }>(cacheKey);

    if (cachedData) {
      // Use cached world IDs and roles
      worldIdSet = new Set(cachedData.worldIds);
      roleMap = new Map(cachedData.roles);
      logger.debug('storage', `Using cached world IDs for user ${currentUserId}`, {
        count: worldIdSet.size
      });
    } else {
      // STEP 1: Get world IDs from both world_access and owned worlds in parallel
      const [accessRecordsResult, ownedWorldIdsResult] = await executeParallelQueries<[
        { data: any[] | null; error: any },
        { data: any[] | null; error: any }
      ]>(
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
      worldIdSet = new Set<string>();
      roleMap = new Map<string, { role: UserRole; permissions: any }>();

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

      // Cache the world IDs and roles (short TTL since membership can change)
      await QueryCache.set(
        cacheKey,
        {
          worldIds: Array.from(worldIdSet),
          roles: Array.from(roleMap.entries()),
        },
        {
          staleTime: 5 * 60 * 1000, // 5 minutes
          cacheTime: 15 * 60 * 1000, // 15 minutes
          tags: ['worlds', `user:${currentUserId}`],
        }
      );

      logger.debug('storage', `Cached world IDs for user ${currentUserId}`, {
        count: worldIdSet.size
      });
    }

    const totalWorlds = worldIdSet.size;

    // STEP 3: Early return if no worlds found
    if (totalWorlds === 0) {
      return { items: [], total: 0 };
    }

    // STEP 4: Fetch paginated worlds using the collected IDs
    // NOTE: We apply pagination here after collecting IDs because:
    // 1. We need to merge owner + member roles (owner takes precedence)
    // 2. SQL can't easily handle this precedence logic
    // 3. Most users have <100 worlds, so fetching all IDs is acceptable
    // 4. World IDs are now cached (5min TTL), so subsequent pages are faster
    // If your users typically have 1000+ worlds, consider a different approach:
    // - Use a database view that merges roles
    // - Or implement server-side cursor pagination
    const worldIds = Array.from(worldIdSet);
    const { data: worldsData, error: worldsError } = await supabase
      .from('worlds')
      .select('*')
      .in('world_id', worldIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (worldsError) {
      logger.error('storage', 'Error fetching paginated worlds:', worldsError);
      throw new Error(worldsError.message || 'Failed to fetch worlds');
    }

    // STEP 5: Map worlds with their roles
    const paginatedWorlds: WorldWithAccess[] = (worldsData || []).map((world: World) => {
      const roleInfo = roleMap.get(world.world_id);

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

    return {
      items: paginatedWorlds,
      total: totalWorlds
    };
  },

    // Update a world name (only owner)
  async updateName(worldId: string, newName: string): Promise<World> {
    return RequestManager.fetch(
      `worlds:updateName:${worldId}`,
      async () => {
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
        await QueryCache.invalidateByTags([
          CACHE_TAGS.worlds,
          CACHE_TAGS.world(worldId)
        ]);
        
        return data;
      },
      {
        dedupe: false,
        retries: 3,
        timeout: 15000,
      }
    );
  },

  // Update a world
  async update(worldId: string, updates: Partial<CreateWorldData>): Promise<World> {
    return RequestManager.fetch(
      `worlds:update:${worldId}`,
      async () => {
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
        await QueryCache.invalidateByTags([
          CACHE_TAGS.worlds,
          CACHE_TAGS.world(worldId)
        ]);
        
        return data;
      },
      {
        dedupe: false,
        retries: 3,
        timeout: 15000,
      }
    );
  },

  // Delete a world
  async delete(worldId: string): Promise<void> {
    return RequestManager.fetch(
      `worlds:delete:${worldId}`,
      async () => {
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
        await QueryCache.invalidateByTags([
          CACHE_TAGS.worlds,
          CACHE_TAGS.world(worldId)
        ]);

        // Clear SecureStorage access flags for deleted world
        await worldAccessCache.clearWorldAccess(worldId);
      },
      {
        dedupe: false,
        retries: 3,
        timeout: 15000,
      }
    );
  },

  // Remove user from world
  async removeUserFromWorld(worldId: string, userId: string): Promise<void> {
    return RequestManager.fetch(
      `worlds:removeUserFromWorld:${worldId}:${userId}`,
      async () => {
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
        await QueryCache.invalidateByTags([
          CACHE_TAGS.worldMembers(worldId),
          CACHE_TAGS.user(userId)
        ]);

        // Clear SecureStorage access flag for removed user
        await worldAccessCache.updateAccessFlag(worldId, false, 'remove');
      },
      {
        dedupe: false,
        retries: 3,
        timeout: 15000,
      }
    );
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
    return RequestManager.fetch(
      `worlds:addUserToWorld:${worldId}:${userId}`,
      async () => {
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

        // Invalidate world members and user's worlds cache
        await QueryCache.invalidateByTags([
          CACHE_TAGS.worldMembers(worldId),
          CACHE_TAGS.user(userId),
          CACHE_TAGS.worlds
        ]);

        // Update SecureStorage access flag for newly added user
        await worldAccessCache.updateAccessFlag(worldId, true, 'add');

        return data;
      },
      {
        dedupe: false,
        retries: 3,
        timeout: 15000,
      }
    );
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
