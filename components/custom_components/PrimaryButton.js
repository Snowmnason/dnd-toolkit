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

          boxShadow: '1px 5px 4px rgba(0,0,0,0.25)',
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
