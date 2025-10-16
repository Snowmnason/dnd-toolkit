import LeaveWorldModal from '@/components/create-world/ConfrimLeaveModal';
import EditWorldModal from '@/components/create-world/EditWorldModal';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, View } from 'react-native';
import { Text } from 'tamagui';
import AppButton from '../../../components/ui/AppButton';
import { Spacing } from '../../../constants/theme';
import { useAppParams } from '../../../contexts/AppParamsContext';
import { useWorldModal } from '../../../hooks/use-world-modal';

type WorldDetailParams = Record<string, string | string[]>;

export default function WorldDetail() {
  const urlParams = useLocalSearchParams<WorldDetailParams>();
  const router = useRouter();
  const { params: contextParams, updateParams } = useAppParams();
  
  // Extract and validate parameters - prefer URL params for display, but use context for navigation
  const worldName = typeof urlParams.name === 'string' ? urlParams.name : '';
  const userId = contextParams.userId;
  const worldId = contextParams.worldId;
  const userRole = contextParams.userRole;
  const mapUrl = typeof urlParams.mapImage === 'string' ? urlParams.mapImage : undefined;
  
  // Determine map image source
  const selectedMapImage = mapUrl ? { uri: mapUrl } : require('../../../assets/images/Miku.png');
  
  // Navigate back to world selection after delete/leave
  const handleNavigateBackToSelection = () => {
    router.replace({
      pathname: '/select/world-selection',
      params: userId ? { userId } : {},
    });
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
    createRemoveFromWorldHandler,
    generatingLink,
  } = useWorldModal({
    onWorldsChange: handleNavigateBackToSelection, // Navigate back after delete/leave
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
    // Update centralized params context
    updateParams({
      userId,
      worldId,
      userRole,
    });

    router.replace({
      pathname: '/main/mobile',
      params: buildRouteParams(),
    });
  };

  return (
    <View style={{ flex: 1, alignItems: 'center', padding: Spacing.md }}>
      <View style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <EditWorldModal
            visible={editModalVisible}
            onClose={closeEditModal}
            worldName={modalWorldName}
            originalWorldName={worldName}
            onWorldNameChange={setModalWorldName}
            onConfirmWorldName={() => handleConfirmWorldName(worldId, modalWorldName, userId)}
            onGenerateInviteLink={createGenerateInviteLinkHandler(worldId, worldName)}
            onDeleteWorld={createDeleteWorldHandler(worldId, userId)}
            generatingLink={generatingLink}
          />
        <LeaveWorldModal
            visible={leaveModalVisible} 
            onClose={closeLeaveModal}
            worldName={modalWorldName}
            onLeaveWorld={createRemoveFromWorldHandler(worldId, userId)}
          />
        <Text style={{
          marginBottom: Spacing.md,
          textAlign: 'center',
          fontWeight: '600',
          fontSize: 58
        }}>
          {worldName}
        </Text>
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
          <AppButton 
            variant={userRole === 'owner' ? 'secondary' : 'cancel'}
            //disabled={true} //TODO enable when edit modal is fixed
            onPress={userRole === 'owner' 
              ? () => openEditModal(worldName) 
              : () => openLeaveModal(worldName)
            }
          >
            {userRole === 'owner' ? 'Edit' : 'Leave'}
          </AppButton>
          <AppButton
            variant="primary"
            onPress={handleOpenWorld}
          >
            Open
          </AppButton>
        </View>
      </View>
    </View>
  );
}