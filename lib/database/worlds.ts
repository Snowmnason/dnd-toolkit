import { QueryCache, SecureStorage } from "@/lib/storage";
import { worldAccessCache } from "@/lib/storage/sync/world-access-cache";
import { logger } from "@/lib/utils";
import { STORAGE_KEYS } from "@/maps";
import { CACHE_TAGS } from "@/maps/cache-keys";
import { getCurrentUserProfile } from "./database-manger";
import { getInviteRepository, getWorldAccessRepository, getWorldRepository } from "./repositories";

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

export interface InviteLink {
  id?: string;
  world_id: string;
  created_by?: string;
  token: string;
  expires_at: string;
  created_at: string;
}

interface CreateInviteLinkParams {
  worldId: string;
  hoursValid?: number;
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
    const data = await getWorldRepository().create(worldData);

    // Invalidate world lists cache
    await QueryCache.invalidateByTags([
      CACHE_TAGS.worlds,
      CACHE_TAGS.user(data.owner_id),
    ]);

    // Update SecureStorage access flag for new world (owner has access)
    await worldAccessCache.updateAccessFlag(data.world_id, true, "create");

    return data;
  },

  // Get all worlds for current user (both owned and member of)
  async getMyWorlds(userId?: string): Promise<WorldWithAccess[]> {
    const result = await this.getMyWorldsPaginated(userId);
    return result.items || [];
  },

  // Get paginated worlds for current user (both owned and member of)
  async getMyWorldsPaginated(
    userId?: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{ items: WorldWithAccess[]; total: number }> {
    const { page = 1, limit = 20 } = options;

    // Handle case where user is not authenticated (e.g., during logout)
    let currentUserId = userId;
    if (!currentUserId) {
      const currentUser = await getCurrentUserProfile();
      if (!currentUser) {
        return { items: [], total: 0 };
      }
      currentUserId = currentUser.id;
    }

    // OPTIMIZATION: Try QueryCache first (in-memory, short TTL)
    const cacheKey = `worlds:paginated:${currentUserId}:${page}:${limit}`;
    const cached = await QueryCache.get<{ items: WorldWithAccess[]; total: number }>(cacheKey);
    if (cached) {
      logger.category("database").debug(`Worlds loaded from cache for user ${currentUserId}`, {
        count: cached.items.length,
      });
      return cached;
    }

    // Fetch fresh data from database via repository
    const result = await getWorldRepository().getMyWorldsPaginated(currentUserId, { page, limit });

    // Cache result (short TTL — membership can change)
    await QueryCache.set(
      cacheKey,
      result,
      {
        staleTime: 5 * 60 * 1000,  // 5 minutes
        cacheTime: 15 * 60 * 1000, // 15 minutes
        tags: ["worlds", `user:${currentUserId}`],
      },
    );

    // Update persistent connected_worlds for fast startup (next session seed)
    const worldIds = result.items.map((w) => w.world_id);
    await SecureStorage.setJSON(STORAGE_KEYS.CONNECTED_WORLDS, worldIds).catch((err) => {
      logger.category("database").warn("Failed to update connected_worlds (non-critical):", err);
    });

    return result;
  },

  // Update a world name (only owner)
  async updateName(worldId: string, newName: string): Promise<World> {
    const data = await getWorldRepository().updateName(worldId, newName);

    // Invalidate specific world and lists cache
    await QueryCache.invalidateByTags([
      CACHE_TAGS.worlds,
      CACHE_TAGS.world(worldId),
    ]);

    return data;
  },

  // Update a world
  async update(
    worldId: string,
    updates: Partial<CreateWorldData>,
  ): Promise<World> {
    const data = await getWorldRepository().update(worldId, updates);

    // Invalidate specific world and lists cache
    await QueryCache.invalidateByTags([
      CACHE_TAGS.worlds,
      CACHE_TAGS.world(worldId),
    ]);

    return data;
  },

  // Soft-delete a world (sets deleted_at; filtered out by RLS and queries)
  async delete(worldId: string): Promise<void> {
    await getWorldRepository().delete(worldId);

    // Invalidate specific world and lists cache
    await QueryCache.invalidateByTags([
      CACHE_TAGS.worlds,
      CACHE_TAGS.world(worldId),
    ]);

    // Clear SecureStorage access flags for deleted world
    await worldAccessCache.clearWorldAccess(worldId);
  },

  // Remove user from world
  async removeUserFromWorld(worldId: string, userId: string): Promise<void> {
    await getWorldAccessRepository().removeUser(worldId, userId);

    // Invalidate world members and user's worlds cache
    await QueryCache.invalidateByTags([
      CACHE_TAGS.worldMembers(worldId),
      CACHE_TAGS.user(userId),
    ]);
  },

  // Check if user is already in a world (either as owner or member)
  async isUserInWorld(worldId: string, userId: string): Promise<boolean> {
    return getWorldAccessRepository().isUserInWorld(worldId, userId);
  },

  // Add user to world via invite token
  async addUserToWorld(
    worldId: string,
    userId: string,
    inviteToken: string,
    userRole: AccessRole = "player",
  ): Promise<WorldAccess> {
    const data = await getWorldAccessRepository().addUser(worldId, userId, inviteToken, userRole);

    // Invalidate world members and user's worlds cache
    await QueryCache.invalidateByTags([
      CACHE_TAGS.worldMembers(worldId),
      CACHE_TAGS.user(userId),
      CACHE_TAGS.worlds,
    ]);

    return data;
  },

  // Get all members of a world
  async getWorldMembers(
    worldId: string,
  ): Promise<(WorldAccess & { user: any })[] | null> {
    return getWorldAccessRepository().getMembers(worldId);
  },

  // Get a specific world by ID
  async getById(worldId: string): Promise<World | null> {
    return getWorldRepository().getById(worldId);
  },

  // Create an invite link for a world
  async createInviteLink(
    params: CreateInviteLinkParams,
  ): Promise<{ success: boolean; inviteLink?: InviteLink; error?: string }> {
    const result = await getInviteRepository().create(params);
    if (result.success && result.data) {
      await QueryCache.invalidate(`world:${params.worldId}:invites`);
      return { success: true, inviteLink: result.data };
    }
    return { success: false, error: result.error };
  },

  // Validate an invite token and get the associated world
  async validateInviteToken(
    token: string,
  ): Promise<{ success: boolean; worldId?: string; error?: string }> {
    const result = await getInviteRepository().validate(token);
    if (result.success && result.data) {
      return { success: true, worldId: result.data };
    }
    return { success: false, error: result.error };
  },

  // Delete an invite link
  async deleteInviteLink(
    token: string,
  ): Promise<{ success: boolean; error?: string }> {
    const result = await getInviteRepository().delete(token);
    return { success: result.success, error: result.error };
  },

  // Get all active invite links for a world
  async getWorldInviteLinks(
    worldId: string,
  ): Promise<{ success: boolean; invites?: InviteLink[]; error?: string }> {
    const result = await getInviteRepository().listByWorld(worldId);
    if (result.success) {
      return { success: true, invites: result.data ?? [] };
    }
    return { success: false, error: result.error };
  },
};
