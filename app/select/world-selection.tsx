import LeaveWorldModal from '@/components/create-world/ConfrimLeaveModal';
import EditWorldModal from '@/components/create-world/EditWorldModal';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, useWindowDimensions } from 'react-native';
import { Button, ScrollView, Text, View } from 'tamagui';
import CustomLoad from '../../components/ui/CustomLoad';
// import { ComponentStyles } from '../../constants/theme'; // deprecated
import { Spacing } from '../../constants/theme';
import { useAppParams } from '../../contexts/AppParamsContext';
import { useWorldModal } from '../../hooks/use-world-modal';
import { useWorlds } from '../../lib/useWorlds';



export default function LandingPage() {
  // Use centralized params context
  const { params, updateParams } = useAppParams();
  const userId = params.userId;
  
  const { selectedWorld, setSelectedWorld, worlds, isLoading, error, refetch } = useWorlds(userId);
  
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <CustomLoad size="large" />
        <Text 
        //style={{ marginTop: 16, color: CoreColors.textSecondary }}
        >
          Loading your worlds...
        </Text>
      </View>
    );
  }

  // Show error screen
  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: '#FF6B6B', textAlign: 'center', marginBottom: 20 }}>
          {error}
        </Text>
        <Button 
        //variant="secondary" onPress={retry}
        >
          Try Again
        </Button>
      </View>
    );
  }

  // Main layout - unified for both mobile and desktop
  return (
    <View style={{ 
      //bg=
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
        //borderRightColor: CoreColors.borderPrimary,
        position: 'relative',
        minWidth: isDesktop ? 100 : undefined,
        maxWidth: isDesktop ? 400 : undefined,
      }}>
        
        <ScrollView style={{ flex: 1, marginBottom: 64, paddingBottom: 100 }}>
          
          {/* World List */}
          {worlds.length === 0 ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text 
              //style={{ textAlign: 'center', color: CoreColors.backgroundLight }}
              >
                No worlds yet. Create your first world to get started!
              </Text>
            </View>
          ) : (
            worlds.map((world) => {
              const isSelected = selectedWorld?.world_id === world.world_id;
              
              return (
                <Button
                  key={world.world_id}
                  style={{ marginBottom: Spacing.xs, borderWidth: isSelected ? 3 : 2, borderRadius: 8, borderColor: world.user_role !== 'owner' ? 'rgba(0,0,0,0.2)' : undefined }}
                  onPress={() => {
                    setMapImage(world.map_image_url);
                    if (isDesktop) {
                      setSelectedWorld(prev => {
                        const newSelection = prev === world ? null : world;
                        setMapImage(newSelection ? world.map_image_url : null);
                        return newSelection;
                      });
                    } else {
                      // Update centralized params context
                      updateParams({
                        userId,
                        worldId: world.world_id,
                        userRole: world.user_role,
                      });

                      // Include only display params in the route (context handles the rest)
                      const routeParams: Record<string, string> = {};
                      if (world.name) routeParams.name = world.name;
                      if (world.map_image_url) routeParams.mapImage = world.map_image_url;
                      
                      const queryString = new URLSearchParams(routeParams).toString();
                      const route = `/select/world-detail/${encodeURIComponent(world.world_id)}?${queryString}`;
                      router.push(route as any);
                    }
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text 
                        numberOfLines={1} 
                        style={{ fontSize: 20,fontWeight: 'bold',
                          //color: isSelected ? CoreColors.textPrimary : CoreColors.textSecondary
                        }}
                        >
                        {world.name}
                      </Text>
                    </View>
                  </View>
                </Button>
              );
            })
          )}
          
        </ScrollView>
        
        {/* Create New World Button */}
        <Button
          style={{position: 'absolute',left: Spacing.md,right: Spacing.md,bottom: Spacing.md,borderRadius: 14}} 
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
        </Button>
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
          <View //style={{ position: 'absolute', top: 30, left: 50, zIndex: 10, backgroundColor: CoreColors.backgroundDark}}
          >
          </View>
          <Image
            source={mapImage || noImageSelected}
            resizeMode="contain"
            style={{ width: '100%', height: '100%', zIndex: -1 }}
          />
          {selectedWorld && (
            <>
              <Text style={{ position: 'absolute', top: 24, left: 0, right: 0, textAlign: 'center', fontWeight: '700', fontSize: 24 }}>
                {selectedWorld.name}
              </Text>
              <View style={{position: 'absolute',bottom: 44,left: 54,right: 54,flexDirection: 'row',justifyContent: 'space-between',}}>
                {/* Show Edit for owners, Leave for non-owners */}
                <Button 
                  style={{}}
                  //variant={selectedWorld.user_role === 'owner' ? 'secondary' : 'cancel'}
                  onPress={selectedWorld.user_role === 'owner' 
                    ? () => openEditModal(selectedWorld.name)
                    : () => openLeaveModal(selectedWorld.name) //createRemoveFromWorldHandler(selectedWorld.world_id, userId)
                  }
                >
                  {selectedWorld.user_role === 'owner' ? 'Edit' : 'Leave'}
                </Button>
                <Button
                  style={{ marginLeft: selectedWorld.user_role === 'owner' ? 0 : 'auto' }}
                  //variant="primary"
                  onPress={() => {
                    // Update centralized params context
                    updateParams({
                      userId,
                      worldId: selectedWorld.world_id,
                      userRole: selectedWorld.user_role,
                    });

                    // Navigate with params in URL (for page refresh/direct access support)
                    router.push({
                      pathname: '/main/desktop',
                      params: {
                        userId: userId || '',
                        worldId: selectedWorld.world_id,
                        userRole: selectedWorld.user_role,
                      },
                    });
                  }}
                >
                  Open
                </Button>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}