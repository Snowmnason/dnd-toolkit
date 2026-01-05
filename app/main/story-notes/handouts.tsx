import { AppPage, Body, Title } from '@/components/ui';

export default function HandoutsPage() {
  return (
    <AppPage style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Title style={{ marginBottom: 20 }}>
        Handouts
      </Title>
      <Body style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Create and manage player handouts and visual aids.
      </Body>
      
      {/* Placeholder content */}
      <Body style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        🗺️ Coming Soon: Handout creator, image sharing, and player distribution tools.
      </Body>
    </AppPage>
  );
}
