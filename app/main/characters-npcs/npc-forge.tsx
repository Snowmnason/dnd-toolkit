import { useRouter } from 'expo-router';

import { ThemedView } from '../../../components/themed-view';
import PrimaryButton from '../../../components/custom_components/PrimaryButton';
import { ThemedText } from '../../../components/themed-text';

export default function NPCForgePage() {
  const router = useRouter();

  return (
    <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <ThemedText type="title" style={{ marginBottom: 20, textAlign: 'center' }}>
        NPC Forge
      </ThemedText>
      <ThemedText style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Create memorable NPCs with personalities, stats, and backstories.
      </ThemedText>
      
      {/* Placeholder content */}
      <ThemedText style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        🎭 Coming Soon: NPC generator, personality traits, and relationship tracking.
      </ThemedText>

      <PrimaryButton
        style={{ paddingHorizontal: 40 }}
        textStyle={{}}
        onPress={() => router.back()}
      >
        ← Back to Main
      </PrimaryButton>
    </ThemedView>
  );
}
