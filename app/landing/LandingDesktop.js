import { useState } from 'react';
import { Image, ScrollView, TouchableOpacity, View } from 'react-native';
import PrimaryButton from '../../components/custom_components/PrimaryButton';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';

export default function LandingDesktop({ navigation }) {
  const [selectedWorld, setSelectedWorld] = useState(null);
  const selectedMapImage = require('../../assets/images/Miku.png');

  return (
    <ThemedView style={{ flex: 1, flexDirection: 'row' }}>
      {/* Left Panel */}
      <View style={styles.leftPanel}>
        <ThemedText type="title" style={{ textAlign: 'center' }}>Worlds</ThemedText>
        <ScrollView style={{ flex: 1, marginBottom: 64 }}>
          {Array.from({ length: 10 }).map((_, i) => {
            const worldName = `World Placeholder ${i + 1}`;
            const isSelected = selectedWorld === worldName;
            return (
              <TouchableOpacity
                key={i}
                style={[styles.worldItem, isSelected && styles.selectedWorldItem]}
                onPress={() => setSelectedWorld(worldName)}
              >
                <ThemedText style={{ 
                  fontSize: 19, 
                  color: isSelected ? '#fff' : '#a77e44ff', 
                  fontWeight: 'bold'
                }}>{worldName}</ThemedText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <PrimaryButton
          style={{ position: 'absolute', left: 16, right: 16, bottom: 16, borderRadius: 14 }}
          onPress={() => navigation.navigate('CreateWorld')}
        >
          Create New World
        </PrimaryButton>
      </View>

      {/* Right Panel */}
      <View style={styles.rightPanel}>
        {/* Background image layer */}
        <Image
          source={selectedMapImage}
          style={[{ width: '100%', height: '100%', zIndex: -1 }]}
          resizeMode="contain"
        />
        {/* Foreground content layer */}
        {selectedWorld && (
          <>
            <ThemedText type="title" style={styles.selectedWorldTitle}>
              {selectedWorld}
            </ThemedText>
            <View style={styles.rightButtonsContainer}>
              <PrimaryButton onPress={() => {/* TODO: delete */}}>Delete</PrimaryButton>
              <PrimaryButton
                onPress={() =>
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Main' }],
                  })
                }
>
                Open
              </PrimaryButton>
            </View>
          </>
        )}
      </View>
    </ThemedView>
  );
}

/* Local layout styles (theme-aware where needed) */
const styles = {
  leftPanel: {
    flex: 1,
    padding: 14,
    borderRightWidth: 2,
    borderRightColor: '#ddd',
    position: 'relative',
    minWidth: 100,
    maxWidth: 400,
  },
  rightPanel: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  worldItem: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: '#fff', // TODO: replace with theme color
    // borderColor: '#d5dc43ff',
    // borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 1.84,
    // Android shadow
    elevation: 3,
  },
  selectedWorldItem: {
    backgroundColor: '#644820ff', // TODO: replace with theme color
  },
  selectedWorldTitle: {
    position: 'absolute',
    top: 24,
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  rightButtonsContainer: {
    position: 'absolute',
    bottom: 44,
    left: 54,
    right: 54,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
};
