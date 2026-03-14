import { useModal } from "@/contexts";
import { worldsDB } from "@/lib/database";
import { logger } from "@/lib/utils/logger";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

interface WorldFormData {
  name: string;
  description: string;
  system: string;
  mapImageUrl?: string;
}

type CurrentModalType = "sign-in" | "validation" | "success" | null;

export function useWorldCreation() {
  const { openModal, closeModal } = useModal();

  // Creation state
  const [isCreating, setIsCreating] = useState(false);
  const [successWorldName, setSuccessWorldName] = useState("");
  const [successWorldId, setSuccessWorldId] = useState("");

  // Modal state
  const [currentModalType, setCurrentModalType] = useState<CurrentModalType>(null);

  // Store callback for success navigation (set by screen via registerSuccessCallback)
  const successNavigateCallback = useRef<(() => void) | null>(null);

  // Modal control functions (defined before use in effect)
  const closeSignInModal = useCallback(() => {
    closeModal();
    setCurrentModalType(null);
  }, [closeModal]);

  const closeValidationModal = useCallback(() => {
    closeModal();
    setCurrentModalType(null);
  }, [closeModal]);

  const closeSuccessModal = useCallback(() => {
    closeModal();
    setCurrentModalType(null);
    setSuccessWorldName("");
    setSuccessWorldId("");
  }, [closeModal]);

  const showSignInModal = useCallback(() => {
    setCurrentModalType("sign-in");
  }, []);

  const showValidationModal = useCallback(() => {
    setCurrentModalType("validation");
  }, []);

  // Update modal whenever state changes
  useEffect(() => {
    if (currentModalType === "sign-in") {
      openModal("create-world-sign-in", {
        onClose: closeSignInModal,
      });
    } else if (currentModalType === "validation") {
      openModal("create-world-validation", {
        onClose: closeValidationModal,
      });
    } else if (currentModalType === "success") {
      openModal("create-world-success", {
        successWorldName,
        onClose: closeSuccessModal,
        onSuccessNavigate: () => {
          successNavigateCallback.current?.();
          closeSuccessModal();
        },
      });
    }
  }, [
    currentModalType,
    successWorldName,
    openModal,
    closeSignInModal,
    closeValidationModal,
    closeSuccessModal,
  ]);

  const createWorld = async (formData: WorldFormData) => {
    setIsCreating(true);

    try {
      const newWorld = await worldsDB.create({
        name: formData.name.trim(),
        description: formData.description.trim() || "",
        system: formData.system,
        is_dm: true, // World creators are always DMs
        map_image_url: formData.mapImageUrl || "", // Use empty string as default - maps can be added later
      });

      // Capture the world details for success modal and navigation
      setSuccessWorldName(newWorld.name);
      setSuccessWorldId(newWorld.world_id);
      setCurrentModalType("success");

      return { success: true, world: newWorld };
    } catch (error) {
      logger.category("storage").error("Create world error:", error);
      Alert.alert(
        "Error",
        "Failed to create world. Please check your connection and try again.",
      );
      return { success: false, error };
    } finally {
      setIsCreating(false);
    }
  };

  // Allow screen to register the navigation callback
  const registerSuccessNavigate = useCallback((callback: () => void) => {
    successNavigateCallback.current = callback;
  }, []);

  return {
    isCreating,
    successWorldName,
    successWorldId,
    createWorld,
    showSignInModal,
    closeSignInModal,
    showValidationModal,
    closeValidationModal,
    closeSuccessModal,
    registerSuccessNavigate,
  };
}
