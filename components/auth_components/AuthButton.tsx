import React from 'react';
import { TextStyle, ViewStyle } from 'react-native';
import { Button } from 'tamagui';

interface AuthButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
}

/**
 * AuthButton - Specialized button for authentication flows
 * Uses BaseButton with automatic disabled/loading state handling
 */
export default function AuthButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  style,
  textStyle
}: AuthButtonProps) {
  const combinedStyle: ViewStyle = {
    width: '100%', 
    backgroundColor: '#8B4513',
    paddingVertical: 16, 
    borderRadius: 8,
    ...(Array.isArray(style) ? Object.assign({}, ...style) : style || {})
  };

  const combinedTextStyle: TextStyle = {
    color: '#F5E6D3', 
    fontSize: 16, 
    fontWeight: '600',
    ...(Array.isArray(textStyle) ? Object.assign({}, ...textStyle) : textStyle || {})
  };

  return (
    <Button
      //variant="primary"
      //size="md"
      onPress={onPress}
      disabled={disabled}
      //loading={loading}
      style={combinedStyle}
      //textStyle={combinedTextStyle}
      //fullWidth
    >
      {title}
    </Button>
  );
}