import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import PrimaryButton from '../../components/custom_components/PrimaryButton';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';

export default function MainScreenDesktop() {
  const router = useRouter();

  // Navigation helper function
  const navigateToFeature = (featurePath: string) => {
    router.push(`/main/${featurePath}` as any);
  };

  return (
    <ThemedView style={{ flex: 1, flexDirection: 'row' }}>
      {/* Characters & NPCs */}
      <View style={styles.panel}>
        <ThemedText type="title" style={styles.panelTitle}>Characters & NPCs</ThemedText>
        <PrimaryButton style={styles.featureButton} textStyle={styles.featureText} onPress={() => navigateToFeature('characters-npcs/character-sheets')}>
          Character Sheets
        </PrimaryButton>
        <PrimaryButton style={styles.featureButton} textStyle={styles.featureText} onPress={() => navigateToFeature('characters-npcs/party-overview')}>
          Party Overview
        </PrimaryButton>
        <PrimaryButton style={styles.featureButton} textStyle={styles.featureText} onPress={() => navigateToFeature('characters-npcs/npc-forge')}>
          NPC Forge
        </PrimaryButton>
        <PrimaryButton style={styles.featureButton} textStyle={styles.featureText} onPress={() => navigateToFeature('characters-npcs/faction-tracker')}>
          Faction Tracker
        </PrimaryButton>
      </View>

      {/* Items & Treasure */}
      <View style={styles.panel}>
        <ThemedText type="title" style={styles.panelTitle}>Items & Treasure</ThemedText>
        <PrimaryButton style={styles.featureButton} textStyle={styles.featureText} onPress={() => navigateToFeature('items-treasure/inventory')}>
          Inventory
        </PrimaryButton>
        <PrimaryButton style={styles.featureButton} textStyle={styles.featureText} onPress={() => navigateToFeature('items-treasure/party-loot')}>
          Party Loot
        </PrimaryButton>
        <PrimaryButton style={styles.featureButton} textStyle={styles.featureText} onPress={() => navigateToFeature('items-treasure/treasure-generator')}>
          Treasure Generator
        </PrimaryButton>
        <PrimaryButton style={styles.featureButton} textStyle={styles.featureText} onPress={() => navigateToFeature('items-treasure/shop-generator')}>
          Shop Generator
        </PrimaryButton>
      </View>

      {/* World & Exploration */}
      <View style={styles.panel}>
        <ThemedText type="title" style={styles.panelTitle}>World & Exploration</ThemedText>
        <PrimaryButton style={styles.featureButton} textStyle={styles.featureText} onPress={() => navigateToFeature('world-exploration/dungeon-town-creator')}>
          Dungeon/Town Creator
        </PrimaryButton>
        <PrimaryButton style={styles.featureButton} textStyle={styles.featureText} onPress={() => navigateToFeature('world-exploration/battle-map-maker')}>
          Battle Map Maker
        </PrimaryButton>
        <PrimaryButton style={styles.featureButton} textStyle={styles.featureText} onPress={() => navigateToFeature('world-exploration/world-map')}>
          World Map
        </PrimaryButton>
        <PrimaryButton style={styles.featureButton} textStyle={styles.featureText} onPress={() => navigateToFeature('world-exploration/weather-generator')}>
          Weather Generator
        </PrimaryButton>
      </View>

      {/* Combat & Events */}
      <View style={styles.panel}>
        <ThemedText type="title" style={styles.panelTitle}>Combat & Events</ThemedText>
        <PrimaryButton style={styles.featureButton} textStyle={styles.featureText} onPress={() => navigateToFeature('combat-events/encounter-builder')}>
          Encounter Builder
        </PrimaryButton>
        <PrimaryButton style={styles.featureButton} textStyle={styles.featureText} onPress={() => navigateToFeature('combat-events/initiative-tracker')}>
          Initiative Tracker
        </PrimaryButton>
        <PrimaryButton style={styles.featureButton} textStyle={styles.featureText} onPress={() => navigateToFeature('combat-events/event-builder')}>
          Event Builder
        </PrimaryButton>
        <PrimaryButton style={styles.featureButton} textStyle={styles.featureText} onPress={() => navigateToFeature('combat-events/calendar')}>
          Calendar
        </PrimaryButton>
      </View>

      {/* Story & Notes */}
      <View style={styles.panel}>
        <ThemedText type="title" style={styles.panelTitle}>Story & Notes</ThemedText>
        <PrimaryButton style={styles.featureButton} textStyle={styles.featureText} onPress={() => navigateToFeature('story-notes/quest-log')}>
          Quest Log
        </PrimaryButton>
        <PrimaryButton style={styles.featureButton} textStyle={styles.featureText} onPress={() => navigateToFeature('story-notes/journal')}>
          Journal
        </PrimaryButton>
        <PrimaryButton style={styles.featureButton} textStyle={styles.featureText} onPress={() => navigateToFeature('story-notes/notes')}>
          Notes
        </PrimaryButton>
        <PrimaryButton style={styles.featureButton} textStyle={styles.featureText} onPress={() => navigateToFeature('story-notes/handouts')}>
          Handouts
        </PrimaryButton>
      </View>

      {/* Home Button */}
      <PrimaryButton
        style={{ position: 'absolute', bottom: 24, right: 24 }}
        textStyle={{}}
        onPress={() => router.replace('/select/world-selection')}
      >
        Go Home
      </PrimaryButton>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'black',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 16,
  },
  panelTitle: {
    marginBottom: 20,
    textAlign: 'center',
    textShadowColor: '#D4AF37', 
    textShadowOffset: { width: 1, height: 1 }, 
    textShadowRadius: 2,
  },
  featureButton: {
    marginBottom: 8,
    width: '90%',
    borderRadius: 8,
    borderColor: '#D4AF37',
    shadowColor: '#D4AF37',
    borderWidth: 2,
  },
  featureText: {
    textAlign: 'center',
  },
});
