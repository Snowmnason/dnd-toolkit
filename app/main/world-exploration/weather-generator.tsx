import { AppPage, Body, Title } from '@/components/ui';

export default function WeatherGeneratorPage() {
  return (
    <AppPage 
      style={{ flex: 1, padding: 20 }}
      contentContainerStyle={{ justifyContent: 'center', alignItems: 'center' }}
    >
      <Title style={{ marginBottom: 20 }}>
        Weather Generator
      </Title>
      <Body style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Generate realistic weather patterns and atmospheric conditions.
      </Body>
      
      {/* Placeholder content */}
      <Body style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        ⛅ Coming Soon: Weather patterns, seasonal changes, and environmental effects.
      </Body>
    </AppPage>
  );
}
