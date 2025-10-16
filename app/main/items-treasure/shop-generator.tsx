import { Heading, Text, View } from 'tamagui';

export default function ShopGeneratorPage() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Heading>Shop Generator</Heading>
      <Text style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Create shops with random inventories and merchant personalities.
      </Text>
      
      {/* Placeholder content */}
      <Text style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        🛒 Coming Soon: Random shop generator, merchant inventory, and pricing tools.
      </Text>
    </View>
  );
}
