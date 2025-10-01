import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, ScrollView, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import PrimaryButton from '../../components/custom_components/PrimaryButton';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { ComponentStyles, CoreColors, Spacing } from '../../constants/theme';

export default function LandingPage() {
  const [selectedWorld, setSelectedWorld] = useState<string | null>(null);
  const worlds = Array.from({ length: 10 }).map((_, i) => `World Placeholder ${i + 1}`);
  const selectedMapImage = require('../../assets/images/Miku.png');
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  // Mobile: Simple list view (detail handled by TopBar back button naturally)
  if (!isDesktop) {
    return (
      <ThemedView style={{ flex: 1, paddingTop: 52, paddingHorizontal: Spacing.md }}>
        <View style={ComponentStyles.card.container}>
          <ThemedText type="title" style={{
            textAlign: 'center',
            fontWeight: '700',
            fontSize: 58,
            color: CoreColors.textPrimary,
            textShadowColor: CoreColors.backgroundDark,
            textShadowOffset: { width: 2, height: 2 },
            textShadowRadius: 4
          }}>
            Worlds
          </ThemedText>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
          {worlds.map((worldName, i) => (
            <TouchableOpacity
              key={i}
              style={ComponentStyles.card.base}
              onPress={() => router.push('/select/world-detail/' + encodeURIComponent(worldName) as any)}
            >
              <ThemedText>{worldName}</ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <PrimaryButton
          style={{
            position: 'absolute',
            left: Spacing.md,
            right: Spacing.md,
            bottom: Spacing.md,
            borderRadius: 14,
          }}
          textStyle={{}}
          onPress={() => router.push('/select/create-world')}
        >
          Create New World
        </PrimaryButton>
      </ThemedView>
    );
  }

  // Desktop: Side-by-side layout
  return (
    <ThemedView style={{ flexDirection: 'row' }}>
      {/* Left Panel */}
      <View style={{
        flex: 1,
        padding: 14,
        borderRightWidth: 2,
        borderRightColor: CoreColors.borderPrimary,
        position: 'relative',
        minWidth: 100,
        maxWidth: 400,
      }}>
        <View style={ComponentStyles.card.container}>
          <ThemedText type="title" style={{
            textAlign: 'center',
            color: CoreColors.textPrimary,
            fontWeight: '700',
            textShadowColor: CoreColors.backgroundDark,
            textShadowOffset: { width: 1, height: 1 },
            textShadowRadius: 2
          }}>
            Worlds
          </ThemedText>
        </View>
        <ScrollView style={{ flex: 1, marginBottom: 64 }}>
          {worlds.map((worldName, i) => {
            const isSelected = selectedWorld === worldName;
            return (
              <TouchableOpacity
                key={i}
                style={[
                  ComponentStyles.card.base,
                  isSelected && ComponentStyles.card.selected
                ]}
                onPress={() => setSelectedWorld(worldName)}
              >
                <ThemedText style={{ 
                  fontSize: 19, 
                  color: isSelected ? CoreColors.textPrimary : CoreColors.textSecondary, 
                  fontWeight: 'bold'
                }}>
                  {worldName}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <PrimaryButton
          style={{
            position: 'absolute',
            left: Spacing.md,
            right: Spacing.md,
            bottom: Spacing.md,
            borderRadius: 14
          }}
          textStyle={{}}
          onPress={() => router.push('/select/create-world')}
        >
          Create New World
        </PrimaryButton>
      </View>

      {/* Right Panel */}
      <View style={{
        flex: 2,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <View style={{
          position: 'absolute',
          top: 30,
          left: 50,
          zIndex: 10,
          backgroundColor: CoreColors.backgroundDark
        }}>
        </View>
        <Image
          source={selectedMapImage}
          resizeMode="contain"
          style={{ width: '100%', height: '100%', zIndex: -1 }}
        />
        {selectedWorld && (
          <>
            <ThemedText type="title" style={{
              position: 'absolute',
              top: 24,
              left: 0,
              right: 0,
              textAlign: 'center',
            }}>
              {selectedWorld}
            </ThemedText>
            <View style={{
              position: 'absolute',
              bottom: 44,
              left: 54,
              right: 54,
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}>
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