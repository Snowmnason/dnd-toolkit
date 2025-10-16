import React from 'react';
import { Platform } from 'react-native';
import { Button, Text, YStack } from 'tamagui';
import { Spacing } from '../../constants/theme';
import CustomModal from '../modals/CustomModal';

interface SettingsMenuProps {
  visible: boolean;
  onClose: () => void;
  onAccountSettings: () => void;
  onReturnToWorldSelection: () => void;
}

export default function SettingsMenu({ 
  visible, 
  onClose, 
  onAccountSettings, 
  onReturnToWorldSelection 
}: SettingsMenuProps) {
  // Keep a subtle scale bump per platform while letting CustomModal handle spacing/layout
  const isDesktop = Platform.OS === 'web' || Platform.OS === 'windows' || Platform.OS === 'macos';
  const scale = isDesktop ? 1.25 : 1.0;

  return (
    <CustomModal
      visible={visible}
      onClose={onClose}
      title="Settings"
      buttons={[]}
    >
      <YStack style={{ minWidth: 260 * scale }} gap={Spacing.xs * scale}>
        <Button
          unstyled
          onPress={() => {
            onClose();
            onAccountSettings();
          }}
          style={{
            padding: Spacing.md * scale,
            borderRadius: 8,
            borderColor: 'rgba(117, 117, 117, 0.5)',
            borderWidth: 1,
          }}
        >
          <Text style={{ fontSize: 16 * scale, color: '#F5E6D3' /* UPDATE TO THEME */, textAlign: 'center' }}>
            Account Settings
          </Text>
        </Button>

        <Button
          unstyled
          onPress={() => {
            onClose();
            onReturnToWorldSelection();
          }}
          style={{
            padding: Spacing.md * scale,
            borderRadius: 8,
            backgroundColor: 'rgba(139, 115, 39, 0.1)',
          }}
        >
          <Text style={{ fontSize: 16 * scale, color: '#D4AF37' /* UPDATE TO THEME */, textAlign: 'center', fontWeight: '600' }}>
            Return to World Selection
          </Text>
        </Button>

        <Button
          unstyled
          onPress={onClose}
          style={{
            padding: Spacing.md * scale,
            borderRadius: 8,
            backgroundColor: 'rgba(139, 69, 19, 0.2)' /* UPDATE TO THEME */,
          }}
        >
          <Text style={{ fontSize: 16 * scale, color: '#F5E6D3' /* UPDATE TO THEME */, textAlign: 'center' }}>
            Cancel
          </Text>
        </Button>
      </YStack>
    </CustomModal>
  );
}