import { AppPage, Body, Title } from '@/components/ui';

export default function PartyLootPage() {
  return (
    <AppPage style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Title style={{ marginBottom: 20 }}>
        Party Loot
      </Title>
      <Body style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Track shared treasures and distribute loot among party members.
      </Body>
      
      {/* Placeholder content */}
      <Body style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        💰 Coming Soon: Shared treasure tracking, loot distribution, and currency management.
      </Body>
    </AppPage>
  );
}
