import { AppModal, Body, Button } from "@/components/ui";
import { registerModal } from "@/contexts";
import { $, useScale, UseTheme } from "@/theme";
import { View } from "react-native";

interface CreateWorldSuccessModalProps {
  successWorldName: string;
  onClose: () => void;
  onSuccessNavigate: () => void;
}

/**
 * ✨ CreateWorldSuccessModal
 * Displayed when world creation succeeds.
 */
export function CreateWorldSuccessModal({
  successWorldName,
  onClose,
  onSuccessNavigate,
}: CreateWorldSuccessModalProps) {
  const S = useScale();
  const { theme } = UseTheme();

  return (
    <AppModal
      visible={true}
      onClose={onClose}
      heading="World Created!"
      body={`Your world "${successWorldName}" has been successfully created.`}
      borderTone="accent"
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
        <Button text="Enter World" variant="primary" onPress={onSuccessNavigate} />
      </View>
      <Body
        style={{
          marginTop: S.space.sm,
          color: $("textSecondary", theme),
          textAlign: "right",
          fontSize: S.s(12),
        }}
      >
        Adventure awaits!
      </Body>
    </AppModal>
  );
}

// Register modal for centralized management
registerModal("create-world-success", CreateWorldSuccessModal);
