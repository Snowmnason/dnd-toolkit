import { Text, TouchableOpacity } from 'react-native';

export default function PrimaryButton({ onPress, children, style, textStyle, disabled = false }) {
  return (
    <TouchableOpacity style={[buttonBase, style, disabled && { backgroundColor: '#888', opacity: 0.6 }]} 
    onPress={onPress} 
    disabled={disabled}>
      <Text style={[buttonTextBase, textStyle]}>{children}</Text>
    </TouchableOpacity>
  );
}
const buttonBase = {
  backgroundColor: '#1976d2',
  paddingVertical: 12,
  borderRadius: 16,
  elevation: 2,
  alignItems: 'center',
  paddingHorizontal: 20,
};

const buttonTextBase = {
  color: '#fff',
  fontWeight: 'bold',
  fontSize: 16,
};