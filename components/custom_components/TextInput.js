import { BorderRadius, CoreColors, Spacing, Typography } from '@/constants/theme';
import { TextInput as RNTextInput } from 'react-native';

export default function TextInput({
  placeholder = "Enter text here",
  value,
  onChangeText,
  style,
  ...props
}) {
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
          fontFamily: Typography.fontFamilyPrimary,
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
