import { Heading, Text, View } from 'tamagui';

export default function NotesPage() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Heading>Notes</Heading>
      <Text style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Keep quick notes and reminders for your campaign.
      </Text>
      
      {/* Placeholder content */}
      <Text style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        📝 Coming Soon: Quick notes, tags, and search functionality.
      </Text>
    </View>
  );
}
