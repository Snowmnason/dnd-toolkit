import { AppPage, Body, Title } from '@/components/ui';

export default function DungeonTownCreatorPage() {
  return (
    <AppPage 
      style={{ flex: 1, padding: 20 }}
      contentContainerStyle={{ justifyContent: 'center', alignItems: 'center' }}
    >
      <Title style={{ marginBottom: 20 }}>
        Dungeon/Town Creator
      </Title>
      <Body style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Design dungeons and towns with interactive layouts and NPCs.
      </Body>
      
      {/* Placeholder content */}
      <Body style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        🏰 Coming Soon: Dungeon builder, town layout designer, and location management.
      </Body>
    </AppPage>
  );
}
