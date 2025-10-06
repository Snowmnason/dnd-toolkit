import { usersDB } from '@/lib/database/users';
import { worldsDB } from '@/lib/database/worlds';
import { useState } from 'react';
import { generateWorldInviteLink } from '../lib/auth/authService';


export const useWorldModal = () => {
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [modalWorldName, setModalWorldName] = useState<string>('');
  const [leaveModalVisible, setLeaveModalVisible] = useState<boolean>(false); 
  const [generatingLink, setGeneratingLink] = useState(false); 

  // Modal handlers
  const handleConfirmWorldName = async (worldId?: string, newWorldName?: string, userId?: string) => {
    console.log('Confirm world name:', modalWorldName);
    if (!worldId) {
      throw new Error('No worldId provided for invite');
    }
    if (!newWorldName || newWorldName.trim().length === 0) {
      throw new Error('World name cannot be empty');
    }
    let currentUserId = userId;
    if (!currentUserId) {
      const currentUser = await usersDB.getCurrentUser();
      if (!currentUser?.id) {
        throw new Error('No user ID available for delete operation');
      }
      currentUserId = currentUser.id;
    }

    try {
      await worldsDB.updateName(worldId, currentUserId, newWorldName);
    } catch (error) {
      console.error('Failed to update world name:', error);
    }
    // TODO: Implement default world name update logic if no custom handler provided
  };

  // Create wrapper functions that include worldId and worldName
  const createGenerateInviteLinkHandler = (worldId?: string, worldName?: string) => async (): Promise<void> => {
    console.log('Generate invite link for world:', worldName);
    
    if (!worldId) {
      throw new Error('No worldId provided for invite');
    }
    setGeneratingLink(true);
    try {
      const result = await generateWorldInviteLink(
        worldId, 
        worldName || 'Unnamed World'
      );
      
      if (result.success) {
        console.log('✅ Invite link generated and copied to clipboard!');
        // Optionally clear the email field since we're not using email anymore
      } else {
        console.error('❌ Failed to generate invite link:', result.error);
        throw new Error(result.error || 'Failed to generate invite link');
      }
    } catch (error) {
      console.error('Failed to generate invite link:', error);
      throw error;
    }
    // Note: generatingLink stays true until modal is reopened (prevents spam clicking)
  };

  const createDeleteWorldHandler = (worldId?: string, userId?: string) => async (): Promise<void> => {
    console.log('Delete world (owner):', worldId);
    
    if (!worldId) {
      throw new Error('No worldId provided for delete');
    }
    
    let currentUserId = userId;
    if (!currentUserId) {
      const currentUser = await usersDB.getCurrentUser();
      if (!currentUser?.id) {
        throw new Error('No user ID available for delete operation');
      }
      currentUserId = currentUser.id;
    }
    
    try {
      await worldsDB.delete(worldId, currentUserId);
      console.log('World deleted:', worldId);
      setEditModalVisible(false);
    } catch (error) {
      console.error('Failed to delete world:', error);
      throw error;
    }
  };

  const createRemoveFromWorldHandler = (worldId?: string, userId?: string) => async (): Promise<void> => {
    console.log('Remove from world:', worldId);
    
    if (!worldId) {
      throw new Error('No worldId provided for remove');
    }
    
    let currentUserId = userId;
    if (!currentUserId) {
      const currentUser = await usersDB.getCurrentUser();
      if (!currentUser?.id) {
        throw new Error('No user ID available for remove operation');
      }
      currentUserId = currentUser.id;
    }

    try {
        await worldsDB.removeUserFromWorld(worldId, currentUserId);
        console.log('Removed from world:', worldId);
        setLeaveModalVisible(false);
    } catch (error) {
      console.error('Failed to remove from world:', error);
      throw error;
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