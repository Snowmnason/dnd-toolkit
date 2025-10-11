import { ThemedText } from '@/components/themed-text';
import { ComponentStyles, CoreColors } from '@/constants/theme';
import React from 'react';
import { TextStyle, TouchableOpacity, ViewStyle } from 'react-native';

interface PrimaryButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
  disabled?: boolean;
}

export default function PrimaryButton({
  onPress,
  children,
  style,
  textStyle,
  disabled = false,
}: PrimaryButtonProps) {
  return (
    <TouchableOpacity
      style={[
        ComponentStyles.button.primary,
        {
          backgroundColor: disabled ? CoreColors.textSecondary : CoreColors.backgroundLight,
          alignItems: 'center',
          opacity: disabled ? 0.6 : 1,
        },
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <ThemedText
        type="defaultSemiBold"
        style={[
          { 
            color: CoreColors.primary, 
            fontSize: 22 
          }, 
          textStyle
        ]}
      >
        {children}
      </ThemedText>
    </TouchableOpacity>
  );
}