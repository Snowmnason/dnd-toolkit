import { CoreColors } from '@/constants/corecolors';
import React from 'react';
import { Modal, Platform, TouchableOpacity, View } from 'react-native';
import { Spacing } from '../constants/theme';
import { ThemedText } from './themed-text';

interface ModalButton {
  text: string;
  onPress: () => void;
  style?: 'default' | 'primary' | 'destructive' | 'cancel';
}

interface CustomModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  buttons: ModalButton[];
  children?: React.ReactNode; // For custom content instead of buttons
}

export default function CustomModal({ 
  visible, 
  onClose, 
  title, 
  message, 
  buttons,
  children
}: CustomModalProps) {
  // Responsive sizing - larger on desktop
  const isDesktop = Platform.OS === 'web' || Platform.OS === 'windows' || Platform.OS === 'macos';
  
  const modalWidth = {
    width: isDesktop ? 500 : 350, // Larger but reasonable
    maxWidth: '90%' as const,
  };
  
  const fontSize = {
    title: isDesktop ? 24 : 20,
    message: isDesktop ? 18 : 16,
    button: isDesktop ? 17 : 16,
  };
  
  const scaledSpacing = {
    lg: Spacing.lg * (isDesktop ? 1.5 : 1.2),
    md: Spacing.md * (isDesktop ? 1.5 : 1.2),
    sm: Spacing.sm * (isDesktop ? 1.5 : 1.2),
  };
  const getButtonStyle = (style: ModalButton['style'] = 'default') => {
    switch (style) {
      case 'primary':
        return {
          backgroundColor: CoreColors.primary,
          borderColor: CoreColors.primary,
        };
      case 'destructive':
        return {
          backgroundColor: '#dc3545',
          borderColor: '#c82333',
        };
      case 'cancel':
        return {
          backgroundColor: 'rgba(108, 117, 125, 0.1)',
          borderColor: '#6c757d',
        };
      default:
        return {
          backgroundColor: CoreColors.primaryTransparent,
          borderColor: CoreColors.primary,
        };
    }
  };

  const getButtonTextStyle = (style: ModalButton['style'] = 'default') => {
    switch (style) {
      case 'primary':
        return { color: CoreColors.textPrimary, fontWeight: '600' as const };
      case 'destructive':
        return { color: CoreColors.textPrimary, fontWeight: '600' as const };
      case 'cancel':
        return { color: '#6c757d', fontWeight: '500' as const };
      default:
        return { color: CoreColors.textOnLight, fontWeight: '500' as const };
    }
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
            borderRadius: 12,
            padding: scaledSpacing.lg,
            width: modalWidth.width,
            maxWidth: modalWidth.maxWidth,
            borderWidth: 2,
            borderColor: CoreColors.secondary,
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
            marginBottom: message ? scaledSpacing.sm : scaledSpacing.md,
            textAlign: 'center',
            color: CoreColors.textOnLight,
          }}>
            {title}
          </ThemedText>
          
          {message && (
            <ThemedText style={{
              fontSize: fontSize.message,
              marginBottom: scaledSpacing.md,
              textAlign: 'center',
              color: CoreColors.textOnLight,
              lineHeight: fontSize.message * 1.4,
            }}>
              {message}
            </ThemedText>
          )}

          {/* Custom children content or default buttons */}
          {children || (
            <View style={{
              flexDirection: buttons.length <= 2 ? 'row' : 'column',
              gap: scaledSpacing.sm,
              justifyContent: 'center',
            }}>
              {buttons.map((button, index) => (
                <TouchableOpacity
                  key={index}
                  style={{
                    padding: scaledSpacing.sm,
                    borderRadius: 8,
                    borderWidth: 1,
                    flex: buttons.length <= 2 ? 1 : undefined,
                    minWidth: buttons.length <= 2 ? undefined : (isDesktop ? 250 : 200),
                    ...getButtonStyle(button.style),
                  }}
                  onPress={button.onPress}
                >
                  <ThemedText style={{
                    fontSize: fontSize.button,
                    textAlign: 'center',
                    ...getButtonTextStyle(button.style),
                  }}>
                    {button.text}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}