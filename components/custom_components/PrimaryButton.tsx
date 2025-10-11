import React from 'react';
import { TextStyle, ViewStyle } from 'react-native';
import BaseButton from '../ui/BaseButton';

interface PrimaryButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
  disabled?: boolean;
  loading?: boolean;
}

/**
 * PrimaryButton - Main action button component
 * Now uses BaseButton with automatic disabled state handling
 */
export default function PrimaryButton({
  onPress,
  children,
  style,
  textStyle,
  disabled = false,
  loading = false,
}: PrimaryButtonProps) {
  const combinedTextStyle: TextStyle = {
    fontSize: 22,
    ...(Array.isArray(textStyle) ? Object.assign({}, ...textStyle) : textStyle || {})
  };

  return (
    <BaseButton
      variant="primary"
      size="medium"
      onPress={onPress}
      disabled={disabled}
      loading={loading}
      style={style}
      textStyle={combinedTextStyle}
    >
      {children}
    </BaseButton>
  );
}