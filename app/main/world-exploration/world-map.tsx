import { AppPage, Body, Title } from '@/components/ui';

export default function WorldMapPage() {
  return (
    <AppPage style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Title style={{ marginBottom: 20 }}>
        World Map
      </Title>
      <Body style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Navigate and manage your campaign world with interactive maps.
      </Body>
      
      {/* Placeholder content */}
      <Body style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        🗺️ Coming Soon: Interactive world maps, location markers, and travel tracking.
      </Body>
    </AppPage>
  );
}
