import { AppView, Body, Title } from '@/components/ui';

export default function InitiativeTrackerPage() {
  return (
    <AppView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
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
    </AppView>
  );
}
