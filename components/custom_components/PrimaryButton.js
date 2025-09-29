// components/PrimaryButton.js
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { TouchableOpacity } from 'react-native';

export default function PrimaryButton({
  onPress,
  children,
  style,
  textStyle,
  disabled = false,
}) {
  const bgColor = useThemeColor({}, 'tint');        // main accent color
  const textColor = useThemeColor({}, 'textColor'); // invert text against bg
  const disabledColor = useThemeColor({}, 'icon');

  return (
    <TouchableOpacity
      style={[
        {
          backgroundColor: disabled ? disabledColor : bgColor,
          paddingVertical: 12,
          borderRadius: 16,
          alignItems: 'center',
          paddingHorizontal: 20,
          opacity: disabled ? 0.6 : 1,

          shadowColor: '#000',
          shadowOffset: { width: 4, height: 6 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          // Android shadow
          elevation: 3,
        },
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <ThemedText
        type="defaultSemiBold"
        style={[{ color: textColor, fontSize: 22 }, textStyle]}
      >
        {children}
      </ThemedText>
    </TouchableOpacity>
  );
}
