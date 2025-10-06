import React from 'react';
import { Modal, Platform, TouchableOpacity, View } from 'react-native';
import { CoreColors, Spacing } from '../../constants/theme';
import { ThemedText } from '../themed-text';

interface LeaveWorldModalProps {
  visible: boolean;
  onClose: () => void;
  worldName: string;
  onLeaveWorld: () => Promise<void>;
}

export default function LeaveWorldModal({
  visible,
  onClose,
  worldName,
  onLeaveWorld,
}: LeaveWorldModalProps) {
  const isDesktop = Platform.OS === 'web' || Platform.OS === 'windows' || Platform.OS === 'macos';
  const modalWidth = {
    width: isDesktop ? 500 : 350,
    maxWidth: '90%' as const,
  };
  const fontSize = {
    title: isDesktop ? 24 : 20,
    button: isDesktop ? 17 : 16,
    input: isDesktop ? 18 : 16,
  };
  const scaledSpacing = {
    lg: Spacing.lg * (isDesktop ? 1.5 : 1.2),
    md: Spacing.md * (isDesktop ? 1.5 : 1.2),
    sm: Spacing.sm * (isDesktop ? 1.5 : 1.2),
  };

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
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={{
            backgroundColor: CoreColors.backgroundLight,
            borderRadius: 16,
            padding: scaledSpacing.lg,
            width: modalWidth.width,
            maxWidth: modalWidth.maxWidth,
            borderWidth: 2,
            borderColor: CoreColors.secondary,
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 8,
            position: 'relative',
          }}>
          {/* Close button */}
          <TouchableOpacity
            style={{
              position: 'absolute',
              top: scaledSpacing.sm,
              right: scaledSpacing.sm,
              zIndex: 1,
              padding: scaledSpacing.sm,
            }}
            onPress={onClose}
          >
            <ThemedText style={{
              fontSize: fontSize.title,
              fontWeight: 'bold',
              color: CoreColors.textSecondary,
            }}>
              ×
            </ThemedText>
          </TouchableOpacity>

          <ThemedText style={{
            fontSize: fontSize.title,
            fontWeight: 'bold',
            marginBottom: scaledSpacing.md,
            textAlign: 'center',
            color: CoreColors.textOnLight,
          }}>
            {worldName ? `Confirm Leave ${worldName}` : 'Confirm Leave this World'}
          </ThemedText>

          <ThemedText style={{
            marginBottom: scaledSpacing.md,
            textAlign: 'center',
            color: CoreColors.textOnLight,
          }}>
            Are you sure you want to leave {worldName}? You will lose access to this world and all its content.
          </ThemedText>

          {/* Delete button below */}
          <TouchableOpacity
            style={{
              backgroundColor: '#FF6B6B',
              paddingVertical: scaledSpacing.sm,
              borderRadius: 8,
              marginTop: scaledSpacing.md,
            }}
            onPress={onLeaveWorld} //TODO fix
          >
            <ThemedText style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: fontSize.button }}>
               Confirm
            </ThemedText>
          </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}