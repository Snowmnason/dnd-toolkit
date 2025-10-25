import { AppView, Body, Title } from '@/components/ui';

export default function WeatherGeneratorPage() {
  return (
    <AppView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
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
    </AppView>
  );
}
