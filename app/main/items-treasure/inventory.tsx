import { ThemedText } from '../../../components/themed-text';
import { ThemedView } from '../../../components/themed-view';

export default function InventoryPage() {
  return (
    <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <ThemedText type="title" style={{ marginBottom: 20, textAlign: 'center', color: '#F5E6D3' }}>
        Inventory
      </ThemedText>
      <ThemedText style={{ marginBottom: 40, textAlign: 'center', fontSize: 18, color: '#F5E6D3' }}>
        Manage individual character inventories and equipment.
      </ThemedText>
      
      {/* Placeholder content */}
      <ThemedText style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40, color: '#F5E6D3' }}>
        🎒 Coming Soon: Equipment tracking, weight management, and item organization.
      </ThemedText>
    </ThemedView>
  );
}
