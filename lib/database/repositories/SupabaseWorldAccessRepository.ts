import { RequestManager } from "@/lib/api/request-manager";
import { getDatabaseProvider } from "@/lib/services";
import { logger } from "@/lib/utils/logger";
import { dbRequestOptions } from "./request-config";
import type {
    AccessRole,
    WorldAccess,
    WorldAccessRepository
} from "./types";

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
        const { data, error } = await getDatabaseProvider()
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
        // Use RPC to handle invite validation and access addition atomically
        const { data, error } = await getDatabaseProvider()
          .rpc(
            "join_world_with_invite",
            {
              p_world_id: worldId,
              p_invite_token: inviteToken,
              p_user_role: userRole,
            },
            "worlds",
          );

        if (error) {
          logger.category("database").error("Failed to add user to world:", {
            worldId,
            userId,
            message: error.message,
          });
          throw new Error(error.message || "Failed to add user to world");
        }

        const result = Array.isArray(data) ? data[0] : data;

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
        // Server-side RPC to handle access control and cascading deletes
        // The RPC enforces that only the user themselves or a world owner can remove membership.
        const { error } = await getDatabaseProvider()
          .rpc("remove_world_access", {
            p_world_id: worldId,
            p_user_id: userId,
          }, "worlds");

        if (error) {
          logger.category("database").error("Failed to remove user from world:", {
            worldId,
            userId,
            message: error.message,
          });
          throw new Error(error.message || "Failed to remove user from world");
        }

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
        const { data, error } = await getDatabaseProvider()
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
