import { dbRequestOptions } from "@/config";
import { executeEdgeFunction } from "@/lib/database/edge";
import { getDatabase } from "@/lib/services";
import { logger } from "@/lib/utils/logger";
import { RequestManager } from "@/system/API/request-manager";
import type {
    AccessRole,
    WorldAccess,
    WorldAccessRepository
} from "./repo-types";

/**
 * Supabase implementation of WorldAccessRepository.
 *
 * Manages world membership and access control. Tracks which users have access to which worlds
 * and what role they have in each world.
 *
 * NOTE: CacheOptions is accepted for interface compatibility, but caching and cache invalidation
 * are the responsibility of the caller (lib/database/worlds.ts). This implementation performs
 * database operations only.
 */
export class SupabaseWorldAccessRepository implements WorldAccessRepository {
  async isUserInWorld(worldId: string, userId: string): Promise<boolean> {
    const result = await RequestManager.fetch(
      `world:${worldId}:access:${userId}`,
      async () => {
        const { data, error } = await getDatabase()
          .from("world_access", "worlds")
          .select("id")
          .eq("world_id", worldId)
          .eq("user_id", userId)
          .maybeSingle();

        if (error) {
          logger.category("database").error("Failed to check world access:", {
            worldId,
            userId,
            message: error.message,
          });
          throw new Error(error.message || "Failed to check world access");
        }

        return !!data;
      },
      dbRequestOptions("read", "public"),
    );
    return result ?? false;
  }

  async addUser(
    worldId: string,
    userId: string,
    inviteToken: string,
    userRole: AccessRole = "player",
  ): Promise<WorldAccess> {
    return RequestManager.fetch(
      `world:${worldId}:addUser:${userId}`,
      async () => {
        // Use semantic edge function to handle invite validation and access addition atomically
        const result = await executeEdgeFunction("joinWorldWithInvite", {
          invite_token: inviteToken,
        });

        if (!result) {
          throw new Error("Failed to add user to world");
        }

        logger.category("database").info("User added to world:", {
          worldId,
          userId,
          userRole,
        });

        return result;
      },
      dbRequestOptions("rpc", "user"),
    );
  }

  async removeUser(worldId: string, userId: string): Promise<void> {
    await RequestManager.fetch(
      `world:${worldId}:removeUser:${userId}`,
      async () => {
        // Use semantic edge function to handle access control and cascading deletes
        // The RPC enforces that only the user themselves or a world owner can remove membership.
        await executeEdgeFunction("removeWorldAccess", {
          world_id: worldId,
          user_id: userId,
        });

        logger.category("database").info("User removed from world:", {
          worldId,
          userId,
        });
      },
      dbRequestOptions("rpc", "user"),
    );
  }

  async getMembers(
    worldId: string,
  ): Promise<(WorldAccess & { user: any })[] | null> {
    return RequestManager.fetch(
      `world:${worldId}:members`,
      async () => {
        const { data, error } = await getDatabase()
          .from("world_access", "worlds")
          .select(`
            *,
            user:user_id(id, username, created_at)
          `)
          .eq("world_id", worldId)
          .execute();

        if (error) {
          logger.category("database").error("Failed to fetch world members:", {
            worldId,
            message: error.message,
          });
          throw new Error(error.message || "Failed to fetch world members");
        }

        return data || [];
      },
      dbRequestOptions("list", "user"),
    );
  }
}
