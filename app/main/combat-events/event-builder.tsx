import { AppPage, Body, Title } from '@/components/ui';

export default function EventBuilderPage() {
  return (
    <AppPage style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Title style={{ marginBottom: 20 }}>
        Event Builder
      </Title>
      <Body style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Create memorable events and story moments for your campaign.
      </Body>
      
      {/* Placeholder content */}
      <Body style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        📋 Coming Soon: Event templates, random events, and story triggers.
      </Body>
    </AppPage>
  );
}
