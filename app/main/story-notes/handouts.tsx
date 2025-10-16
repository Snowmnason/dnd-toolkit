import { Heading, Text, View } from 'tamagui';

export default function HandoutsPage() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Heading>Handouts</Heading>
      <Text style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Create and manage player handouts and visual aids.
      </Text>
      
      {/* Placeholder content */}
      <Text style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        �️ Coming Soon: Handout creator, image sharing, and player distribution tools.
      </Text>
    </View>
  );
}
