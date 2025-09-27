import { useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import PrimaryButton from '../../components/baseComps';
import styles from '../HomeScreen.styles';

export default function HomeScreen({ navigation }) {
  const [selectedWorld, setSelectedWorld] = useState(null);
  let selectedMapImage = require('../../../assets/images/Miku.png');

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
    <PrimaryButton
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 16,
        borderRadius: 14,
      }}
      onPress={() => {navigation.navigate('CreateWorld')}}
    >
      Create New World
    </PrimaryButton>
      </View>
      {/* Right Panel: Image/Map */}
      <View style={styles.rightPanel}>
        {selectedWorld && (
          <>
            <Text style={styles.selectedWorldTitle}>{selectedWorld}</Text>
            <View style={styles.rightButtonsContainer}>
                <PrimaryButton
                    onPress={() => {/* handle create */}}
                >
                    Delete
                </PrimaryButton>
                <PrimaryButton
                    onPress={() => {navigation.reset({index: 0, routes: [{ name: 'Main' }]})}}
                >
                    Open
                </PrimaryButton>
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

