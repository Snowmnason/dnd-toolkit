import { useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import styles from './HomeScreen.styles';

export default function HomeScreen() {
  const [selectedWorld, setSelectedWorld] = useState(null);
  let selectedMapImage = require('../../assets/images/Miku.png');

  return (
    <View style={styles.container}>
      {/* Left Panel: Scrollable World List */}
      <View style={styles.leftPanel}>
        <Text style={styles.worldListTitle}>Worlds</Text>
        <ScrollView style={styles.worldList}>
          {/* Placeholder worlds as buttons */}
          {Array.from({ length: 10 }).map((_, i) => {
            const worldName = `World Placeholder ${i + 1}`;
            const isSelected = selectedWorld === worldName;
            return (
              <TouchableOpacity
                key={i}
                style={[styles.worldItem, isSelected && styles.selectedWorldItem]}
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
                <TouchableOpacity style={styles.deleteButton}>
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.rightButtonWrapper}>
                <TouchableOpacity style={styles.openButton}>
                  <Text style={styles.openButtonText}>Open</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
        <Image
          source={selectedMapImage}
          style={styles.mapImage}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

