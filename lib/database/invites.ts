import { RequestManager } from "../api/request-manager";
import { QueryCache } from "../cache";
import { logger } from "../utils/logger";
import { validateUserForWrite } from "./common";
import { supabase } from "./supabase";

/**
 * Database operations for invite links
 */

interface InviteLink {
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

/**
 * Create a new invite link for a world
 * Supabase handles token generation and default expiration
 */
export async function createInviteLink(
  params: CreateInviteLinkParams,
): Promise<{ success: boolean; inviteLink?: InviteLink; error?: string }> {
  try {
    const { worldId, hoursValid = 24 } = params;

    // Validate before write operation
    await validateUserForWrite();

    logger.info("storage", `Creating invite link for world ${worldId}`, {
      hoursValid,
    });

    const { data, error } = await supabase
      .schema('worlds')
      .rpc('create_invite_link', {
        p_world_id: worldId,
        p_hours_valid: hoursValid,
      });

    if (error) {
      logger.error("storage", "Failed to create invite link", error);
      return { success: false, error: error.message };
    }

    const created = Array.isArray(data) ? data[0] : data;

    if (!created) {
      logger.error("storage", "No data returned from create_invite_link RPC");
      return { success: false, error: "Failed to create invite link" };
    }

    logger.success(`Invite link created with token: ${created.token}`);

    // Invalidate invite links cache for this world
    await QueryCache.invalidate(`world:${worldId}:invites`);

    return {
      success: true,
      inviteLink: {
        world_id: worldId,
        token: created.token,
        expires_at: created.expires_at,
        created_at: created.created_at,
      },
    };
  } catch (error) {
    logger.error("storage", "Unexpected error creating invite link", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Validate an invite token and get the associated world
 * Uses RequestManager for deduplication and retry
 */
export async function validateInviteToken(
  token: string,
): Promise<{ success: boolean; worldId?: string; error?: string }> {
  try {
    logger.info("storage", `Validating invite token: ${token}`);

    const result = await RequestManager.fetch(
      `invite:validate:${token}`,
      async () => {
        const { data, error } = await supabase
          .schema('worlds')
          .rpc("resolve_invite_token", {
            p_token: token,
          });

        if (error) {
          logger.error("storage", "Invalid invite token", error);
          throw new Error("Invalid or expired invite link");
        }

        const invite = Array.isArray(data) ? data[0] : data;

        if (!invite) {
          logger.error("storage", "No invite found for token");
          throw new Error("Invalid invite link");
        }

        // Check if expired
        const expiresAt = new Date(invite.expires_at);
        if (expiresAt < new Date()) {
          logger.warn("storage", "Invite token expired", { expiresAt });
          throw new Error("This invite link has expired");
        }

        logger.success(`Valid invite token for world: ${invite.world_id}`);
        return invite;
      },
      {
        dedupe: true,
        retries: 2,
        timeout: 10000,
        authStrategy: "invite",
      },
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
      worldId: result.world_id,
    };
  } catch (error) {
    logger.error("storage", "Unexpected error validating token", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Delete an invite link (for manual management only)
 *
 * NOTE: This function is provided for manual invite management but is not
 * currently used in the app. Supabase handles automatic cleanup of expired
 * invites, and CASCADE deletion handles cleanup when worlds/users are deleted.
 * Keep this function for future features like invite management UI.
 */
export async function deleteInviteLink(
  token: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    logger.info("storage", `Deleting invite link: ${token}`);

    const { error } = await supabase
      .schema('worlds')
      .rpc('delete_invite_link', {
        p_token: token,
      });

    if (error) {
      logger.error("storage", "Failed to delete invite link", error);
      return { success: false, error: error.message };
    }

    logger.success("Invite link deleted successfully");

    return { success: true };
  } catch (error) {
    logger.error("storage", "Unexpected error deleting invite link", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get all active invite links for a world (for management UI)
 * Uses RequestManager for deduplication and retry
 */
export async function getWorldInviteLinks(
  worldId: string,
): Promise<{ success: boolean; invites?: InviteLink[]; error?: string }> {
  try {
    logger.info("storage", `Fetching invite links for world: ${worldId}`);

    const data = await RequestManager.fetch(
      `invites:world:${worldId}`,
      async () => {
        const { data, error } = await supabase
          .schema('worlds')
          .from('invite_links')
          .select("*")
          .eq("world_id", worldId)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false });

        if (error) {
          logger.error("storage", "Failed to fetch invite links", error);
          throw new Error(error.message);
        }

        return data;
      },
      {
        dedupe: true,
        retries: 2,
        timeout: 15000,
        authStrategy: "user",
      },
    );

    // Ensure data is always an array, even if null from failOpen
    const invites = Array.isArray(data) ? data : [];

    logger.info("storage", `Found ${invites.length} active invite links`);

    return {
      success: true,
      invites,
    };
  } catch (error) {
    logger.error("storage", "Unexpected error fetching invite links", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Export as invitesDB for consistency with other database modules
export const invitesDB = {
  createInviteLink,
  validateInviteToken,
  deleteInviteLink,
  getWorldInviteLinks,
};
