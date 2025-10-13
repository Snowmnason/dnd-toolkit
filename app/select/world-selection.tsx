import LeaveWorldModal from '@/components/create-world/ConfrimLeaveModal';
import EditWorldModal from '@/components/create-world/EditWorldModal';
import CustomLoad from '@/components/custom_components/CustomLoad';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, ScrollView, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import PrimaryButton from '../../components/custom_components/PrimaryButton';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { ComponentStyles, CoreColors, Spacing } from '../../constants/theme';
import { useWorldModal } from '../../hooks/use-world-modal';
import { useWorlds } from '../../lib/useWorlds';



export default function LandingPage() {
  const params = useLocalSearchParams();
  // Extract userId from params and ensure it's a string (not string[])
  const userId = typeof params.userId === 'string' ? params.userId : undefined;
  
  const { selectedWorld, setSelectedWorld, worlds, isLoading, error, retry, refetch } = useWorlds(userId);
  
  const noImageSelected = require('../../assets/images/Miku.png');
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const [mapImage, setMapImage] = useState<string | null>(null);
  
  // Handler to refresh worlds and clear selection
  const handleWorldsChange = () => {
    setSelectedWorld(null); // Clear selected world to avoid showing deleted/left world
    setMapImage(null);
    refetch(); // Refresh the worlds list
  };
  
  // Use the custom hook for modal functionality
  const {
    editModalVisible,
    leaveModalVisible,
    modalWorldName,
    setModalWorldName,
    openEditModal,
    closeEditModal,
    openLeaveModal,
    closeLeaveModal,
    handleConfirmWorldName,
    createGenerateInviteLinkHandler,
    createDeleteWorldHandler,
    generatingLink,

    createRemoveFromWorldHandler,
  } = useWorldModal({
    onWorldsChange: handleWorldsChange, // Refresh worlds list and clear selection after delete/leave/update
  });




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
                    { borderWidth: 5 },
                    isSelected && ComponentStyles.card.selected,
                    world.user_role !== 'owner' && { borderColor: 'rgba(0, 0, 0, 0.2)' }
                  ]}
                  onPress={() => {
                    setMapImage(world.map_image_url);
                    if (isDesktop) {
                      setSelectedWorld(prev => {
                        const newSelection = prev === world ? null : world;
                        setMapImage(newSelection ? world.map_image_url : null);
                        return newSelection;
                      });
                    } else {
                      // Include userId, userRole, and mapImage in the route
                      const routeParams: Record<string, string> = {};
                      if (world.name) routeParams.name = world.name;
                      if (userId) routeParams.userId = userId;
                      routeParams.userRole = world.user_role;
                      if (world.map_image_url) routeParams.mapImage = world.map_image_url;
                      if (world.world_id) routeParams.worldId = world.world_id;
                      
                      const queryString = new URLSearchParams(routeParams).toString();
                      const route = `/select/world-detail/${encodeURIComponent(world.world_id)}?${queryString}`;
                      router.push(route as any);
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
          onPress={() => {
            const routeParams: Record<string, string> = {};

            if (userId) routeParams.userId = userId;

            router.push({
              pathname: '/select/create-world',
              params: routeParams,
            });
          }}
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
      {/* Edit World Modal */}
          <EditWorldModal 
            visible={editModalVisible}
            onClose={closeEditModal}
            worldName={modalWorldName}
            originalWorldName={selectedWorld?.name}
            onWorldNameChange={setModalWorldName}
            onConfirmWorldName={() => handleConfirmWorldName(selectedWorld?.world_id, modalWorldName, userId)}
            onGenerateInviteLink={createGenerateInviteLinkHandler(selectedWorld?.world_id, selectedWorld?.name)}
            onDeleteWorld={createDeleteWorldHandler(selectedWorld?.world_id, userId)}
            generatingLink={generatingLink}
          />
          <LeaveWorldModal
            visible={leaveModalVisible} 
            onClose={closeLeaveModal}
            worldName={modalWorldName}
            onLeaveWorld={createRemoveFromWorldHandler(selectedWorld?.world_id, userId)}
          />
          {/* World Preview */}
          <View style={{ position: 'absolute', top: 30, left: 50, zIndex: 10, backgroundColor: CoreColors.backgroundDark}}>
          </View>
          <Image
            source={mapImage || noImageSelected}
            resizeMode="contain"
            style={{ width: '100%', height: '100%', zIndex: -1 }}
          />
          {selectedWorld && (
            <>
              <ThemedText type="title" style={{ position: 'absolute', top: 24, left: 0, right: 0, textAlign: 'center', }}>
                {selectedWorld.name}
              </ThemedText>
              <View style={{position: 'absolute',bottom: 44,left: 54,right: 54,flexDirection: 'row',justifyContent: 'space-between',}}>
                {/* Show Edit for owners, Leave for non-owners */}
                <PrimaryButton 
                  style={{}}
                  textStyle={{}}
                  //disabled={true} //TODO enable when edit modal is fixed
                  onPress={selectedWorld.user_role === 'owner' 
                    ? () => openEditModal(selectedWorld.name)
                    : () => openLeaveModal(selectedWorld.name) //createRemoveFromWorldHandler(selectedWorld.world_id, userId)
                  }
                >
                  {selectedWorld.user_role === 'owner' ? 'Edit' : 'Leave'}
                </PrimaryButton>
                <PrimaryButton
                  style={{ marginLeft: selectedWorld.user_role === 'owner' ? 0 : 'auto' }}
                  textStyle={{}}
                  onPress={() => {
                    const routeParams: Record<string, string> = { worldId: selectedWorld.world_id };
                      if (userId) routeParams.userId = userId;
                      routeParams.userRole = selectedWorld.user_role;

                      router.push({
                        pathname: '/main/desktop',
                        params: routeParams,
                      });
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