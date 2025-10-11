import { supabase } from '../supabase';
import { logger } from '../utils';

/**
 * Database operations for invite links
 */

interface InviteLink {
  id: string;
  world_id: string;
  created_by: string;
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
  params: CreateInviteLinkParams
): Promise<{ success: boolean; inviteLink?: InviteLink; error?: string }> {
  try {
    const { worldId, hoursValid = 24 } = params;

    // Get current user for created_by field
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      logger.error('invites', 'User not authenticated', userError);
      return { success: false, error: 'User not authenticated' };
    }

    // IMPORTANT: created_by references public.users(id) (profile id),
    // not the auth user's id. Look up the profile by auth_id first.
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (profileError || !profile) {
      logger.error('invites', 'User profile not found for auth user', profileError);
      return { success: false, error: 'User profile not found' };
    }

    // Calculate custom expiration if not using default 24 hours
    const insertData: any = {
      world_id: worldId,
      created_by: profile.id, // Use profile ID to satisfy FK to users(id)
    };

    // Only set custom expiration if different from default
    if (hoursValid !== 24) {
      const expiresAt = new Date(Date.now() + hoursValid * 60 * 60 * 1000);
      insertData.expires_at = expiresAt.toISOString();
    }

    logger.info('invites', `Creating invite link for world ${worldId}`, { hoursValid });

    // Insert and let Supabase generate token and default expiration
    const { data, error } = await supabase
      .from('invite_links')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      logger.error('invites', 'Failed to create invite link', error);
      return { success: false, error: error.message };
    }

    if (!data) {
      logger.error('invites', 'No data returned from insert');
      return { success: false, error: 'Failed to create invite link' };
    }

    logger.success(`Invite link created with token: ${data.token}`);
    
    return { 
      success: true, 
      inviteLink: data as InviteLink 
    };

  } catch (error) {
    logger.error('invites', 'Unexpected error creating invite link', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Validate an invite token and get the associated world
 */
export async function validateInviteToken(
  token: string
): Promise<{ success: boolean; worldId?: string; error?: string }> {
  try {
    logger.info('invites', `Validating invite token: ${token}`);

    const { data, error } = await supabase
      .from('invite_links')
      .select('world_id, expires_at')
      .eq('token', token)
      .single();

    if (error) {
      logger.error('invites', 'Invalid invite token', error);
      return { success: false, error: 'Invalid or expired invite link' };
    }

    if (!data) {
      logger.error('invites', 'No invite found for token');
      return { success: false, error: 'Invalid invite link' };
    }

    // Check if expired
    const expiresAt = new Date(data.expires_at);
    if (expiresAt < new Date()) {
      logger.warn('invites', 'Invite token expired', { expiresAt });
      return { success: false, error: 'This invite link has expired' };
    }

    logger.success(`Valid invite token for world: ${data.world_id}`);
    
    return { 
      success: true, 
      worldId: data.world_id 
    };

  } catch (error) {
    logger.error('invites', 'Unexpected error validating token', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
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
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    logger.info('invites', `Deleting invite link: ${token}`);

    const { error } = await supabase
      .from('invite_links')
      .delete()
      .eq('token', token);

    if (error) {
      logger.error('invites', 'Failed to delete invite link', error);
      return { success: false, error: error.message };
    }

    logger.success('Invite link deleted successfully');
    
    return { success: true };

  } catch (error) {
    logger.error('invites', 'Unexpected error deleting invite link', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Get all active invite links for a world (for management UI)
 */
export async function getWorldInviteLinks(
  worldId: string
): Promise<{ success: boolean; invites?: InviteLink[]; error?: string }> {
  try {
    logger.info('invites', `Fetching invite links for world: ${worldId}`);

    const { data, error } = await supabase
      .from('invite_links')
      .select('*')
      .eq('world_id', worldId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('invites', 'Failed to fetch invite links', error);
      return { success: false, error: error.message };
    }

    logger.info('invites', `Found ${data?.length || 0} active invite links`);
    
    return { 
      success: true, 
      invites: (data as InviteLink[]) || [] 
    };

  } catch (error) {
    logger.error('invites', 'Unexpected error fetching invite links', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Export as invitesDB for consistency with other database modules
export const invitesDB = {
  createInviteLink,
  validateInviteToken,
  deleteInviteLink,
  getWorldInviteLinks
};
