// components/IconButton.js
import { Text, TouchableOpacity, View } from 'react-native';

export default function IconButton({ icon, label, onPress, style, textStyle }) {
  return (
    <TouchableOpacity style={style} onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={textStyle}>{icon}</Text>
        {label && <Text style={[textStyle, { marginLeft: 8 }]}>{label}</Text>}
      </View>
    </TouchableOpacity>
  );
}