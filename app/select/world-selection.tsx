import CustomLoad from '@/components/custom_components/CustomLoad';
import { useRouter } from 'expo-router';
import { Image, ScrollView, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import PrimaryButton from '../../components/custom_components/PrimaryButton';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { ComponentStyles, CoreColors, Spacing } from '../../constants/theme';
import { useWorlds } from '../../lib/useWorlds';

export default function LandingPage() {
  const { selectedWorld, setSelectedWorld, worlds, isLoading, error, retry } = useWorlds();
  
  const selectedMapImage = require('../../assets/images/Miku.png');
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  // Show loading screen
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: CoreColors.backgroundDark }}>
        <CustomLoad size="large" />
        <ThemedText style={{ marginTop: 16, color: CoreColors.textSecondary }}>
          Loading your worlds...
        </ThemedText>
      </View>
    );
  }

  // Show error screen
  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: CoreColors.backgroundDark }}>
        <ThemedText style={{ color: '#FF6B6B', textAlign: 'center', marginBottom: 20 }}>
          {error}
        </ThemedText>
        <PrimaryButton style={{}} textStyle={{}} onPress={retry}>
          Try Again
        </PrimaryButton>
      </View>
    );
  }

  // Main layout - unified for both mobile and desktop
  return (
    <ThemedView style={{ 
      flexDirection: isDesktop ? 'row' : 'column',
      flex: 1, 
      paddingTop: isDesktop ? 0 : 12, 
      paddingHorizontal: isDesktop ? 0 : Spacing.md 
    }}>
      
      {/* Left Panel (Desktop) / Main Content (Mobile) */}
      <View style={{
        flex: isDesktop ? 1 : 1,
        padding: isDesktop ? 14 : 0,
        borderRightWidth: isDesktop ? 2 : 0,
        borderRightColor: CoreColors.borderPrimary,
        position: 'relative',
        minWidth: isDesktop ? 100 : undefined,
        maxWidth: isDesktop ? 400 : undefined,
      }}>
        
        <ScrollView style={{ flex: 1, marginBottom: 64, paddingBottom: 100 }}>
          
          {/* World List */}
          {worlds.length === 0 ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <ThemedText style={{ textAlign: 'center', color: CoreColors.backgroundLight }}>
                No worlds yet. Create your first world to get started!
              </ThemedText>
            </View>
          ) : (
            worlds.map((world) => {
              const isSelected = selectedWorld?.world_id === world.world_id;
              
              return (
                <TouchableOpacity
                  key={world.world_id}
                  style={[
                    ComponentStyles.card.base,
                    isSelected && ComponentStyles.card.selected,
                    world.user_role === 'dm' && { borderLeftWidth: 3, borderLeftColor: CoreColors.secondaryLight }
                  ]}
                  onPress={() => {
                    if (isDesktop) {
                      setSelectedWorld(world);
                    } else {
                      router.push('/select/world-detail/' + encodeURIComponent(world.world_id) as any);
                    }
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <ThemedText 
                        numberOfLines={1} 
                        style={{ fontSize: 20,fontWeight: 'bold',
                          color: isSelected ? CoreColors.textPrimary : CoreColors.textSecondary
                        }}
                        >
                        {world.name}
                      </ThemedText>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          
        </ScrollView>
        
        {/* Create New World Button */}
        <PrimaryButton
          style={{position: 'absolute',left: Spacing.md,right: Spacing.md,bottom: Spacing.md,borderRadius: 14}} textStyle={{}}
          onPress={() => router.push('/select/create-world')}
        >
          Create New World
        </PrimaryButton>
      </View>

      {/* Right Panel (Desktop Only) */}
      {isDesktop && (
        <View style={{
          flex: 2,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <View style={{ position: 'absolute', top: 30, left: 50, zIndex: 10, backgroundColor: CoreColors.backgroundDark}}>
          </View>
          <Image
            source={selectedMapImage}
            resizeMode="contain"
            style={{ width: '100%', height: '100%', zIndex: -1 }}
          />
          {selectedWorld && (
            <>
              <ThemedText type="title" style={{ position: 'absolute', top: 24, left: 0, right: 0, textAlign: 'center', }}>
                {selectedWorld.name}
              </ThemedText>
              <View style={{position: 'absolute',bottom: 44,left: 54,right: 54,flexDirection: 'row',justifyContent: 'space-between',}}>
                {/* Only show delete button for owners */}
                {selectedWorld.user_role === 'owner' && (
                  <PrimaryButton 
                    style={{ backgroundColor: '#FF6B6B' }}
                    textStyle={{}}
                    onPress={() => {/* TODO: delete world */}}
                  >
                    Delete
                  </PrimaryButton>
                )}
                <PrimaryButton
                  style={{ marginLeft: selectedWorld.user_role === 'owner' ? 0 : 'auto' }}
                  textStyle={{}}
                  onPress={() => {
                    router.push(`/main/desktop?worldId=${encodeURIComponent(selectedWorld.world_id)}` as any);
                  }}
                >
                  Open
                </PrimaryButton>
              </View>
            </>
          )}
        </View>
      )}
    </ThemedView>
  );
}