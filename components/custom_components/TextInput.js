import { useThemeColor } from '@/hooks/use-theme-color';
import { TextInput as RNTextInput } from 'react-native';

export default function TextInput({
  placeholder = "Enter text here",
  value,
  onChangeText,
  style,
  ...props
}) {
  const borderColor = "#FFBF00";
  const bgColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({}, 'text');

  return (
    <RNTextInput
      style={[
        {
          borderWidth: 2,
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
