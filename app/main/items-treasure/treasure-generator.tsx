import { AppPage, Body, Title } from '@/components/ui';

export default function TreasureGeneratorPage() {
  return (
    <AppPage 
      style={{ flex: 1, padding: 20 }}
      contentContainerStyle={{ justifyContent: 'center', alignItems: 'center' }}
    >
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
    </AppPage>
  );
}
