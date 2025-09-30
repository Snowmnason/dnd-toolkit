/*
import { useThemeColor } from '@/hooks/use-theme-color';
import { Picker } from '@react-native-picker/picker';
import { Platform } from 'react-native';

export default function Dropdown({ value, onChange, options, style }) {
  const bgColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'icon');
  const textColor = useThemeColor({}, 'text');

  if (Platform.OS === 'web') {
    return (
      <select
        style={{
          borderWidth: 1,
          borderColor,
          borderRadius: 8,
          padding: 12,
          backgroundColor: bgColor,
          color: textColor,
          fontFamily: 'GrenzeGotisch',
          marginBottom: 16,
          ...style,
        }}
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {options.map(opt => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  // Mobile picker
  return (
    <Picker
      selectedValue={value}
      onValueChange={onChange}
      style={{
        borderWidth: 1,
        borderColor,
        borderRadius: 8,
        backgroundColor: bgColor,
        color: textColor,
        fontFamily: 'GrenzeGotisch',
        marginBottom: 16,
        ...style,
      }}
    >
      {options.map(opt => (
        <Picker.Item key={opt} label={opt} value={opt} color={textColor} />
      ))}
    </Picker>
  );
}
*/

// Simple placeholder component - easy to swap back to Picker implementation above
import { useThemeColor } from '@/hooks/use-theme-color';
import { Text, View } from 'react-native';

export default function Dropdown({ value, onChange, options, style = {} }) {
  const bgColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'icon');
  const textColor = useThemeColor({}, 'text');

  return (
    <View style={{
      borderWidth: 1,
      borderColor,
      borderRadius: 8,
      padding: 12,
      backgroundColor: bgColor,
      marginBottom: 16,
      ...style,
    }}>
      <Text style={{ color: textColor, fontFamily: 'GrenzeGotisch' }}>
        {value} ▼
      </Text>
      {/* TODO: Replace with actual dropdown when ready */}
    </View>
  );
}