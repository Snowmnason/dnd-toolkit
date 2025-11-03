import { AppModal, Button } from "@/components/ui";
import { useScale } from "@/theme";
import React from "react";
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
        {/* Account Settings */}
        <Button
          text="Account Settings"
          variant="secondary"
          onPress={() => {
            onClose();
            onAccountSettings();
          }}
        />

        {/* Return to World Selection */}
        <Button
          text="Return to World Selection"
          variant="outlined"
          onPress={() => {
            onClose();
            onReturnToWorldSelection();
          }}
        />

        {/* Cancel */}
        <Button text="Cancel" variant="cancel" onPress={onClose} />
      </View>
    </AppModal>
  );
}
