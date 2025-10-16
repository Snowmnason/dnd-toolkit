import { Heading, Text, View } from 'tamagui';

export default function JournalPage() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Heading>Journal</Heading>
      <Text style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Record campaign sessions and memorable story moments.
      </Text>
      
      {/* Placeholder content */}
      <Text style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        📖 Coming Soon: Session notes, story timeline, and campaign diary.
      </Text>
    </View>
  );
}
