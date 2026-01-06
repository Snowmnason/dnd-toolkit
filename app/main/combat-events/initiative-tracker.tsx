import { AppPage, Body, Title } from '@/components/ui';

export default function InitiativeTrackerPage() {
  return (
    <AppPage 
      style={{ flex: 1, padding: 20 }}
      contentContainerStyle={{ justifyContent: 'center', alignItems: 'center' }}
    >
      <Title style={{ marginBottom: 20 }}>
        Initiative Tracker
      </Title>
      <Body style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Track combat initiative and manage turn order efficiently.
      </Body>
      
      {/* Placeholder content */}
      <Body style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        🎲 Coming Soon: Initiative rolling, turn tracking, and combat status management.
      </Body>
    </AppPage>
  );
}
