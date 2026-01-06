import { AppPage, Body, Title } from '@/components/ui';

export default function EncounterBuilderPage() {
  return (
    <AppPage 
      style={{ flex: 1, padding: 20 }}
      contentContainerStyle={{ justifyContent: 'center', alignItems: 'center' }}
    >
      <Title style={{ marginBottom: 20 }}>
        Encounter Builder
      </Title>
      <Body style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Design balanced encounters and manage combat scenarios.
      </Body>
      
      {/* Placeholder content */}
      <Body style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        ⚔️ Coming Soon: Encounter calculator, monster database, and difficulty balancing.
      </Body>
    </AppPage>
  );
}
