import { AppView, Body, Title } from '@/components/ui';

export default function InventoryPage() {
  return (
    <AppView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Title style={{ marginBottom: 20 }}>
        Inventory
      </Title>
      <Body style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Manage individual character inventories and equipment.
      </Body>
      
      {/* Placeholder content */}
      <Body style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        🎒 Coming Soon: Equipment tracking, weight management, and item organization.
      </Body>
    </AppView>
  );
}
