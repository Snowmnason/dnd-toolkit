import {
  generateWorldInviteLink,
  logger,
  usersDB,
  worldsDB,
} from "@/lib/";
import { validateWorldName } from "@/validation";
import { useState } from "react";

interface UseWorldModalOptions {
  onWorldsChange?: () => void; // Callback to refresh worlds list
}

export const useWorldModal = (options?: UseWorldModalOptions) => {
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [modalWorldName, setModalWorldName] = useState<string>("");
  const [leaveModalVisible, setLeaveModalVisible] = useState<boolean>(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  // Modal handlers
  const handleConfirmWorldName = async (
    worldId?: string,
    newWorldName?: string,
    userId?: string,
  ) => {
    logger.category('ui').debug("Confirm world name:", newWorldName);
    if (!worldId) {
      logger.category('ui').error("No worldId provided for update");
      return;
    }
    if (!newWorldName || newWorldName.trim().length === 0) {
      logger.category('ui').warn("World name cannot be empty");
      return;
    }

    // Validate/sanitize the provided name
    const { isValid, sanitizedName, errors } = validateWorldName(newWorldName);
    if (!isValid) {
      logger.category('ui').warn("World name validation failed:", errors.join("; "));
      return;
    }

    try {
      await worldsDB.updateName(worldId, sanitizedName);
      // Close modal and reset state on success
      setEditModalVisible(false);
      setModalWorldName("");
      // Refresh worlds list to show updated name
      options?.onWorldsChange?.();
    } catch (error) {
      logger.category('ui').error("Failed to update world name:", error);
    }
  };

  // Create wrapper functions that include worldId and worldName
  const createGenerateInviteLinkHandler =
    (worldId?: string, worldName?: string) => async (): Promise<void> => {
      logger.category('ui').debug("Generate invite link for world:", worldName);

      if (!worldId) {
        logger.category('ui').error("No worldId provided for invite");
        return;
      }
      setGeneratingLink(true);
      try {
        const result = await generateWorldInviteLink(
          worldId,
          worldName || "Unnamed World",
        );

        if (result.success) {
          logger.category('ui').info(
            "Invite link generated and copied to clipboard!",
          );
          // Optionally clear the email field since we're not using email anymore
        } else {
          logger.category('ui').error("Failed to generate invite link:", result.error);
          // Do not throw to avoid crashing the UI
        }
      } catch (error) {
        logger.category('ui').error("Failed to generate invite link:", error);
        // Swallow error to prevent unhandled rejection in UI
      } finally {
        // Allow user to try again
        setGeneratingLink(false);
      }
    };

  const createDeleteWorldHandler =
    (worldId?: string, userId?: string) => async (): Promise<void> => {
      logger.category('ui').debug("Delete world (owner):", worldId);

      if (!worldId) {
        logger.category('ui').error("No worldId provided for delete");
        return;
      }

      try {
        // validateUserForWrite() in worldsDB.delete() handles user validation
        await worldsDB.delete(worldId);
        logger.category('ui').info("World deleted:", worldId);
        setEditModalVisible(false);
        // Refresh worlds list to remove deleted world
        options?.onWorldsChange?.();
      } catch (error) {
        logger.category('ui').error("Failed to delete world:", error);
        // Avoid throwing to prevent UI crash
      }
    };

  const createRemoveFromWorldHandler =
    (worldId?: string, userId?: string) => async (): Promise<void> => {
      logger.category('ui').debug("Remove from world:", worldId);

      if (!worldId) {
        logger.category('ui').error("No worldId provided for remove");
        return;
      }

      let currentUserId = userId;
      if (!currentUserId) {
        const currentUser = await usersDB.getCurrentUser();
        if (!currentUser?.id) {
          logger.category('ui').error("No user ID available for remove operation");
          return;
        }
        currentUserId = currentUser.id;
      }

      try {
        await worldsDB.removeUserFromWorld(worldId, currentUserId);
        logger.category('ui').info("Removed from world:", worldId);
        setLeaveModalVisible(false);
        // Refresh worlds list to remove left world
        options?.onWorldsChange?.();
      } catch (error) {
        logger.category('ui').error("Failed to remove from world:", error);
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
    setModalWorldName("");
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
