import { ThemedText } from '../../../components/themed-text';
import { ThemedView } from '../../../components/themed-view';

export default function HandoutsPage() {
  return (
    <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <ThemedText type="title" style={{ marginBottom: 20, textAlign: 'center', color: '#F5E6D3' }}>
        Handouts
      </ThemedText>
      <ThemedText style={{ marginBottom: 40, textAlign: 'center', fontSize: 18, color: '#F5E6D3' }}>
        Create and manage player handouts and visual aids.
      </ThemedText>
      
      {/* Placeholder content */}
      <ThemedText style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40, color: '#F5E6D3' }}>
        🗺️ Coming Soon: Handout creator, image sharing, and player distribution tools.
      </ThemedText>
    </ThemedView>
  );
}
