import { useModal } from "@/contexts";
import {
  generateWorldInviteLink,
  logger,
  usersDB,
  worldsDB,
} from "@/lib/";
import { validateWorldName } from "@/validation";
import { useEffect, useState } from "react";

interface UseWorldModalOptions {
  onWorldsChange?: () => void; // Callback to refresh worlds list
}

type CurrentModalType = "edit-world" | "leave-world" | null;

export const useWorldModal = (options?: UseWorldModalOptions) => {
  const { openModal, closeModal } = useModal();

  // Modal state
  const [currentModalType, setCurrentModalType] = useState<CurrentModalType>(null);
  const [modalWorldName, setModalWorldName] = useState<string>("");
  const [generatingLink, setGeneratingLink] = useState(false);
  const [currentWorldId, setCurrentWorldId] = useState<string | undefined>();
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [originalWorldName, setOriginalWorldName] = useState<string | undefined>();

  // Update modal props whenever state changes
  useEffect(() => {
    if (currentModalType === "edit-world") {
      openModal("edit-world", {
        worldName: modalWorldName,
        originalWorldName,
        onWorldNameChange: setModalWorldName,
        onConfirmWorldName: () =>
          handleConfirmWorldName(currentWorldId, modalWorldName, currentUserId),
        onGenerateInviteLink: createGenerateInviteLinkHandler(
          currentWorldId,
          modalWorldName,
        ),
        onDeleteWorld: createDeleteWorldHandler(currentWorldId, currentUserId),
        generatingLink,
      });
    } else if (currentModalType === "leave-world") {
      openModal("confirm-leave", {
        worldName: modalWorldName,
        onConfirmLeave: createRemoveFromWorldHandler(currentWorldId, currentUserId),
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentModalType, modalWorldName, generatingLink, originalWorldName, currentWorldId, currentUserId]);

  // Modal handlers
  const handleConfirmWorldName = async (
    worldId?: string,
    newWorldName?: string,
    userId?: string,
  ) => {
    logger.category("ui").debug("Confirm world name:", newWorldName);
    if (!worldId) {
      logger.category("ui").error("No worldId provided for update");
      return;
    }
    if (!newWorldName || newWorldName.trim().length === 0) {
      logger.category("ui").warn("World name cannot be empty");
      return;
    }

    // Validate/sanitize the provided name
    const { isValid, sanitizedName, errors } = validateWorldName(newWorldName);
    if (!isValid) {
      logger.category("ui").warn("World name validation failed:", errors.join("; "));
      return;
    }

    try {
      await worldsDB.updateName(worldId, sanitizedName);
      // Close modal and reset state on success
      closeModal();
      setCurrentModalType(null);
      setModalWorldName("");
      setCurrentWorldId(undefined);
      setCurrentUserId(undefined);
      // Refresh worlds list to show updated name
      options?.onWorldsChange?.();
    } catch (error) {
      logger.category("ui").error("Failed to update world name:", error);
    }
  };

  // Create wrapper functions that include worldId and worldName
  const createGenerateInviteLinkHandler =
    (worldId?: string, worldName?: string) => async (): Promise<void> => {
      logger.category("ui").debug("Generate invite link for world:", worldName);

      if (!worldId) {
        logger.category("ui").error("No worldId provided for invite");
        return;
      }
      setGeneratingLink(true);
      try {
        const result = await generateWorldInviteLink(
          worldId,
          worldName || "Unnamed World",
        );

        if (result.success) {
          logger.category("ui").info(
            "Invite link generated and copied to clipboard!",
          );
          // Optionally clear the email field since we're not using email anymore
        } else {
          logger.category("ui").error("Failed to generate invite link:", result.error);
          // Do not throw to avoid crashing the UI
        }
      } catch (error) {
        logger.category("ui").error("Failed to generate invite link:", error);
        // Swallow error to prevent unhandled rejection in UI
      } finally {
        // Allow user to try again
        setGeneratingLink(false);
      }
    };

  const createDeleteWorldHandler =
    (worldId?: string, userId?: string) => async (): Promise<void> => {
      logger.category("ui").debug("Delete world (owner):", worldId);

      if (!worldId) {
        logger.category("ui").error("No worldId provided for delete");
        return;
      }

      try {
        // validateUserForWrite() in worldsDB.delete() handles user validation
        await worldsDB.delete(worldId);
        logger.category("ui").info("World deleted:", worldId);
        closeModal();
        setCurrentModalType(null);
        setModalWorldName("");
        setCurrentWorldId(undefined);
        setCurrentUserId(undefined);
        // Refresh worlds list to remove deleted world
        options?.onWorldsChange?.();
      } catch (error) {
        logger.category("ui").error("Failed to delete world:", error);
        // Avoid throwing to prevent UI crash
      }
    };

  const createRemoveFromWorldHandler =
    (worldId?: string, userId?: string) => async (): Promise<void> => {
      logger.category("ui").debug("Remove from world:", worldId);

      if (!worldId) {
        logger.category("ui").error("No worldId provided for remove");
        return;
      }

      let currentUserId_ = userId;
      if (!currentUserId_) {
        const currentUser = await usersDB.getCurrentUser();
        if (!currentUser?.id) {
          logger.category("ui").error("No user ID available for remove operation");
          return;
        }
        currentUserId_ = currentUser.id;
      }

      try {
        await worldsDB.removeUserFromWorld(worldId, currentUserId_);
        logger.category("ui").info("Removed from world:", worldId);
        closeModal();
        setCurrentModalType(null);
        setModalWorldName("");
        setCurrentWorldId(undefined);
        setCurrentUserId(undefined);
        // Refresh worlds list to remove left world
        options?.onWorldsChange?.();
      } catch (error) {
        logger.category("ui").error("Failed to remove from world:", error);
        // Avoid throwing to prevent UI crash
      }
    };

  const openEditModal = (worldName: string, worldId?: string) => {
    setModalWorldName(worldName);
    setOriginalWorldName(worldName);
    setCurrentWorldId(worldId);
    setGeneratingLink(false); // Reset generatingLink state when opening modal
    setCurrentModalType("edit-world");
  };

  const closeEditModal = () => {
    closeModal();
    setCurrentModalType(null);
    setModalWorldName("");
    setCurrentWorldId(undefined);
  };

  const openLeaveModal = (worldName: string, worldId?: string) => {
    setModalWorldName(worldName);
    setCurrentWorldId(worldId);
    setCurrentModalType("leave-world");
  };

  const closeLeaveModal = () => {
    closeModal();
    setCurrentModalType(null);
    setModalWorldName("");
    setCurrentWorldId(undefined);
  };

  return {
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
