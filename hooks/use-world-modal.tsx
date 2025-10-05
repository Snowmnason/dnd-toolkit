import { useState } from 'react';
import { generateWorldInviteLink } from '../lib/auth/authService';

interface UseWorldModalProps {
  onWorldNameUpdate?: (worldId: string, newName: string) => Promise<void> | void;
  onDeleteWorld?: (worldId: string) => Promise<void> | void;
  onRemoveFromWorld?: (worldId: string) => Promise<void> | void;
}

export const useWorldModal = ({
  onWorldNameUpdate,
  onDeleteWorld,
  onRemoveFromWorld,
}: UseWorldModalProps = {}) => {
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [modalWorldName, setModalWorldName] = useState<string>('');
  const [modalInviteEmail, setModalInviteEmail] = useState<string>('');

  // Modal handlers
  const handleConfirmWorldName = async (worldId?: string) => {
    console.log('Confirm world name:', modalWorldName);
    
    if (onWorldNameUpdate && worldId) {
      try {
        await onWorldNameUpdate(worldId, modalWorldName);
      } catch (error) {
        console.error('Failed to update world name:', error);
      }
    }
    // TODO: Implement default world name update logic if no custom handler provided
  };

  // Create wrapper functions that include worldId and worldName
  const createGenerateInviteLinkHandler = (worldId?: string, worldName?: string) => async (): Promise<void> => {
    console.log('Generate invite link for world:', worldName);
    
    if (!worldId) {
      throw new Error('No worldId provided for invite');
    }

    try {
      const result = await generateWorldInviteLink(
        worldId, 
        worldName || 'Unnamed World'
      );
      
      if (result.success) {
        console.log('✅ Invite link generated and copied to clipboard!');
        // Optionally clear the email field since we're not using email anymore
        setModalInviteEmail('');
      } else {
        console.error('❌ Failed to generate invite link:', result.error);
        throw new Error(result.error || 'Failed to generate invite link');
      }
    } catch (error) {
      console.error('Failed to generate invite link:', error);
      throw error;
    }
  };

  const createDeleteWorldHandler = (worldId?: string) => async (): Promise<void> => {
    console.log('Delete world (owner):', worldId);
    
    if (!worldId) {
      throw new Error('No worldId provided for delete');
    }

    try {
      if (onDeleteWorld) {
        await onDeleteWorld(worldId);
      } else {
        // TODO: Implement default delete world logic
        console.log('🗑️ Would delete world:', worldId);
        // await worldsDB.deleteWorld(worldId);
      }
      setEditModalVisible(false);
    } catch (error) {
      console.error('Failed to delete world:', error);
      throw error;
    }
  };

  const createRemoveFromWorldHandler = (worldId?: string) => async (): Promise<void> => {
    console.log('Remove from world:', worldId);
    
    if (!worldId) {
      throw new Error('No worldId provided for remove');
    }

    try {
      if (onRemoveFromWorld) {
        await onRemoveFromWorld(worldId);
      } else {
        // TODO: Implement default remove from world logic
        console.log('🚪 Would remove user from world:', worldId);
        // await worldsDB.removeUserFromWorld(worldId, userId);
      }
    } catch (error) {
      console.error('Failed to remove from world:', error);
      throw error;
    }
  };

  const openEditModal = (worldName: string) => {
    setModalWorldName(worldName);
    setModalInviteEmail('');
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setModalWorldName('');
    setModalInviteEmail('');
  };

  return {
    // State
    editModalVisible,
    modalWorldName,
    modalInviteEmail,
    
    // State setters (for controlled components)
    setModalWorldName,
    setModalInviteEmail,
    
    // Actions
    openEditModal,
    closeEditModal,
    handleConfirmWorldName,
    
    // Handler creators (these return the actual handlers)
    createGenerateInviteLinkHandler,
    createDeleteWorldHandler,
    createRemoveFromWorldHandler,
  };
};