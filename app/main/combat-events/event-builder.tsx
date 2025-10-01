import { ThemedText } from '../../../components/themed-text';
import { ThemedView } from '../../../components/themed-view';

export default function EventBuilderPage() {
  return (
    <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <ThemedText type="title" style={{ marginBottom: 20, textAlign: 'center' }}>
        Event Builder
      </ThemedText>
      <ThemedText style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Create memorable events and story moments for your campaign.
      </ThemedText>
      
      {/* Placeholder content */}
      <ThemedText style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        📋 Coming Soon: Event templates, random events, and story triggers.
      </ThemedText>
    </ThemedView>
  );
}
