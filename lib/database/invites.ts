import { QueryCache } from "@/lib/middleware/storage/helpers/query-cache";
import { getInviteRepository } from "./repositories";

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
  const result = await getInviteRepository().create(params);

  if (result.success && result.data) {
    // Invalidate invite links cache for this world (caller cache responsibility)
    await QueryCache.invalidate(`world:${params.worldId}:invites`);
    return { success: true, inviteLink: result.data };
  }

  return { success: false, error: result.error };
}

/**
 * Validate an invite token and get the associated world
 */
export async function validateInviteToken(
  token: string,
): Promise<{ success: boolean; worldId?: string; error?: string }> {
  const result = await getInviteRepository().validate(token);

  if (result.success && result.data) {
    return { success: true, worldId: result.data };
  }

  return { success: false, error: result.error };
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
  const result = await getInviteRepository().delete(token);
  return { success: result.success, error: result.error };
}

/**
 * Get all active invite links for a world (for management UI)
 */
export async function getWorldInviteLinks(
  worldId: string,
): Promise<{ success: boolean; invites?: InviteLink[]; error?: string }> {
  const result = await getInviteRepository().listByWorld(worldId);

  if (result.success) {
    return { success: true, invites: result.data ?? [] };
  }

  return { success: false, error: result.error };
}

// Export as invitesDB for consistency with other database modules
export const invitesDB = {
  createInviteLink,
  validateInviteToken,
  deleteInviteLink,
  getWorldInviteLinks,
};
