import { AppPage, Body, Title } from '@/components/ui';

export default function BattleMapMakerPage() {
  return (
    <AppPage 
      style={{ flex: 1, padding: 20 }}
      contentContainerStyle={{ justifyContent: 'center', alignItems: 'center' }}
    >
      <Title style={{ marginBottom: 20 }}>
        Battle Map Maker
      </Title>
      <Body style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Create tactical battle maps with terrain and interactive elements.
      </Body>
      
      {/* Placeholder content */}
      <Body style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        ⚔️ Coming Soon: Grid-based map editor, terrain tools, and token placement.
      </Body>
    </AppPage>
  );
}
