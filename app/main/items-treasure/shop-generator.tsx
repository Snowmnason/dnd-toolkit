import { AppPage, Body, Title } from '@/components/ui';

export default function ShopGeneratorPage() {
  return (
    <AppPage 
      style={{ flex: 1, padding: 20 }}
      contentContainerStyle={{ justifyContent: 'center', alignItems: 'center' }}
    >
      <Title style={{ marginBottom: 20 }}>
        Shop Generator
      </Title>
      <Body style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Create shops with random inventories and merchant personalities.
      </Body>
      
      {/* Placeholder content */}
      <Body style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        🏪 Coming Soon: Random shop generator, merchant inventory, and pricing tools.
      </Body>
    </AppPage>
  );
}
