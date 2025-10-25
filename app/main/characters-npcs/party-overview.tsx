import { AppView, Body, Title } from '@/components/ui';

export default function PartyOverviewPage() {
  return (
    <AppView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Title style={{ marginBottom: 20 }}>
        Party Overview
      </Title>
      <Body style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        View your entire partys status, health, and resources at a glance.
      </Body>
      
      {/* Placeholder content */}
      <Body style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        👥 Coming Soon: Party health tracking, resource management, and group statistics.
      </Body>
    </AppView>
  );
}
