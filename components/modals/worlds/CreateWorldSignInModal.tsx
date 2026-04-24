import { AppModal, Button } from "@/components/ui";
import { registerModal } from "@/contexts/modal-context";
import { useScale } from "@/theme";
import { View } from "react-native";

interface CreateWorldSignInModalProps {
  onClose: () => void;
}

/**
 * 🔐 CreateWorldSignInModal
 * Displayed when user tries to create a world without being signed in.
 */
export function CreateWorldSignInModal({
  onClose,
}: CreateWorldSignInModalProps) {
  const S = useScale();

  return (
    <AppModal
      visible={true}
      onClose={onClose}
      heading="Sign In Required"
      body="You must be signed in to create a world."
      borderTone="warning"
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
registerModal("create-world-sign-in", CreateWorldSignInModal);
