import { View } from 'react-native';
import PrimaryButton from '../../components/custom_components/PrimaryButton';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';

export default function MainScreenDesktop({ navigation }) {
  return (
    <ThemedView style={{ flex: 1, flexDirection: 'row' }}>
      {/* Characters & NPCs */}
      <View style={{ flex: 1, borderWidth: 1, borderColor: 'black', alignItems: 'center', justifyContent: 'center' }}>
        <ThemedText type="title">Characters & NPCs</ThemedText>
        <ThemedText>Character Sheets</ThemedText>
        <ThemedText>Party Overview</ThemedText>
        <ThemedText>NPC Forge</ThemedText>
        <ThemedText>Faction Tracker</ThemedText>
      </View>

      {/* Items & Treasure */}
      <View style={{ flex: 1, borderWidth: 1, borderColor: 'black', alignItems: 'center', justifyContent: 'center' }}>
        <ThemedText type="title">Items & Treasure</ThemedText>
        <ThemedText>Inventory</ThemedText>
        <ThemedText>Party Loot</ThemedText>
        <ThemedText>Treasure Generator</ThemedText>
        <ThemedText>Shop Generator</ThemedText>
      </View>

      {/* World & Exploration */}
      <View style={{ flex: 1, borderWidth: 1, borderColor: 'black', alignItems: 'center', justifyContent: 'center' }}>
        <ThemedText type="title">World & Exploration</ThemedText>
        <ThemedText>Dungeon/Town Creator</ThemedText>
        <ThemedText>Battle Map Maker</ThemedText>
        <ThemedText>World Map</ThemedText>
        <ThemedText>Weather Generator</ThemedText>
      </View>

      {/* Combat & Events */}
      <View style={{ flex: 1, borderWidth: 1, borderColor: 'black', alignItems: 'center', justifyContent: 'center' }}>
        <ThemedText type="title">Combat & Events</ThemedText>
        <ThemedText>Encounter Builder</ThemedText>
        <ThemedText>Initiative Tracker</ThemedText>
        <ThemedText>Event Builder</ThemedText>
        <ThemedText>Calendar</ThemedText>
      </View>

      {/* Story & Notes */}
      <View style={{ flex: 1, borderWidth: 1, borderColor: 'black', alignItems: 'center', justifyContent: 'center' }}>
        <ThemedText type="title">Story & Notes</ThemedText>
        <ThemedText>Quest Log</ThemedText>
        <ThemedText>Journal</ThemedText>
        <ThemedText>Notes</ThemedText>
        <ThemedText>Handouts</ThemedText>
      </View>

      {/* Home Button */}
      <PrimaryButton
        style={{ position: 'absolute', bottom: 24, right: 24 }}
        onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Home' }] })}
      >
        Go Home
      </PrimaryButton>
    </ThemedView>
  );
}
