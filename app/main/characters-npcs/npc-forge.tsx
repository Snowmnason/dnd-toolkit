import { Heading, Text, View } from 'tamagui';

export default function NPCForgePage() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Heading>NPC Forge</Heading>
      <Text style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Create memorable NPCs with personalities, stats, and backstories.
      </Text>
      
      {/* Placeholder content */}
      <Text style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        🧙 Coming Soon: NPC generator, personality traits, and stat blocks.
      </Text>
    </View>
  );
}
