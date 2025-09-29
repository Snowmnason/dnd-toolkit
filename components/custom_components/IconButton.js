// components/IconButton.js
import { ThemedText } from '@/components/themed-text';
import { TouchableOpacity, View } from 'react-native';

export default function IconButton({ icon, label, onPress, style, textStyle }) {
  return (
    <TouchableOpacity style={style} onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Icon */}
        <ThemedText style={textStyle}>{icon}</ThemedText>

        {/* Label (if present) */}
        {label && (
          <ThemedText style={[{ marginLeft: 8 }, textStyle]}>
            {label}
          </ThemedText>
        )}
      </View>
    </TouchableOpacity>
  );
}
