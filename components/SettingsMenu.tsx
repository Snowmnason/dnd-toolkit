import React from 'react';
import { Modal, Platform, TouchableOpacity, View } from 'react-native';
import { CoreColors, Spacing } from '../constants/theme';
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
  // Make it bigger!
  const isDesktop = Platform.OS === 'web' || Platform.OS === 'windows' || Platform.OS === 'macos';
  const scale = isDesktop ? 2 : 1.6; // Slightly more reasonable scaling
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal={true}
    >
      <TouchableOpacity 
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          alignItems: 'center',
        }}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={{
          backgroundColor: CoreColors.backgroundLight,
          borderRadius: 12,
          padding: Spacing.lg * scale,
          minWidth: 200 * scale,
          borderWidth: 2,
          borderColor: CoreColors.secondary,
        }}>
          <ThemedText style={{
            fontSize: 18 * (isDesktop ? 1.3 : 1.1),
            fontWeight: 'bold',
            marginBottom: Spacing.md * scale,
            textAlign: 'center',
            color: CoreColors.textOnLight,
          }}>
            Settings
          </ThemedText>
          
          <TouchableOpacity
            style={{
              padding: Spacing.sm * scale,
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
              fontSize: 16 * (isDesktop ? 1.2 : 1.05),
              color: CoreColors.textOnLight,
              textAlign: 'center',
            }}>
              Account Settings
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              padding: Spacing.sm * scale,
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
              fontSize: 16 * (isDesktop ? 1.2 : 1.05),
              color: CoreColors.secondary,
              textAlign: 'center',
              fontWeight: '600',
            }}>
              Return to World Selection
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              padding: Spacing.sm * scale,
              borderRadius: 8,
              backgroundColor: CoreColors.primaryTransparent,
            }}
            onPress={onClose}
          >
            <ThemedText style={{
              fontSize: 16 * (isDesktop ? 1.2 : 1.05),
              color: CoreColors.textOnLight,
              textAlign: 'center',
            }}>
              Cancel
            </ThemedText>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}