import { View, Text } from 'react-native';

export default function MainScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 32, fontWeight: 'bold' }}>Main Screen</Text>
      <Text style={{ marginTop: 16, color: '#888' }}>This is a template for your main world screen.</Text>
    </View>
  );
}
