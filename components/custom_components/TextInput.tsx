import { BorderRadius, CoreColors, Spacing } from '@/constants/theme';
import React from 'react';
import { TextInput as RNTextInput, TextInputProps, TextStyle } from 'react-native';

interface CustomTextInputProps extends Omit<TextInputProps, 'style'> {
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  style?: TextStyle | TextStyle[];
}

export default function TextInput({
  placeholder = "Enter text here",
  value,
  onChangeText,
  style,
  ...props
}: CustomTextInputProps) {
  return (
    <RNTextInput
      style={[
        {
          borderWidth: 2,
          borderColor: CoreColors.secondary,
          borderRadius: BorderRadius.sm,
          padding: Spacing.sm,
          backgroundColor: CoreColors.backgroundLight,
          color: CoreColors.textOnLight,
          marginBottom: Spacing.md,
        },
        style,
      ]}
      placeholder={placeholder}
      placeholderTextColor={CoreColors.textSecondary}
      value={value}
      onChangeText={onChangeText}
      {...props}
    />
  );
}