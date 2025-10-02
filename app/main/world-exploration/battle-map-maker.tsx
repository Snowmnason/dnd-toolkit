import { ThemedText } from '../../../components/themed-text';
import { ThemedView } from '../../../components/themed-view';

export default function BattleMapMakerPage() {
  return (
    <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <ThemedText type="title" style={{ marginBottom: 20, textAlign: 'center', color: '#F5E6D3' }}>
        Battle Map Maker
      </ThemedText>
      <ThemedText style={{ marginBottom: 40, textAlign: 'center', fontSize: 18, color: '#F5E6D3' }}>
        Create tactical battle maps with terrain and interactive elements.
      </ThemedText>
      
      {/* Placeholder content */}
      <ThemedText style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40, color: '#F5E6D3' }}>
        ⚔️ Coming Soon: Grid-based map editor, terrain tools, and token placement.
      </ThemedText>
    </ThemedView>
  );
}
