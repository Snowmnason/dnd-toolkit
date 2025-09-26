import { useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import styles from './HomeScreen.styles';

export default function HomeScreen() {
  const [selectedWorld, setSelectedWorld] = useState(null);

  return (
    <View style={styles.container}>
      {/* Left Panel: Scrollable World List */}
      <View style={styles.leftPanel}>
        <Text style={styles.worldListTitle}>Worlds</Text>
        <ScrollView style={styles.worldList}>
          {/* Placeholder worlds as buttons */}
          {Array.from({ length: 10 }).map((_, i) => {
            const worldName = `World Placeholder ${i + 1}`;
            return (
              <TouchableOpacity
                key={i}
                style={styles.worldItem}
                onPress={() => setSelectedWorld(worldName)}
              >
                <Text style={styles.worldItemText}>{worldName}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {/* Create New World Button */}
        <TouchableOpacity style={styles.createButton}>
          <Text style={styles.createButtonText}>Create New World</Text>
        </TouchableOpacity>
      </View>
      {/* Right Panel: Image/Map */}
      <View style={styles.rightPanel}>
        {selectedWorld && (
          <>
            <Text style={styles.selectedWorldTitle}>{selectedWorld}</Text>
            <View style={styles.rightButtonsContainer}>
              <View style={styles.leftButtonWrapper}>
                <TouchableOpacity style={styles.rightButton}>
                  <Text style={styles.rightButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.rightButtonWrapper}>
                <TouchableOpacity style={styles.rightButton}>
                  <Text style={styles.rightButtonText}>Open</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
        <Image
          source={require('../../assets/images/Miku.png')}
          style={styles.mapImage}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

