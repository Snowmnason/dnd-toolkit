import React from 'react';
import { Platform, TouchableOpacity, View } from 'react-native';
import { CoreColors, Spacing } from '../constants/theme';
import CustomModal from './CustomModal';
import { ThemedText } from './themed-text';

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
      <View style={{ minWidth: 260 * scale }}>
        <TouchableOpacity
          style={{
            padding: Spacing.md * scale,
            borderRadius: 8,
            marginBottom: Spacing.xs * scale,
            borderColor: 'rgba(117, 117, 117, 0.5)',
            borderWidth: 1,
          }}
          onPress={() => {
            onClose();
            onAccountSettings();
          }}
        >
          <ThemedText style={{
            fontSize: 16 * scale,
            color: CoreColors.textOnLight,
            textAlign: 'center',
          }}>
            Account Settings
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            padding: Spacing.md * scale,
            borderRadius: 8,
            backgroundColor: 'rgba(139, 115, 39, 0.1)',
            marginBottom: Spacing.sm * scale,
          }}
          onPress={() => {
            onClose();
            onReturnToWorldSelection();
          }}
        >
          <ThemedText style={{
            fontSize: 16 * scale,
            color: CoreColors.secondary,
            textAlign: 'center',
            fontWeight: '600',
          }}>
            Return to World Selection
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            padding: Spacing.md * scale,
            borderRadius: 8,
            backgroundColor: CoreColors.primaryTransparent,
          }}
          onPress={onClose}
        >
          <ThemedText style={{
            fontSize: 16 * scale,
            color: CoreColors.textOnLight,
            textAlign: 'center',
          }}>
            Cancel
          </ThemedText>
        </TouchableOpacity>
      </View>
    </CustomModal>
  );
}