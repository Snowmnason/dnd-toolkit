import { AppModal } from "@/components/ui/AppModal";
import { Button } from "@/components/ui/BaseButton";
import { registerModal } from "@/contexts";
import { useScale } from "@/theme";
import { View } from "react-native";

interface SettingsMenuProps {
  visible: boolean;
  onClose: () => void;
  onAccountSettings: () => void;
  onReturnToWorldSelection: () => void;
}

export default function SettingsModal({
  visible,
  onClose,
  onAccountSettings,
  onReturnToWorldSelection,
}: SettingsMenuProps) {
  const S = useScale();

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      heading="Settings"
      borderTone="accent"
    >
      <View style={{ gap: S.space.md }}>
        {/* Return to World Selection */}
        <Button
          text="Return to World Selection"
          variant="outlined"
          onPress={() => {
            onClose();
            onReturnToWorldSelection();
          }}
        />
        {/* Account Settings */}
        <Button
          text="Account Settings"
          variant="secondary"
          onPress={() => {
            onClose();
            onAccountSettings();
          }}
        />

        {/* Cancel */}
        <Button text="Cancel" variant="cancel" onPress={onClose} />
      </View>
    </AppModal>
  );
}

// Register modal for centralized management
registerModal('settings', SettingsModal)
