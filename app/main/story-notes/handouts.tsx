import { useRouter } from 'expo-router';

import { ThemedView } from '../../../components/themed-view';
import PrimaryButton from '../../../components/custom_components/PrimaryButton';
import { ThemedText } from '../../../components/themed-text';

export default function HandoutsPage() {
  const router = useRouter();

  return (
    <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <ThemedText type="title" style={{ marginBottom: 20, textAlign: 'center' }}>
        Handouts
      </ThemedText>
      <ThemedText style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Create and manage player handouts and visual aids.
      </ThemedText>
      
      {/* Placeholder content */}
      <ThemedText style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        🗺️ Coming Soon: Handout creator, image sharing, and player distribution tools.
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
