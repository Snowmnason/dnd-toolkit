/**
 * Invite System
 *
 * Centralizes world invite link generation and pending invite checks.
 *
 * Usage:
 *   // Generate an invite link
 *   const result = await performGenerateInviteLink(worldId, worldName);
 *   if (result.success) { shareLink(result.inviteLink); }
 *
 *   // Check for pending invites
 *   const invite = await performCheckPendingInvites();
 *   if (invite) { navigateToInvite(invite.token, invite.worldName); }
 */

import { StorageManager } from '@/lib/storage';
import { logger } from '@/lib/utils/logger';
import { STORAGE_KEYS } from '@/maps';

// ============================================================================
// GENERATE INVITE LINK
// ============================================================================

/**
 * Generate a world invite link with a Supabase-generated token.
 *
 * Creates a DB invite record, builds the full URL, and attempts clipboard copy.
 *
 * @param worldId - The world to invite to
 * @param worldName - Display name for the invite URL
 * @param hoursValid - How many hours the invite is valid (default: 24)
 * @returns Result with invite link or error
 */
export async function performGenerateInviteLink(
  worldId: string,
  worldName: string,
  hoursValid = 24,
): Promise<{ success: boolean; inviteLink?: string; error?: string }> {
  try {
    if (!worldId || !worldName) {
      return { success: false, error: 'World ID and name are required' };
    }

    const { invitesDB } = await import('@/lib/database/invites');

    const result = await invitesDB.createInviteLink({ worldId, hoursValid });

    if (!result.success || !result.inviteLink) {
      return { success: false, error: result.error || 'Failed to create invite link' };
    }

    const baseUrl =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'https://dnd-tool.thesnowpost.com';

    const inviteLink = `${baseUrl}/login/auth-redirect?action=world-invite&token=${result.inviteLink.token}&worldName=${encodeURIComponent(worldName)}`;

    // Try to copy to clipboard
    if (typeof window !== 'undefined' && window.navigator?.clipboard) {
      try {
        await window.navigator.clipboard.writeText(inviteLink);
        logger.category('auth').debug('Invite link copied to clipboard!');
      } catch {
        logger.category('auth').debug('Could not copy to clipboard automatically');
      }
    }

    logger.category('auth').info('World Invite Link Generated:', {
      world: worldName,
      token: result.inviteLink.token,
      expires: result.inviteLink.expires_at,
      link: inviteLink,
    });

    return { success: true, inviteLink };
  } catch (error) {
    logger.category('auth').error('Failed to generate invite link:', error);
    return { success: false, error: 'Failed to generate invite link' };
  }
}

// ============================================================================
// CHECK PENDING INVITES
// ============================================================================

/**
 * Check for a pending world invite stored in local storage.
 *
 * Returns the invite data if it exists and is less than 24 hours old.
 * Cleans up expired or invalid invite data automatically.
 *
 * @returns Pending invite with token and worldName, or null
 */
export async function performCheckPendingInvites(): Promise<{
  token: string;
  worldName: string;
} | null> {
  const stored = await StorageManager.getRaw(STORAGE_KEYS.PENDING_INVITE);
  if (stored) {
    try {
      const inviteData = JSON.parse(stored);
      // Check if invite is less than 24 hours old
      if (Date.now() - inviteData.timestamp < 24 * 60 * 60 * 1000) {
        return { token: inviteData.token, worldName: inviteData.worldName };
      } else {
        await StorageManager.remove(STORAGE_KEYS.PENDING_INVITE);
      }
    } catch (error) {
      logger.category('auth').error('Error parsing pending invite:', error);
      await StorageManager.remove(STORAGE_KEYS.PENDING_INVITE);
    }
  }
  return null;
}
