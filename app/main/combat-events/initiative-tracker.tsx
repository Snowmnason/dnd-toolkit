import { Heading, Text, View } from 'tamagui';

export default function InitiativeTrackerPage() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Heading>Initiative Tracker</Heading>
      <Text style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Track combat initiative and manage turn order efficiently.
      </Text>
      
      {/* Placeholder content */}
      <Text style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        🎲 Coming Soon: Initiative rolling, turn tracking, and combat status management.
      </Text>
    </View>
  );
}
