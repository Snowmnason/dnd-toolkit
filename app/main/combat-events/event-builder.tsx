import { Heading, Text, View } from 'tamagui';

export default function EventBuilderPage() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Heading>Event Builder</Heading>
      <Text style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Create memorable events and story moments for your campaign.
      </Text>
      
      {/* Placeholder content */}
      <Text style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        📋 Coming Soon: Event templates, random events, and story triggers.
      </Text>
    </View>
  );
}
