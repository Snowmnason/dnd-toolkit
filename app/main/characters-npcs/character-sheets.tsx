import { View } from 'react-native';
import { Text } from 'tamagui';

export default function CharacterSheetsPage() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>Character Sheets</Text>
      <Text style={{ marginBottom: 40, textAlign: 'center', fontSize: 18, }}>
        Manage your partys character sheets and track character progression.
      </Text>
      
      {/* Placeholder content */}
      <Text style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        🎭 Coming Soon: Character sheet builder, stat tracking, and level progression tools.
      </Text>
    </View>
  );
}
