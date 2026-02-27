import { dbRequestOptions } from "@/config";
import { RequestManager } from "@/lib/api/request-manager";
import { validateUserForWrite } from "@/lib/database/common";
import { executeEdgeFunction } from "@/lib/database/edge";
import { getDatabaseProvider } from "@/lib/services";
import { logger } from "@/lib/utils/logger";
import type {
  CreateInviteLinkParams,
  InviteLink,
  InviteRepository,
  OperationResult,
} from "./repo-types";

/**
 * Supabase implementation of InviteRepository.
 *
 * Manages world invite links. Handles creation, validation, and deletion of
 * temporary invite tokens that allow users to join worlds.
 *
 * NOTE: CacheOptions is accepted for interface compatibility, but caching and cache
 * invalidation are the responsibility of the caller (lib/database/invites.ts).
 * This implementation performs database operations only.
 */
export class SupabaseInviteRepository implements InviteRepository {
  async create(params: CreateInviteLinkParams): Promise<OperationResult<InviteLink>> {
    try {
      const { worldId, hoursValid = 24 } = params;

      // Validate before write operation
      await validateUserForWrite();

      logger.category("database").info(`Creating invite link for world ${worldId}`, {
        hoursValid,
      });

      const created = await executeEdgeFunction("createInviteLink", {
        world_id: worldId,
        max_uses: undefined,
        expires_in_days: Math.ceil(hoursValid / 24),
      });

      if (!created) {
        logger.category("database").error("No data returned from create_invite_link RPC");
        return { success: false, error: "Failed to create invite link" };
      }

      logger
        .category("database")
        .info(`Invite link created with token: ${created.token}`);

      return {
        success: true,
        data: {
          world_id: worldId,
          token: created.token,
          expires_at: created.expires_at,
          created_at: created.created_at,
        },
      };
    } catch (error) {
      logger.category("database").error("Unexpected error creating invite link", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async validate(token: string): Promise<OperationResult<string>> {
    try {
      logger.category("database").info(`Validating invite token: ${token}`);

      const result = await RequestManager.fetch(
        `invite:validate:${token}`,
        async () => {
          const invite = await executeEdgeFunction("resolveInviteToken", {
            invite_token: token,
          });

          if (!invite) {
            logger.category("database").error("No invite found for token", { token });
            throw new Error("Invalid invite link");
          }

          // Check if expired
          const expiresAt = new Date(invite.expires_at);
          if (expiresAt < new Date()) {
            logger.category("database").warn("Invite token expired", { expiresAt });
            throw new Error("This invite link has expired");
          }

          logger
            .category("database")
            .info(`Valid invite token for world: ${invite.world_id}`);
          return invite;
        },
        dbRequestOptions("read", "invite"),
      );

      if (!result) {
        return { success: false, error: "Invalid or expired invite link" };
      }

      // Type guard: ensure result has the expected properties
      if (!result.world_id) {
        return { success: false, error: "Invalid invite link structure" };
      }

      return {
        success: true,
        data: result.world_id,
      };
    } catch (error) {
      logger.category("database").error("Unexpected error validating token", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async delete(token: string): Promise<OperationResult<InviteLink>> {
    try {
      logger.category("database").info(`Deleting invite link with token: ${token}`);

      const deleted = await executeEdgeFunction("deleteInviteLink", {
        invite_token: token,
      });

      if (!deleted) {
        logger.category("database").error("No data returned from delete_invite_link RPC");
        return { success: false, error: "Failed to delete invite link" };
      }

      logger.category("database").info("Invite link deleted successfully", {
        token,
        worldId: deleted.world_id,
      });

      return {
        success: true,
        data: deleted,
      };
    } catch (error) {
      logger.category("database").error("Unexpected error deleting invite link", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async listByWorld(worldId: string): Promise<OperationResult<InviteLink[]>> {
    try {
      logger.category("database").info(`Listing invite links for world ${worldId}`);

      const result = await RequestManager.fetch(
        `world:${worldId}:invites`,
        async () => {
          const { data, error } = await getDatabaseProvider()
            .from("invite_links", "worlds")
            .select("*")
            .eq("world_id", worldId)
            .gt("expires_at", new Date().toISOString())
            .execute();

          if (error) {
            logger
              .category("database")
              .error("Failed to fetch invite links", error);
            throw new Error(error.message || "Failed to fetch invite links");
          }

          return data || [];
        },
        dbRequestOptions("list", "user"),
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      logger.category("database").error("Unexpected error listing invite links", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
