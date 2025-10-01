import { ThemedText } from '../../../components/themed-text';
import { ThemedView } from '../../../components/themed-view';

export default function QuestLogPage() {
  return (
    <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <ThemedText type="title" style={{ marginBottom: 20, textAlign: 'center' }}>
        Quest Log
      </ThemedText>
      <ThemedText style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Track active quests, objectives, and campaign progression.
      </ThemedText>
      
      {/* Placeholder content */}
      <ThemedText style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        📜 Coming Soon: Quest tracking, objective management, and progress visualization.
      </ThemedText>
    </ThemedView>
  );
}
