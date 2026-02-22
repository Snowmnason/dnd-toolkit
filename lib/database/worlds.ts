import { RequestManager } from "../api/request-manager";
import { getAuthProvider } from "../auth";
import { QueryCache } from "../cache";
import { CACHE_TAGS } from "../cache/keys";
import { getDatabaseProvider } from "../services";
import { SecureStorage, STORAGE_KEYS } from "../storage";
import { worldAccessCache } from "../storage/world-access-cache";
import { logger } from "../utils/logger";
import {
  executeParallelQueries,
  getCurrentUserProfile,
  validateUserForWrite,
} from "./common";

// Access role types for better type safety and maintainability
// 'dm' (dungeon master) is the only role with owner-level access to worlds
// TODO: Extend access levels for 'gm' (game master) and 'spectator' to have similar permissions to 'dm'
export type AccessRole = "dm" | "gm" | "player" | "spectator" | "observer";
/**
 * Dm- Owner of world has full control of the world, including managing members, deleting world, etc. 
 * Gm- Game master with elevated permissions to manage files/data inside the world
 * Player- Regular player with standard permissions
 * Spectator- has GM like observer permissions but cannot interact with world elements (read-only)
 * Observer- has player like read-only permissions with even more restrictions
 **/

export interface World {
  world_id: string;
  owner_id: string;
  name: string;
  description: string | null;
  system: string;
  is_dm: boolean;
  map_image_url: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface WorldAccess {
  id: string;
  world_id: string;
  user_id: string;
  user_role: AccessRole; // Role in the world (dm = owner-level access)
  permissions: any; // JSONB field
  created_at: string;
  updated_at: string;
}

export interface WorldWithAccess extends World {
  world_access?: WorldAccess;
  user_role: AccessRole; // Role of the current user in this world
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

        logger
          .category("storage")
          .debug(
            `Creating world: ${worldData.name} (${worldData.system}) for user ${currentUser.id}`,
          );

        // Store profile ID as owner_id (proper FK relationship)
        const insertData = {
          ...worldData,
          owner_id: currentUser.id,
        };

        const { data, error } = await getDatabaseProvider()
          .from('worlds', 'worlds')
          .insert(insertData)
          .select()
          .single();

        if (error) {
          logger.category("storage").error("Failed to create world", {
            ownerId: currentUser.id,
            worldName: worldData.name,
            error: error.message,
            code: error.code,
          });
          throw new Error(error.message || "Failed to create world");
        }

        logger.category("storage").info("World created successfully", {
          worldId: data.world_id,
          ownerId: currentUser.id,
          name: data.name,
        });

        // Invalidate world lists cache (notify all subscribers)
        await QueryCache.invalidateByTags([
          CACHE_TAGS.worlds,
          CACHE_TAGS.user(currentUser.id),
        ]);

        // Update SecureStorage access flag for new world (owner has access)
        await worldAccessCache.updateAccessFlag(data.world_id, true, "create");

        return data;
      },
      {
        dedupe: false,
        retries: 3,
        timeout: 15000,
        authStrategy: "user",
      },
    );
  },

  // Get all worlds for current user (both owned and member of)
  // NOTE: This is a convenience wrapper around getMyWorldsPaginated() that returns all worlds
  // without pagination. Uses the same caching and optimization logic internally.
  async getMyWorlds(userId?: string): Promise<WorldWithAccess[]> {
    // Call the paginated version without pagination params to get all worlds
    // This ensures we get the caching benefits without code duplication
    const result = await this.getMyWorldsPaginated(userId);
    // Ensure we always return an array, never the paginated object
    if (Array.isArray(result)) {
      // In case result is already an array (shouldn't happen, but defensive)
      return result;
    }
    return result.items || [];
  },

  // Get paginated worlds for current user (both owned and member of)
  async getMyWorldsPaginated(
    userId?: string,
    options: { page?: number; limit?: number } = {},
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
    let worldIdSet: Set<string> = new Set<string>();
    let roleMap: Map<string, { role: AccessRole; permissions: any }> = new Map();

    const cachedData = await QueryCache.get<{
      worldIds: string[];
      roles: [string, { role: AccessRole; permissions: any }][];
    }>(cacheKey);

    if (cachedData) {
      // Use cached world IDs and roles
      worldIdSet = new Set(cachedData.worldIds);
      roleMap = new Map(cachedData.roles);
      logger.debug(
        "storage",
        `Using cached world IDs for user ${currentUserId}`,
        {
          count: worldIdSet.size,
        },
      );
    } else {
      // Try a persistent fallback: use encrypted connected_worlds stored in localStorage
      // This improves initial app startup UX when sessionStorage is empty
      // BUT: We still need to fetch from DB to get role information (owner vs member)
      try {
        const persisted = await SecureStorage.getJSON<string[]>(
          STORAGE_KEYS.CONNECTED_WORLDS,
        );
        if (persisted && Array.isArray(persisted) && persisted.length > 0) {
          worldIdSet = new Set(persisted);
          roleMap = new Map();

          logger.debug(
            "storage",
            `Using persisted connected_worlds for user ${currentUserId}`,
            { count: worldIdSet.size },
          );
        }
      } catch (err) {
        logger.debug(
          "storage",
          "Error reading persisted connected_worlds (non-fatal)",
          err,
        );
      }

      // ALWAYS fetch from DB to get role information, even if seeded from persistent
      // Persistent storage gives us world IDs quickly, but we need DB to determine owner vs member roles
      {
        // DEBUG: Log session state and userId being used for queries
        if (getDatabaseProvider().isConfigured()) {
          try {
            const session = await (await getAuthProvider()).getSession();
            logger.debug("storage", "🔍 World query debug info", {
              userId: currentUserId,
              hasSession: !!session,
              sessionUserId: session?.userId,
            });
          } catch (sessionCheckErr) {
            logger.warn("storage", "Failed to check session state during world query debug", sessionCheckErr);
          }
        }

        // Helper function to execute the queries
        const executeWorldQueries = async () => {
          return await executeParallelQueries<
            [
              { data: any[] | null; error: any },
              { data: any[] | null; error: any },
            ]
          >(
            // Get world_access records where user_id matches (includes world_id and role)
            getDatabaseProvider()
              .from("world_access", 'worlds')
              .select("world_id, user_role, permissions")
              .eq("user_id", currentUserId)
              .execute(),

            // Get world IDs where owner_id matches
            getDatabaseProvider()
              .from("worlds", 'worlds')
              .select("world_id")
              .eq("owner_id", currentUserId)
              .execute()
          );
        };

        // STEP 1: Get world IDs from both world_access and owned worlds in parallel
        let [accessRecordsResult, ownedWorldIdsResult] = await executeWorldQueries();
        let retryAttempt = 0;

        // RACE CONDITION FIX: If we get 0 results on first attempt, retry after short delay
        // This handles fresh sign-in where RLS policies might not be fully synced yet
        const accessCount = accessRecordsResult.data?.length || 0;
        const ownedCount = ownedWorldIdsResult.data?.length || 0;
        
        if (accessCount === 0 && ownedCount === 0 && retryAttempt === 0) {
          logger.debug("storage", "⏳ Got 0 worlds on first query, retrying after 500ms (RLS sync delay)");
          // Wait for RLS to sync with the authenticated session
          await new Promise(resolve => setTimeout(resolve, 500));
          retryAttempt = 1;
          [accessRecordsResult, ownedWorldIdsResult] = await executeWorldQueries();
        }

        // DEBUG: Log query results
        const finalAccessCount = accessRecordsResult.data?.length || 0;
        const finalOwnedCount = ownedWorldIdsResult.data?.length || 0;
        const totalCount = finalAccessCount + finalOwnedCount;
        
        if (totalCount === 0) {
          logger.warn("storage", "⚠️ World query returned 0 results after retry", {
            userId: currentUserId,
            accessRecordsCount: finalAccessCount,
            ownedWorldsCount: finalOwnedCount,
            retryAttempt,
            accessRecordsError: accessRecordsResult.error?.message,
            ownedWorldsError: ownedWorldIdsResult.error?.message,
            note: "User likely has no worlds, or RLS is blocking all access",
          });
        } else {
          logger.debug("storage", "🌍 World query results", {
            accessRecordsCount: finalAccessCount,
            ownedWorldsCount: finalOwnedCount,
            total: totalCount,
            retryAttempt,
          });
        }

        if (accessRecordsResult.error) {
          logger.error(
            "storage",
            "Error fetching access records:",
            accessRecordsResult.error,
          );
          throw new Error(
            accessRecordsResult.error.message || "Failed to fetch access records",
          );
        }

        if (ownedWorldIdsResult.error) {
          logger.error(
            "storage",
            "Error fetching owned world IDs:",
            ownedWorldIdsResult.error,
          );
          throw new Error(
            ownedWorldIdsResult.error.message ||
              "Failed to fetch owned world IDs",
          );
        }

        // STEP 2: Collect all unique world IDs and build role mapping
        worldIdSet = new Set<string>();
        roleMap = new Map<string, { role: AccessRole; permissions: any }>();

        // Add world IDs from world_access (user is a member/dm)
        (accessRecordsResult.data || []).forEach((access: any) => {
          worldIdSet.add(access.world_id);
          roleMap.set(access.world_id, {
            role: access.user_role,
            permissions: access.permissions || {},
          });
        });

        // Add world IDs from owned worlds (user is owner) - owner takes precedence
        (ownedWorldIdsResult.data || []).forEach((world: any) => {
          worldIdSet.add(world.world_id);
          // Owner gets 'dm' role for owner-level access
          // TODO: Consider 'gm' and 'spectator' roles with similar access levels
          roleMap.set(world.world_id, {
            role: "dm",
            permissions: {},
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
            tags: ["worlds", `user:${currentUserId}`],
          }
        );

        // IMPORTANT: Update persistent storage with fresh world IDs from DB
        // This ensures that on next session/tab refresh, we load the latest accurate list
        // instead of stale data from before the last logout
        const freshWorldIds = Array.from(worldIdSet);
        await SecureStorage.setJSON(STORAGE_KEYS.CONNECTED_WORLDS, freshWorldIds).catch(
          (err) => {
            logger.warn(
              "storage",
              "Failed to update connected_worlds after DB fetch (non-critical)",
              err,
            );
          }
        );

        logger.debug("storage", `Cached world IDs for user ${currentUserId}`, {
          count: worldIdSet.size,
        });
      }
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
    const { data: worldsData, error: worldsError } = await getDatabaseProvider()
      .from('worlds', 'worlds')
      .select("*")
      .in("world_id", worldIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)
      .execute();

    if (worldsError) {
      logger.error("storage", "Error fetching paginated worlds:", worldsError);
      throw new Error(worldsError.message || "Failed to fetch worlds");
    }

    // STEP 5: Map worlds with their roles
    const paginatedWorlds: WorldWithAccess[] = (worldsData || []).map(
      (world: World) => {
        let roleInfo = roleMap.get(world.world_id);

        return {
          ...world,
          user_role: roleInfo?.role || "player",
          // Only include world_access for non-owners
          // Owners are identified by world.owner_id matching currentUserId
          // and have 'dm' role for owner-level access
          // TODO: Extend access metadata for 'gm' and 'spectator' roles with similar permissions
          world_access:
            world.owner_id !== currentUserId
              ? {
                  id: "",
                  world_id: world.world_id,
                  user_id: currentUserId,
                  user_role: roleInfo?.role as AccessRole,
                  permissions: roleInfo?.permissions || {},
                  created_at: world.created_at,
                }
              : undefined,
        };
      },
    );

    return {
      items: paginatedWorlds,
      total: totalWorlds,
    };
  },

  // Update a world name (only owner)
  async updateName(worldId: string, newName: string): Promise<World> {
    return RequestManager.fetch(
      `worlds:updateName:${worldId}`,
      async () => {
        // Validate before write
        const user = await validateUserForWrite();

        const { data, error } = await getDatabaseProvider()
          .from('worlds', 'worlds')
          .update({ name: newName })
          .eq("world_id", worldId)
          .eq("owner_id", user.id)
          .select()
          .single();

        if (error) {
          logger.error("storage", "Error updating world:", error);
          throw new Error(error.message || "Failed to update world");
        }

        // Invalidate specific world and lists cache
        await QueryCache.invalidateByTags([
          CACHE_TAGS.worlds,
          CACHE_TAGS.world(worldId),
        ]);

        return data;
      },
      {
        dedupe: false,
        retries: 3,
        timeout: 15000,
        authStrategy: "user",
      },
    );
  },

  // Update a world
  async update(
    worldId: string,
    updates: Partial<CreateWorldData>,
  ): Promise<World> {
    return RequestManager.fetch(
      `worlds:update:${worldId}`,
      async () => {
        // Validate before write
        const user = await validateUserForWrite();

        const { data, error } = await getDatabaseProvider()
          .from('worlds', 'worlds')
          .update(updates)
          .eq("world_id", worldId)
          .eq("owner_id", user.id)
          .select()
          .single();

        if (error) {
          logger.error("storage", "Error updating world:", error);
          throw new Error(error.message || "Failed to update world");
        }

        // Invalidate specific world and lists cache
        await QueryCache.invalidateByTags([
          CACHE_TAGS.worlds,
          CACHE_TAGS.world(worldId),
        ]);

        return data;
      },
      {
        dedupe: false,
        retries: 3,
        timeout: 15000,
        authStrategy: "user",
      },
    );
  },

  // Soft-delete a world (sets deleted_at; filtered out by RLS and queries)
  async delete(worldId: string): Promise<void> {
    await RequestManager.fetch(
      `worlds:delete:${worldId}`,
      async () => {
        // Validate before write
        const user = await validateUserForWrite();

        const { error } = await getDatabaseProvider()
          .from('worlds', 'worlds')
          .update({ deleted_at: new Date().toISOString() })
          .eq("world_id", worldId)
          .eq("owner_id", user.id) // Ensure only owner can delete
          .execute();

        if (error) {
          logger.error("storage", "Error deleting world:", error);
          throw new Error(error.message || "Failed to delete world");
        }

        // Invalidate specific world and lists cache
        await QueryCache.invalidateByTags([
          CACHE_TAGS.worlds,
          CACHE_TAGS.world(worldId),
        ]);

        // Clear SecureStorage access flags for deleted world
        await worldAccessCache.clearWorldAccess(worldId);
      },
      {
        dedupe: false,
        retries: 3,
        timeout: 15000,
        authStrategy: "user",
      },
    );

    return;
  },

  // Remove user from world
  async removeUserFromWorld(worldId: string, userId: string): Promise<void> {
    await RequestManager.fetch(
      `worlds:removeUserFromWorld:${worldId}:${userId}`,
      async () => {
        // Uses server-side function to avoid client-side DELETE policies on world_access.
        // The RPC always applies to the current authenticated user.
        const { error } = await getDatabaseProvider()
          .rpc("leave_world", { p_world_id: worldId }, 'worlds');

        if (error) {
          logger.error("storage", "Error removing user from world:", error);
          throw new Error(error.message || "Failed to remove user from world");
        }

        // Invalidate world members and user's worlds cache
        await QueryCache.invalidateByTags([
          CACHE_TAGS.worldMembers(worldId),
          CACHE_TAGS.user(userId),
        ]);

        // NOTE: Do not update SecureStorage here. This function removes userId (potentially another user)
        // from the world, but SecureStorage is per-user and can only be updated for the current user.
        // If userId === currentUserId (user removing themselves), the background QueryCache.getMyWorlds()
        // will refresh and update SecureStorage via useWorlds hook. For other users, their own clients
        // will sync when they next fetch their world list.
      },
      {
        dedupe: false,
        retries: 3,
        timeout: 15000,
        authStrategy: "user",
      },
    );

    return;
  },

  // Check if user is already in a world (either as owner or member)
  // Uses RequestManager for deduplication and retry
  async isUserInWorld(worldId: string, userId: string): Promise<boolean> {
    const result = await RequestManager.fetch(
      `world:access:${worldId}:${userId}`,
      async () => {
        // Combine both checks into parallel queries for efficiency
        const [worldResult, accessResult] = await executeParallelQueries<
          [{ data: any | null; error: any }, { data: any | null; error: any }]
        >(
          getDatabaseProvider()
            .from('worlds', 'worlds')
            .select("owner_id")
            .eq("world_id", worldId)
            .eq("owner_id", userId)
            .maybeSingle(),

          getDatabaseProvider()
            .from("world_access", 'worlds')
            .select("id")
            .eq("world_id", worldId)
            .eq("user_id", userId)
            .maybeSingle(),
        );

        const isOwner = !!worldResult.data;
        const isMember = !!accessResult.data;
        const hasAccess = isOwner || isMember;

        logger.debug(
          "storage",
          `[isUserInWorld] worldId=${worldId}, userId=${userId}, isOwner=${isOwner}, isMember=${isMember}, hasAccess=${hasAccess}`,
        );

        return hasAccess;
      },
      {
        dedupe: true,
        retries: 2,
        timeout: 10000,
        authStrategy: "user",
      },
    );

    // If RequestManager returns null (failOpen flag), default to false for safety
    return result ?? false;
  },

  // Add user to world (invite/join)
  async addUserToWorld(
    worldId: string,
    userId: string,
    inviteToken: string,
    userRole: AccessRole = "player",
  ): Promise<WorldAccess> {
    return RequestManager.fetch(
      `worlds:addUserToWorld:${worldId}:${userId}`,
      async () => {
        // Joining via invite is enforced server-side; userId is ignored by the RPC.
        // We keep userId in the API to minimize callsite changes and for cache tagging.
        const { data, error } = await getDatabaseProvider()
          .rpc("join_world_with_invite", {
            p_world_id: worldId,
            p_token: inviteToken,
            p_user_role: userRole,
          }, 'worlds');

        if (error) {
          logger.error("storage", "Error adding user to world:", error);
          throw new Error(error.message || "Failed to add user to world");
        }

        // Invalidate world members and user's worlds cache
        await QueryCache.invalidateByTags([
          CACHE_TAGS.worldMembers(worldId),
          CACHE_TAGS.user(userId),
          CACHE_TAGS.worlds,
        ]);

        // NOTE: Do not update SecureStorage here. This function adds userId to the world,
        // but SecureStorage is per-user and can only be updated for the current user.
        // If userId === currentUserId (user being added/invited), the background QueryCache.getMyWorlds()
        // will refresh and update SecureStorage via useWorlds hook. For other invitations to different users,
        // their own clients will sync when they next fetch their world list.

        return data;
      },
      {
        dedupe: false,
        retries: 3,
        timeout: 15000,
        authStrategy: "user",
      },
    );
  },

  // Get all members of a world
  // Uses RequestManager for deduplication and retry
  // Note: Returns null if RequestManager fails with failOpen enabled
  async getWorldMembers(
    worldId: string,
  ): Promise<(WorldAccess & { user: any })[] | null> {
    return RequestManager.fetch(
      `world:members:${worldId}`,
      async () => {
        const { data, error } = await getDatabaseProvider()
          .from("world_access", 'worlds')
          .select(
            `
            *,
            users(id, username)
          `,
          )
          .eq("world_id", worldId)
          .order("created_at", { ascending: false })
          .execute();

        if (error) {
          logger.error("storage", "Error fetching world members:", error);
          throw new Error(error.message || "Failed to fetch world members");
        }

        return data || [];
      },
      {
        dedupe: true,
        retries: 2,
        timeout: 15000,
        authStrategy: "user",
      },
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
        const { data, error } = await getDatabaseProvider()
          .from('worlds', 'worlds')
          .select("*")
          .eq("world_id", worldId)
          .single();

        if (error) {
          if (error.code === "PGRST116") {
            // No rows returned
            return null;
          }
          logger.error("storage", "Error fetching world:", error);
          throw new Error(error.message || "Failed to fetch world");
        }

        return data;
      },
      {
        dedupe: true,
        retries: 3,
        timeout: 15000,
        authStrategy: "user",
      },
    );
  },
};
