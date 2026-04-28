import { AppModal, Button } from "@/components/ui";
import { registerModal } from "@/contexts/modal-context";
import { useScale } from "@/theme";
import { View } from "react-native";

interface CreateWorldValidationModalProps {
  onClose: () => void;
}

/**
 * ⚠️ CreateWorldValidationModal
 * Displayed when form validation fails.
 */
export function CreateWorldValidationModal({
  onClose,
}: CreateWorldValidationModalProps) {
  const S = useScale();

  return (
    <AppModal
      visible={true}
      onClose={onClose}
      heading="Invalid World Name"
      body="Please enter a valid world name before continuing."
      borderTone="danger"
    >
      <View
        style={{
          width: "100%",
          flexDirection: "row",
          justifyContent: "flex-end",
          gap: S.space.sm,
          marginTop: S.space.md,
        }}
      >
        <Button text="Close" variant="secondary" onPress={onClose} />
      </View>
    </AppModal>
  );
}

// Register modal for centralized management
registerModal("create-world-validation", CreateWorldValidationModal);
