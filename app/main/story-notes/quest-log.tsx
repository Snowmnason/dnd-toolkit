import { Heading, Text, View } from 'tamagui';

export default function QuestLogPage() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Heading>Quest Log</Heading>
      <Text style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Track active quests, objectives, and campaign progression.
      </Text>
      {/* Placeholder content */}
      <Text style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        📜 Coming Soon: Quest tracking, objective management, and progress visualization.
      </Text>
    </View>
  );
}
