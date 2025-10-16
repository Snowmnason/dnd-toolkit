import { Heading, Text, View } from 'tamagui';

export default function InventoryPage() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Heading>Inventory</Heading>
      <Text style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Manage individual character inventories and equipment.
      </Text>
      
      {/* Placeholder content */}
      <Text style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        🎒 Coming Soon: Equipment tracking, weight management, and item organization.
      </Text>
    </View>
  );
}
