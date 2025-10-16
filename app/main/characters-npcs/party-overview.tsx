import { Heading, Text, View } from 'tamagui';

export default function PartyOverviewPage() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Heading>Party Overview</Heading>
      <Text style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        View your entire partys status, health, and resources at a glance.
      </Text>
      
      {/* Placeholder content */}
      <Text style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        👥 Coming Soon: Party health tracking, resource management, and group statistics.
      </Text>
    </View>
  );
}
