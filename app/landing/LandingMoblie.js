import { useState } from 'react';
import { Image, ScrollView, TouchableOpacity, View } from 'react-native';
import IconButton from '../../components/custom_components/IconButton';
import PrimaryButton from '../../components/custom_components/PrimaryButton';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';

export default function LandingMobile({ navigation }) {
  const [selectedWorld, setSelectedWorld] = useState(null);
  const worlds = Array.from({ length: 10 }).map((_, i) => `World Placeholder ${i + 1}`);
  const selectedMapImage = require('../../assets/images/Miku.png');

  if (!selectedWorld) {
    // World List View
    return (
      <ThemedView style={{ flex: 1, paddingTop: 52, paddingHorizontal: 16 }}>
        <ThemedText type="title" style={{ marginBottom: 16, textAlign: 'center', fontWeight: '650', fontSize: 58 }}>
          Worlds
        </ThemedText>

        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
          {worlds.map((worldName, i) => (
            <TouchableOpacity
              key={i}
              style={styles.worldItem}
              onPress={() => setSelectedWorld(worldName)}
            >
              <ThemedText>{worldName}</ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Create New World Button */}
        <PrimaryButton
          style={styles.createButton}
          onPress={() => navigation.navigate('CreateWorld')}
        >
          Create New World
        </PrimaryButton>
      </ThemedView>
    );
  }
  // World Detail View
  return (
      <ThemedView style={{ flex: 1, alignItems: 'center', padding: 16 }}>
        {/* Back button */}
        <IconButton
          icon="⬅️"
          onPress={() => setSelectedWorld(null)}
          style={{ position: 'absolute', top: 36, left: 16, backgroundColor: 'transparent' }}
          textStyle={{ fontSize: 24 }}
        />
      <View style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
          <ThemedText type="title" style={{ marginBottom: 16, textAlign: 'center', fontWeight: '650', fontSize: 58 }}>
            {selectedWorld}
          </ThemedText>
          <Image
            source={selectedMapImage}
            resizeMode="contain"
            style={[{ width: '100%', height: '70%', borderRadius: 12, zIndex: 1 }]}
          />
          <View style={styles.detailButtonRow}>
            <PrimaryButton onPress={() => {/* TODO: delete */}}>Delete</PrimaryButton>
            <PrimaryButton
              onPress={() =>
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'MainMobile' }],
                })
              }
            >
              Open
            </PrimaryButton>
          </View>
        </View>
      </ThemedView>
  );
}

/* Local layout styles */
const styles = {
  worldItem: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: '#f2e2c4', // TODO: swap for theme background
    alignItems: 'center',
  },
  createButton: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    borderRadius: 14,
  },
  detailButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '60%',
    marginBottom: 16,
  },
};
