import { Heading, Text, View } from 'tamagui';

export default function FactionTrackerPage() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Heading>Faction Tracker</Heading>
      <Text style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Track relationships between factions and their influence on your world.
      </Text>
      
      {/* Placeholder content */}
      <Text style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        ⚔️ Coming Soon: Faction relationship tracker, reputation system, and political intrigue tools.
      </Text>
    </View>
  );
}
