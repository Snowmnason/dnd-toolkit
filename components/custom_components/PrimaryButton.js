// components/PrimaryButton.js
import { ThemedText } from '@/components/themed-text';
import { ComponentStyles, CoreColors } from '@/constants/theme';
import { TouchableOpacity } from 'react-native';

export default function PrimaryButton({
  onPress,
  children,
  style,
  textStyle,
  disabled = false,
}) {
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
