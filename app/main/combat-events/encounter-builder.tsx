import { Heading, Text, View } from 'tamagui';

export default function EncounterBuilderPage() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Heading>Encounter Builder</Heading>
      <Text style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Design balanced encounters and manage combat scenarios.
      </Text>
      
      {/* Placeholder content */}
      <Text style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        ⚔️ Coming Soon: Encounter calculator, monster database, and difficulty balancing.
      </Text>
    </View>
  );
}
