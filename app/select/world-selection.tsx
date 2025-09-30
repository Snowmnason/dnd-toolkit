import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import IconButton from '../../components/custom_components/IconButton';
import PrimaryButton from '../../components/custom_components/PrimaryButton';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';

export default function LandingPage() {
  const [selectedWorld, setSelectedWorld] = useState<string | null>(null);
  const worlds = Array.from({ length: 10 }).map((_, i) => `World Placeholder ${i + 1}`);
  const selectedMapImage = require('../../assets/images/Miku.png');
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  // Mobile: Two-screen flow (list → detail)
  if (!isDesktop) {
    
    if (!selectedWorld) {
      // Mobile World List View
      return (
        <ThemedView style={{ flex: 1, paddingTop: 52, paddingHorizontal: 16 }}>
          <View style={{ backgroundColor: 'rgba(139, 69, 19, 0.9)', paddingVertical: 16, paddingHorizontal: 24, borderRadius: 12, marginBottom: 16, borderWidth: 2, borderColor: '#D4AF37', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8 }}>
            <ThemedText type="title" style={{ textAlign: 'center', fontWeight: '700', fontSize: 58, color: '#F5E6D3', textShadowColor: '#000', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 4 }}>
              Worlds
            </ThemedText>
          </View>

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

          <PrimaryButton
            style={styles.createButton}
            textStyle={{}}
            onPress={() => router.push('/select/create-world')}
          >
            Create New World
          </PrimaryButton>
        </ThemedView>
      );
    } else {
      // Mobile World Detail View
      return (
        <ThemedView style={{ flex: 1, alignItems: 'center', padding: 16 }}>
          <IconButton
            icon="⬅️"
            label="Back"
            onPress={() => setSelectedWorld(null)}
            style={{ position: 'absolute' as const, top: 36, left: 16, backgroundColor: 'transparent' }}
            textStyle={{ fontSize: 24 }}
          />
          <View style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <ThemedText type="title" style={{ marginBottom: 16, textAlign: 'center', fontWeight: '600', fontSize: 58 }}>
              {selectedWorld}
            </ThemedText>
            <Image
              source={selectedMapImage}
              resizeMode="contain"
              style={{ width: '100%', height: '70%', borderRadius: 12, zIndex: 1 }}
            />
            <View style={styles.detailButtonRow}>
              <PrimaryButton 
                style={{}}
                textStyle={{}}
                onPress={() => {/* TODO: delete */}}
              >
                Delete
              </PrimaryButton>
              <PrimaryButton
                style={{}}
                textStyle={{}}
                onPress={() => {
                  router.push(isDesktop ? '/main/desktop' : '/main/mobile');
                }}
              >
                Open
              </PrimaryButton>
            </View>
          </View>
        </ThemedView>
      );
    }
  }

  // Desktop: Side-by-side layout
  return (
    <ThemedView style={{ flex: 1, flexDirection: 'row' }}>
      {/* Left Panel */}
      <View style={styles.leftPanel}>
        <View style={{ backgroundColor: 'rgba(139, 69, 19, 0.9)', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, marginBottom: 16, borderWidth: 2, borderColor: '#D4AF37', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 6 }}>
          <ThemedText type="title" style={{ textAlign: 'center', color: '#F5E6D3', fontWeight: '700', textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 }}>Worlds</ThemedText>
        </View>
        <ScrollView style={{ flex: 1, marginBottom: 64 }}>
          {worlds.map((worldName, i) => {
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
          textStyle={{}}
          onPress={() => router.push('/select/create-world')}
        >
          Create New World
        </PrimaryButton>
      </View>

      {/* Right Panel */}
      <View style={styles.rightPanel}>
          <View style={{ position: 'absolute', top: 30, left: 50, zIndex: 10, backgroundColor: '#2f353d' }}>
            <PrimaryButton
              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 }}
              textStyle={{ color: '#8B4513', fontSize: 14, fontWeight: '500' }}
              onPress={() => router.replace('/login/welcome')}
            >
              Back to Login
            </PrimaryButton>
          </View>
        <Image
          source={selectedMapImage}
          resizeMode="contain"
          style={{ width: '100%', height: '100%', zIndex: -1 }}
        />
        {selectedWorld && (
          <>
            <ThemedText type="title" style={styles.selectedWorldTitle}>
              {selectedWorld}
            </ThemedText>
            <View style={styles.rightButtonsContainer}>
              <PrimaryButton 
                style={{}}
                textStyle={{}}
                onPress={() => {/* TODO: delete */}}
              >
                Delete
              </PrimaryButton>
              <PrimaryButton
                style={{}}
                textStyle={{}}
                onPress={() => {
                  router.push(isDesktop ? '/main/desktop' : '/main/mobile');
                }}
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

const styles = StyleSheet.create({
  // Mobile styles
  worldItem: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: '#eff4fbff',
    alignItems: 'center' as const,
    borderWidth: 2,
    borderColor: '#D4AF37',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  createButton: {
    position: 'absolute' as const,
    left: 16,
    right: 16,
    bottom: 16,
    borderRadius: 14,
  },
  detailButtonRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    width: '60%',
    marginBottom: 16,
  },
  
  // Desktop styles
  leftPanel: {
    flex: 1,
    padding: 14,
    borderRightWidth: 2,
    borderRightColor: '#ddd',
    position: 'relative' as const,
    minWidth: 100,
    maxWidth: 400,
  },
  rightPanel: {
    flex: 2,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  selectedWorldItem: {
    backgroundColor: '#644820ff',
    borderWidth: 3,
    borderColor: '#D4AF37',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
  },
  selectedWorldTitle: {
    position: 'absolute' as const,
    top: 24,
    left: 0,
    right: 0,
    textAlign: 'center' as const,
  },
  rightButtonsContainer: {
    position: 'absolute' as const,
    bottom: 44,
    left: 54,
    right: 54,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
  },
});