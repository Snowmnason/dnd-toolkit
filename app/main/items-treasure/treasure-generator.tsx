import { Heading, Text, View } from 'tamagui';

export default function TreasureGeneratorPage() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Heading>Treasure Generator</Heading>
      <Text style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Generate random treasures and magical items for your adventures.
      </Text>
      <Text style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        ✨ Coming Soon: Random treasure tables, magic item generator, and custom loot creation.
      </Text>
    </View>
  );
}
