import { Heading, Text, View } from 'tamagui';

export default function WeatherGeneratorPage() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Heading>Weather Generator</Heading>
      <Text style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Generate realistic weather patterns and atmospheric conditions.
      </Text>
      {/* Placeholder content */}
      <Text style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        ⛅ Coming Soon: Weather patterns, seasonal changes, and environmental effects.
      </Text>
    </View>
  );
}
