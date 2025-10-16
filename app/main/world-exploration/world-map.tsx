import { Heading, Text, View } from 'tamagui';

export default function WorldMapPage() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Heading>World Map</Heading>
      <Text style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Navigate and manage your campaign world with interactive maps.
      </Text>
      
      {/* Placeholder content */}
      <Text style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        🗺️ Coming Soon: Interactive world maps, location markers, and travel tracking.
      </Text>
    </View>
  );
}
