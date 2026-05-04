import { AppModal } from "@/components/ui/AppModal";
import { Button } from "@/components/ui/BaseButton";
import { registerModal, useModal } from "@/contexts/modal-context";
import { useSettingsActions } from "@/hooks/navigation/use-settings-actions";
import { useScale } from "@/theme";
import { View } from "react-native";

interface SettingsMenuProps {
  visible: boolean;
}

export default function SettingsModal({ visible }: SettingsMenuProps) {
  const S = useScale();
  const { closeModal } = useModal();
  const { handleAccountSettings, handleReturnToWorldSelection } = useSettingsActions();

  return (
    <AppModal
      visible={visible}
      onClose={closeModal}
      heading="Settings"
      borderTone="accent"
    >
      <View style={{ gap: S.space.md }}>
        {/* Return to World Selection */}
        <Button
          text="Return to World Selection"
          variant="outlined"
          onPress={handleReturnToWorldSelection}
        />
        {/* Account Settings */}
        <Button
          text="Account Settings"
          variant="secondary"
          onPress={handleAccountSettings}
        />

        {/* Cancel */}
        <Button text="Cancel" variant="cancel" onPress={closeModal} />
      </View>
    </AppModal>
  );
}

// Register modal for centralized management
registerModal('settings', SettingsModal)
