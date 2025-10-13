import { validateWorldName } from '@/lib/auth/validation';
import { usersDB } from '@/lib/database/users';
import { worldsDB } from '@/lib/database/worlds';
import { logger } from '@/lib/utils/logger';
import { useState } from 'react';
import { generateWorldInviteLink } from '../lib/auth/authService';

interface UseWorldModalOptions {
  onWorldsChange?: () => void; // Callback to refresh worlds list
}

export const useWorldModal = (options?: UseWorldModalOptions) => {
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [modalWorldName, setModalWorldName] = useState<string>('');
  const [leaveModalVisible, setLeaveModalVisible] = useState<boolean>(false); 
  const [generatingLink, setGeneratingLink] = useState(false); 

  // Modal handlers
  const handleConfirmWorldName = async (worldId?: string, newWorldName?: string, userId?: string) => {
    logger.debug('world-modal', 'Confirm world name:', newWorldName);
    if (!worldId) {
      logger.error('world-modal', 'No worldId provided for update');
      return;
    }
    if (!newWorldName || newWorldName.trim().length === 0) {
      logger.warn('world-modal', 'World name cannot be empty');
      return;
    }

    // Validate/sanitize the provided name
    const { isValid, sanitizedName, errors } = validateWorldName(newWorldName);
    if (!isValid) {
      logger.warn('world-modal', 'World name validation failed:', errors.join('; '));
      return;
    }

    let currentUserId = userId;
    if (!currentUserId) {
      const currentUser = await usersDB.getCurrentUser();
      if (!currentUser?.id) {
        logger.error('world-modal', 'No user ID available for update operation');
        return;
      }
      currentUserId = currentUser.id;
    }

    try {
      await worldsDB.updateName(worldId, currentUserId, sanitizedName);
      // Close modal and reset state on success
      setEditModalVisible(false);
      setModalWorldName('');
      // Refresh worlds list to show updated name
      options?.onWorldsChange?.();
    } catch (error) {
      logger.error('world-modal', 'Failed to update world name:', error);
    }
  };

  // Create wrapper functions that include worldId and worldName
  const createGenerateInviteLinkHandler = (worldId?: string, worldName?: string) => async (): Promise<void> => {
    logger.debug('world-modal', 'Generate invite link for world:', worldName);
    
    if (!worldId) {
      logger.error('world-modal', 'No worldId provided for invite');
      return;
    }
    setGeneratingLink(true);
    try {
      const result = await generateWorldInviteLink(
        worldId, 
        worldName || 'Unnamed World'
      );
      
      if (result.success) {
        logger.success('world-modal', 'Invite link generated and copied to clipboard!');
        // Optionally clear the email field since we're not using email anymore
      } else {
        logger.error('world-modal', 'Failed to generate invite link:', result.error);
        // Do not throw to avoid crashing the UI
      }
    } catch (error) {
      logger.error('world-modal', 'Failed to generate invite link:', error);
      // Swallow error to prevent unhandled rejection in UI
    } finally {
      // Allow user to try again
      setGeneratingLink(false);
    }
    // Note: generatingLink stays true until modal is reopened (prevents spam clicking)
  };

  const createDeleteWorldHandler = (worldId?: string, userId?: string) => async (): Promise<void> => {
    logger.debug('world-modal', 'Delete world (owner):', worldId);
    
    if (!worldId) {
      logger.error('world-modal', 'No worldId provided for delete');
      return;
    }
    
    let currentUserId = userId;
    if (!currentUserId) {
      const currentUser = await usersDB.getCurrentUser();
      if (!currentUser?.id) {
        logger.error('world-modal', 'No user ID available for delete operation');
        return;
      }
      currentUserId = currentUser.id;
    }
    
    try {
      await worldsDB.delete(worldId, currentUserId);
      logger.info('world-modal', 'World deleted:', worldId);
      setEditModalVisible(false);
      // Refresh worlds list to remove deleted world
      options?.onWorldsChange?.();
    } catch (error) {
      logger.error('world-modal', 'Failed to delete world:', error);
      // Avoid throwing to prevent UI crash
    }
  };

  const createRemoveFromWorldHandler = (worldId?: string, userId?: string) => async (): Promise<void> => {
    logger.debug('world-modal', 'Remove from world:', worldId);
    
    if (!worldId) {
      logger.error('world-modal', 'No worldId provided for remove');
      return;
    }
    
    let currentUserId = userId;
    if (!currentUserId) {
      const currentUser = await usersDB.getCurrentUser();
      if (!currentUser?.id) {
        logger.error('world-modal', 'No user ID available for remove operation');
        return;
      }
      currentUserId = currentUser.id;
    }

    try {
        await worldsDB.removeUserFromWorld(worldId, currentUserId);
        logger.info('world-modal', 'Removed from world:', worldId);
        setLeaveModalVisible(false);
        // Refresh worlds list to remove left world
        options?.onWorldsChange?.();
    } catch (error) {
      logger.error('world-modal', 'Failed to remove from world:', error);
      // Avoid throwing to prevent UI crash
    }
  };

  const openEditModal = (worldName: string) => {
    setModalWorldName(worldName);
    setEditModalVisible(true);
    setGeneratingLink(false); // Reset generatingLink state when opening modal
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setModalWorldName('');
    };

    const openLeaveModal = (worldName: string) => {
    setModalWorldName(worldName);
    setLeaveModalVisible(true);
  };

  const closeLeaveModal = () => {
    setLeaveModalVisible(false);
  };

  return {
    // State
    editModalVisible,
    leaveModalVisible,
    modalWorldName,
    generatingLink,
    
    // State setters (for controlled components)
    setModalWorldName,
    setGeneratingLink,
    
    // Actions
    openEditModal,
    closeEditModal,
    openLeaveModal,
    closeLeaveModal,
    handleConfirmWorldName,
    
    // Handler creators (these return the actual handlers)
    createGenerateInviteLinkHandler,
    createDeleteWorldHandler,
    createRemoveFromWorldHandler,
  };
};