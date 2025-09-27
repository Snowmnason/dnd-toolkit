import { TextInput as RNTextInput } from 'react-native';

const styles = {
  textField: {
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#333',
    color: 'white',
    marginBottom: 16,
    placeholderTextColor: '#888',
  },
};

export default function TextInput({ placeholder = "Enter text here", value, onChangeText, style, ...props }) {
  return (
    <RNTextInput
      style={[styles.textField, style]}
      placeholder={placeholder}
      value={value}
      onChangeText={onChangeText}
      {...props}
    />
  );
}