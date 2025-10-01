import React from 'react';
import { Modal, TouchableOpacity, View } from 'react-native';
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
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
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
          padding: Spacing.lg,
          minWidth: 200,
          borderWidth: 2,
          borderColor: CoreColors.secondary,
        }}>
          <ThemedText style={{
            fontSize: 18,
            fontWeight: 'bold',
            marginBottom: Spacing.md,
            textAlign: 'center',
            color: CoreColors.textOnLight,
          }}>
            Settings
          </ThemedText>
          
          <TouchableOpacity
            style={{
              padding: Spacing.sm,
              borderRadius: 8,
              marginBottom: Spacing.xs,
            }}
            onPress={() => {
              onClose();
              onAccountSettings();
            }}
          >
            <ThemedText style={{
              fontSize: 16,
              color: CoreColors.textOnLight,
              textAlign: 'center',
            }}>
              Account Settings
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              padding: Spacing.sm,
              borderRadius: 8,
              backgroundColor: 'rgba(212, 175, 55, 0.1)',
              marginBottom: Spacing.sm,
            }}
            onPress={() => {
              onClose();
              onReturnToWorldSelection();
            }}
          >
            <ThemedText style={{
              fontSize: 16,
              color: CoreColors.secondary,
              textAlign: 'center',
              fontWeight: '600',
            }}>
              Return to World Selection
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              padding: Spacing.sm,
              borderRadius: 8,
              backgroundColor: CoreColors.primaryTransparent,
            }}
            onPress={onClose}
          >
            <ThemedText style={{
              fontSize: 16,
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