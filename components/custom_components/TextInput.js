import { useThemeColor } from '@/hooks/use-theme-color';
import { TextInput as RNTextInput } from 'react-native';

export default function TextInput({
  placeholder = "Enter text here",
  value,
  onChangeText,
  style,
  ...props
}) {
  const borderColor = useThemeColor({}, 'icon');
  const bgColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({}, 'icon');

  return (
    <RNTextInput
      style={[
        {
          borderWidth: 1,
          borderColor,
          borderRadius: 8,
          padding: 12,
          backgroundColor: bgColor,
          color: textColor,
          fontFamily: 'GrenzeGotisch',
          marginBottom: 16,
        },
        style,
      ]}
      placeholder={placeholder}
      placeholderTextColor={placeholderColor}
      value={value}
      onChangeText={onChangeText}
      {...props}
    />
  );
}
