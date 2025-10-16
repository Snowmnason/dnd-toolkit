import { Heading, Text, View } from 'tamagui';

export default function DungeonTownCreatorPage() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Heading>Dungeon/Town Creator</Heading>
      <Text style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Design dungeons and towns with interactive layouts and NPCs.
      </Text>
      
      {/* Placeholder content */}
      <Text style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        🏰 Coming Soon: Dungeon builder, town layout designer, and location management.
      </Text>
    </View>
  );
}
