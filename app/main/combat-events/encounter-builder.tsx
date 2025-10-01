import { ThemedText } from '../../../components/themed-text';
import { ThemedView } from '../../../components/themed-view';

export default function EncounterBuilderPage() {
  return (
    <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <ThemedText type="title" style={{ marginBottom: 20, textAlign: 'center' }}>
        Encounter Builder
      </ThemedText>
      <ThemedText style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Design balanced encounters and manage combat scenarios.
      </ThemedText>
      
      {/* Placeholder content */}
      <ThemedText style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        ⚔️ Coming Soon: Encounter calculator, monster database, and difficulty balancing.
      </ThemedText>
    </ThemedView>
  );
}
