import { AppView, Body, Title } from '@/components/ui';

export default function BattleMapMakerPage() {
  return (
    <AppView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
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
    </AppView>
  );
}
