import { Heading, Text, View } from 'tamagui';

export default function BattleMapMakerPage() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Heading>Battle Map Maker</Heading>
      <Text style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Create tactical battle maps with terrain and interactive elements.
      </Text>
      
      {/* Placeholder content */}
      <Text style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        ⚔️ Coming Soon: Grid-based map editor, terrain tools, and token placement.
      </Text>
    </View>
  );
}
