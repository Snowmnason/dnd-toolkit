import { AppView, Body, Title } from '@/components/ui';

export default function TreasureGeneratorPage() {
  return (
    <AppView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Title style={{ marginBottom: 20 }}>
        Treasure Generator
      </Title>
      <Body style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Generate random treasures and magical items for your adventures.
      </Body>
      
      {/* Placeholder content */}
      <Body style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        ✨ Coming Soon: Random treasure tables, magic item generator, and custom loot creation.
      </Body>
    </AppView>
  );
}
