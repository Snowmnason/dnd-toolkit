import React from 'react';
import { Modal, Platform, TouchableOpacity, View } from 'react-native';
import { Text } from 'tamagui';
import { Spacing } from '../../constants/theme';

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
  // Theming overrides
  overlayColor?: string; // backdrop color
  surfaceColor?: string; // card background
  borderColor?: string;
  titleColor?: string;
  messageColor?: string;
  // Button palette overrides
  primaryBg?: string;
  primaryBorder?: string;
  primaryText?: string;
  destructiveBg?: string;
  destructiveBorder?: string;
  destructiveText?: string;
  cancelBg?: string;
  cancelBorder?: string;
  cancelText?: string;
  defaultBg?: string;
  defaultBorder?: string;
  defaultText?: string;
}

export default function CustomModal({ 
  visible, 
  onClose, 
  title, 
  message, 
  buttons,
  children,
  overlayColor,
  surfaceColor,
  borderColor,
  titleColor,
  messageColor,
  primaryBg,
  primaryBorder,
  primaryText,
  destructiveBg,
  destructiveBorder,
  destructiveText,
  cancelBg,
  cancelBorder,
  cancelText,
  defaultBg,
  defaultBorder,
  defaultText,
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
          backgroundColor: primaryBg ?? '#8B4513',//UPDATE TO THEME
          borderColor: primaryBorder ?? '#8B4513',
        };
      case 'destructive':
        return {
          backgroundColor: destructiveBg ?? '#dc3545',
          borderColor: destructiveBorder ?? '#c82333',
        };
      case 'cancel':
        return {
          backgroundColor: cancelBg ?? 'rgba(108, 117, 125, 0.1)',
          borderColor: cancelBorder ?? '#6c757d',
        };
      default:
        return {
          backgroundColor: defaultBg ?? 'rgba(139, 69, 19, 0.2)',
          borderColor: defaultBorder ?? '#8B4513',
        };
    }
  };

  const getButtonTextStyle = (style: ModalButton['style'] = 'default') => {
    switch (style) {
      case 'primary':
        return { color: primaryText ?? '#F5E6D3', fontWeight: '600' as const };
      case 'destructive':
        return { color: destructiveText ?? '#F5E6D3', fontWeight: '600' as const };
      case 'cancel':
        return { color: cancelText ?? '#6c757d', fontWeight: '500' as const };
      default:
        return { color: defaultText ?? '#F5E6D3', fontWeight: '500' as const };
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
          backgroundColor: overlayColor ?? 'rgba(0, 0, 0, 0.5)',
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
            backgroundColor: surfaceColor ?? '#3D444C',
            borderRadius: 12,
            padding: scaledSpacing.lg,
            width: modalWidth.width,
            maxWidth: modalWidth.maxWidth,
            borderWidth: 2,
            borderColor: borderColor ?? '#D4AF37',
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
            <Text style={{
              fontSize: fontSize.title,
              fontWeight: 'bold',
              color: messageColor ?? '#C8B9A1',
            }}>
              ×
            </Text>
          </TouchableOpacity>

          <Text style={{
            fontSize: fontSize.title,
            fontWeight: 'bold',
            marginBottom: message ? scaledSpacing.sm : scaledSpacing.md,
            textAlign: 'center',
            color: titleColor ?? '#F5E6D3',
          }}>
            {title}
          </Text>
          
          {message && (
            <Text style={{
              fontSize: fontSize.message,
              marginBottom: scaledSpacing.md,
              textAlign: 'center',
              color: messageColor ?? '#F5E6D3',
              lineHeight: fontSize.message * 1.4,
            }}>
              {message}
            </Text>
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
                  <Text style={{
                    fontSize: fontSize.button,
                    textAlign: 'center',
                    ...getButtonTextStyle(button.style),
                  }}>
                    {button.text}
                  </Text>
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