import { dbRequestOptions } from "@/config";
import { fetchRequest } from "@/lib/api";
import { getCurrentSession } from "@/lib/auth";
import type { AccessRole } from "@/lib/database/worlds";
import { logger } from "@/lib/utils/logger";
import { getDatabase } from "@/middleware/services";
import type {
    CreateWorldData,
    PaginatedResult,
    PaginationOptions,
    World,
    WorldRepository,
    WorldWithAccess
} from "./repo-types";

/**
 * Supabase implementation of WorldRepository.
 *
 * Manages world CRUD operations and world access control. The current user
 * is inferred from the authenticated session.
 *
 * NOTE: CacheOptions is accepted for interface compatibility, but caching is the
 * responsibility of the caller (lib/database/worlds.ts). This implementation always
 * fetches from the database.
 */
export class SupabaseWorldRepository implements WorldRepository {
  async create(worldData: CreateWorldData): Promise<World> {
    return fetchRequest(
      `world:create:${worldData.name}:${Date.now()}`,
      async () => {
        const session = await getCurrentSession();
        if (!session?.userId) {
          throw new Error("No authenticated user found");
        }

        logger.category("database").info("Starting world creation", {
          worldName: worldData.name,
          system: worldData.system,
        });

        // Store profile ID as owner_id (proper FK relationship)
        const insertData = {
          ...worldData,
          owner_id: session.userId,
        };

        const { data, error } = await getDatabase()
          .from("worlds", "worlds")
          .insert(insertData)
          .select()
          .single();

        if (error) {
          logger.category("database").error("Database error during world creation:", {
            worldName: worldData.name,
            message: error.message,
            code: error.code,
            details: error.details,
          });
          throw new Error(error.message || "Failed to create world");
        }

        logger.category("database").info("World created successfully:", {
          worldId: data.world_id,
          name: data.name,
        });

        return data;
      },
      dbRequestOptions("create", "user"),
    );
  }

  async getById(worldId: string): Promise<World | null> {
    return fetchRequest(
      `world:${worldId}`,
      async () => {
        const { data, error } = await getDatabase()
          .from("worlds", "worlds")
          .select("*")
          .eq("world_id", worldId)
          .maybeSingle();

        if (error) {
          logger.category("database").error("Failed to fetch world:", {
            worldId,
            message: error.message,
            code: error.code,
            details: error.details,
          });
          throw new Error(error.message || "Failed to fetch world");
        }

        return data || null;
      },
      dbRequestOptions("read", "public"),
    );
  }

  async getMyWorlds(userId?: string): Promise<WorldWithAccess[]> {
    const result = await this.getMyWorldsPaginated(userId);
    // Handle both direct array and paginated response
    if (Array.isArray(result)) {
      return result;
    }
    return result.items || [];
  }

  async getMyWorldsPaginated(
    userId?: string,
    _options?: PaginationOptions,
  ): Promise<PaginatedResult<WorldWithAccess>> {
    const result = await fetchRequest(
      `worlds:my:${userId || "current"}`,
      async () => {
        // Get current user if not provided
        let currentUserId = userId;
        if (!currentUserId) {
          const session = await getCurrentSession();
          if (!session?.userId) {
            logger.category("database").debug("No authenticated user found");
            return { items: [], total: 0 };
          }
          currentUserId = session.userId;
        }

        logger.category("database").debug("Fetching accessible worlds for user:", {
          userId: currentUserId,
        });

        // Get all world IDs and roles the user has access to
        const { data: accessData, error: accessError } = await getDatabase()
          .from("world_access", "worlds")
          .select("world_id, user_role, permissions")
          .eq("user_id", currentUserId)
          .execute();

        if (accessError) {
          logger.category("database").error("Failed to fetch world access:", {
            userId: currentUserId,
            message: accessError.message,
            code: accessError.code,
            details: accessError.details,
          });
          throw new Error(accessError.message || "Failed to fetch world access");
        }

        if (!accessData || accessData.length === 0) {
          logger.category("database").debug("User has no world access");
          return { items: [], total: 0 };
        }

        // Get world details for each accessible world
        const worldIds = accessData.map((a: { world_id: string; user_role: AccessRole; permissions: any }) => a.world_id);
        const { data: worldsData, error: worldsError } = await getDatabase()
          .from("worlds", "worlds")
          .select("*")
          .in("world_id", worldIds)
          .execute();

        if (worldsError) {
          logger.category("database").error("Failed to fetch worlds:", {
            worldIds,
            message: worldsError.message,
            code: worldsError.code,
            details: worldsError.details,
          });
          throw new Error(worldsError.message || "Failed to fetch worlds");
        }

        // Merge world data with access roles
        const accessMap = new Map<string, { role: AccessRole; permissions: any }>(
          accessData.map((a: { world_id: string; user_role: AccessRole; permissions: any }) => [a.world_id, { role: a.user_role, permissions: a.permissions }]),
        );

        const worldsWithAccess: WorldWithAccess[] = (worldsData || []).map((world: World) => {
          const access = accessMap.get(world.world_id);
          return {
            ...world,
            user_role: access?.role || ("player" as const),
          };
        });

        logger.category("database").info("Fetched accessible worlds:", {
          userId: currentUserId,
          count: worldsWithAccess.length,
        });

        return {
          items: worldsWithAccess,
          total: worldsWithAccess.length,
        };
      },
      dbRequestOptions("list", "user"),
    );

    return result ?? { items: [], total: 0 };
  }

  async updateName(worldId: string, newName: string): Promise<World> {
    return this.update(worldId, { name: newName });
  }

  async update(worldId: string, updates: Partial<CreateWorldData>): Promise<World> {
    const session = await getCurrentSession();
    if (!session?.userId) {
      throw new Error("No authenticated user found");
    }

    logger.category("database").debug("Starting world update", {
      worldId,
      updatedFields: Object.keys(updates),
    });

    return fetchRequest(
      `world:update:${worldId}`,
      async () => {
        const { data, error } = await getDatabase()
          .from("worlds", "worlds")
          .update(updates)
          .eq("world_id", worldId)
          .select()
          .single();

        if (error) {
          logger.category("database").error("Failed to update world:", {
            worldId,
            message: error.message,
            code: error.code,
            details: error.details,
          });
          throw new Error(error.message || "Failed to update world");
        }

        logger.category("database").info("World updated successfully:", {
          worldId: data.world_id,
          name: data.name,
        });

        return data;
      },
      dbRequestOptions("update", "user"),
    );
  }

  async delete(worldId: string): Promise<void> {
    const session = await getCurrentSession();
    if (!session?.userId) {
      throw new Error("No authenticated user found");
    }

    logger.category("database").debug("Starting world deletion", { worldId });

    await fetchRequest(
      `world:delete:${worldId}`,
      async () => {
        const { error } = await getDatabase()
          .from("worlds", "worlds")
          .update({ deleted_at: new Date().toISOString() })
          .eq("world_id", worldId)
          .execute();

        if (error) {
          logger.category("database").error("Failed to delete world:", {
            worldId,
            message: error.message,
            code: error.code,
            details: error.details,
          });
          throw new Error(error.message || "Failed to delete world");
        }

        logger.category("database").info("World soft-deleted:", { worldId });
        return true;
      },
      dbRequestOptions("delete", "user"),
    );
  }
}
