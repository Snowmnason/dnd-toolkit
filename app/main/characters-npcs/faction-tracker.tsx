import { AppView, Body, Title } from '@/components/ui';

export default function FactionTrackerPage() {
  return (
    <AppView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Title style={{ marginBottom: 20 }}>
        Faction Tracker
      </Title>
      <Body style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Track relationships between factions and their influence on your world.
      </Body>
      
      {/* Placeholder content */}
      <Body style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        ⚔️ Coming Soon: Faction relationship tracker, reputation system, and political intrigue tools.
      </Body>
    </AppView>
  );
}
