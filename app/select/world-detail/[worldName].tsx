import EditWorldModal from '@/components/create-world/EditWorldModal';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, View } from 'react-native';
import PrimaryButton from '../../../components/custom_components/PrimaryButton';
import { ThemedText } from '../../../components/themed-text';
import { ThemedView } from '../../../components/themed-view';
import { Spacing } from '../../../constants/theme';
import { useWorldModal } from '../../../hooks/use-world-modal';

type WorldDetailParams = Record<string, string | string[]>;

export default function WorldDetail() {
  const params = useLocalSearchParams<WorldDetailParams>();
  const router = useRouter();
  
  // Extract and validate parameters
  const worldName = typeof params.name === 'string' ? params.name : '';
  const userId = typeof params.userId === 'string' ? params.userId : undefined;
  const worldId = typeof params.worldId === 'string' ? params.worldId : undefined;
  const userRole = typeof params.userRole === 'string' ? params.userRole : undefined;
  const mapUrl = typeof params.mapImage === 'string' ? params.mapImage : undefined;
  
  // Determine map image source
  const selectedMapImage = mapUrl ? { uri: mapUrl } : require('../../../assets/images/Miku.png');
  
  // Use the custom hook for modal functionality
  const {
    editModalVisible,
    modalWorldName,
    setModalWorldName,
    openEditModal,
    closeEditModal,
    handleConfirmWorldName,
    createGenerateInviteLinkHandler,
    createDeleteWorldHandler,
    createRemoveFromWorldHandler,
  } = useWorldModal({
    // You can provide custom handlers here in the future for mobile-specific behavior
    // onWorldNameUpdate: async (worldId, newName) => { /* mobile-specific logic */ },
    // onDeleteWorld: async (worldId) => { /* mobile-specific delete with navigation */ },
  });
  
  // Helper function to build route parameters
  const buildRouteParams = () => {
    const routeParams: Record<string, string> = {};
    if (userId) routeParams.userId = userId;
    if (worldId) routeParams.worldId = worldId;
    if (userRole) routeParams.userRole = userRole;
    return routeParams;
  };
  
  // Navigation handlers
  const handleOpenWorld = () => {
    router.replace({
      pathname: '/main/mobile',
      params: buildRouteParams(),
    });
  };

  return (
    <ThemedView style={{ flex: 1, alignItems: 'center', padding: Spacing.md }}>
      <View style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <EditWorldModal
            visible={editModalVisible} 
            onClose={closeEditModal}
            worldName={modalWorldName}
            onWorldNameChange={setModalWorldName}
            onConfirmWorldName={() => handleConfirmWorldName(worldId)}
            onGenerateInviteLink={createGenerateInviteLinkHandler(worldId, worldName)}
            onDeleteWorld={createDeleteWorldHandler(worldId)}
          />
        <ThemedText type="title" style={{
          marginBottom: Spacing.md,
          textAlign: 'center',
          fontWeight: '600',
          fontSize: 58
        }}>
          {worldName}
        </ThemedText>
        <Image
          source={selectedMapImage}
          resizeMode="contain"
          style={{ width: '100%', height: '70%', borderRadius: 12, zIndex: 1 }}
        />
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          width: '60%',
          marginBottom: Spacing.md,
        }}>
          {/* Show Edit for owners, Leave for non-owners */}
          <PrimaryButton 
            style={{}}
            textStyle={{}}
            disabled={true} //TODO enable when edit modal is fixed
            onPress={userRole === 'owner' 
              ? () => openEditModal(worldName) 
              : createRemoveFromWorldHandler(worldId)
            }
          >
            {userRole === 'owner' ? 'Edit' : 'Leave'}
          </PrimaryButton>
          <PrimaryButton
            style={{}}
            textStyle={{}}
            onPress={handleOpenWorld}
          >
            Open
          </PrimaryButton>
        </View>
      </View>
    </ThemedView>
  );
}