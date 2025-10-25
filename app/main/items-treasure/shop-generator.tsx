import { AppView, Body, Title } from '@/components/ui';

export default function ShopGeneratorPage() {
  return (
    <AppView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
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
    </AppView>
  );
}
