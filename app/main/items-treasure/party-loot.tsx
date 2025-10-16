import { Heading, Text, View } from 'tamagui';

export default function PartyLootPage() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Heading>Party Loot</Heading>
      <Text style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Track shared treasures and distribute loot among party members.
      </Text>
      
      {/* Placeholder content */}
      <Text style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        💰 Coming Soon: Shared treasure tracking, loot distribution, and currency management.
      </Text>
    </View>
  );
}
