import { ConfirmLeaveModal, EditWorldModal } from "@/components/modals";
import { AppLoading, AppPage, AppSplit, Body, Button } from "@/components/ui";
import { usePanelNavigation } from "@/hooks/navigation/use-panel-navigation";
import { useWorlds } from "@/hooks/storage";
import { useWorldModal } from "@/hooks/utils/use-world-modal";
import {
  useAppParamsStable,
  useUserId,
} from "@/providers/AppParamsStableProvider";
import { WorldListPanel } from "@/Screens/select/world-selection/WorldListPanel";
import { WorldRightPanel } from "@/Screens/select/world-selection/WorldRightPanel";
import { useScale } from "@/theme";
import { useEffect, useState } from "react";

// Fallback image
const noImageSelected = require("../../assets/images/Miku.png");

export default function LandingPage() {
  // Centralized params
  const userId = useUserId();
  const { setConnectedWorldIds } = useAppParamsStable();

  // Panel navigation hook - manages left/right panel switching
  const { showRightPanel, goToRightPanel, goToLeftPanel, isDesktop } =
    usePanelNavigation();

  const S = useScale();

  const {
    selectedWorld,
    setSelectedWorld,
    worlds,
    isLoading,
    error,
    retry,
    refetch,
  } = useWorlds(userId, setConnectedWorldIds);
  const [mapImage, setMapImage] = useState<string | null>(null);
  
  // Race condition fix: Keep splash screen visible until worlds load or timeout expires
  // This prevents empty world list UI during fresh login
  const [loadingTimeoutExpired, setLoadingTimeoutExpired] = useState(false);
  
  useEffect(() => {
    // Reset timeout when loading starts
    if (isLoading) {
      setLoadingTimeoutExpired(false);
    }
    
    // Set timeout: wait up to 5 seconds for worlds to load
    // After 5s, show the UI anyway (assumes fresh account with no worlds)
    const timer = setTimeout(() => {
      setLoadingTimeoutExpired(true);
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [isLoading]);

  // Modal controls via hook
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
    onWorldsChange: () => {
      setSelectedWorld(null);
      setMapImage(null);
      refetch();
    },
  });

  // Loading state (use your modern loader view)
  // Show splash screen while loading, unless timeout expired (handles fresh account with 0 worlds)
  if (isLoading && !loadingTimeoutExpired) {
    return <AppLoading loadMessage="Loading your worlds..." />;
  }

  // Error state
  if (error) {
    return (
      <AppPage center gap="lg">
        <Body align="center" color="$destructive" style={{ marginBottom: S.space.md }}>
          {error}
        </Body>
        <Button variant="outlined" text="Try Again" onPress={retry} />
      </AppPage>
    );
  }

  // Handler for mobile world selection - shows right panel instead of navigating
  const handleMobileWorldSelect = (world: (typeof worlds)[0]) => {
    setSelectedWorld(world);
    setMapImage(world.map_image_url || null);
    goToRightPanel();
  };

  // Handler for mobile back from right panel to list
  const handleMobileBackToList = () => {
    setSelectedWorld(null);
    setMapImage(null);
    goToLeftPanel();
  };

  // Left Panel Component - Always rendered to avoid hook order issues
  const LeftPanel = (
    <WorldListPanel
      worlds={worlds}
      selectedWorld={selectedWorld}
      setSelectedWorld={setSelectedWorld}
      setMapImage={setMapImage}
      onMobileWorldSelect={!isDesktop ? handleMobileWorldSelect : undefined}
    />
  );

  // Right Panel Component - Always rendered to avoid hook order issues
  const RightPanel = (
    <WorldRightPanel
      selectedWorld={selectedWorld}
      mapImage={mapImage}
      noImageSelected={noImageSelected}
      onEditOrLeave={
        selectedWorld && (selectedWorld.user_role === "dm" || selectedWorld.owner_id === userId)
          ? () => openEditModal(selectedWorld.name)
          : () => openLeaveModal(selectedWorld?.name || "")
      }
    />
  );

  return (
    <>
      <AppSplit
        left={LeftPanel}
        right={RightPanel}
        animateRightSlide={!isDesktop}
        rightVisible={showRightPanel}
        onMobileRightPanelClose={
          !isDesktop ? handleMobileBackToList : undefined
        }
      />

      {/* Modals rendered unconditionally to avoid hook order issues */}
      <EditWorldModal
        visible={!!editModalVisible}
        onClose={closeEditModal}
        worldName={modalWorldName}
        originalWorldName={selectedWorld?.name}
        onWorldNameChange={setModalWorldName}
        onConfirmWorldName={() =>
          handleConfirmWorldName(
            selectedWorld?.world_id,
            modalWorldName,
            userId,
          )
        }
        onGenerateInviteLink={createGenerateInviteLinkHandler(
          selectedWorld?.world_id,
          selectedWorld?.name,
        )}
        onDeleteWorld={createDeleteWorldHandler(
          selectedWorld?.world_id,
          userId,
        )}
        generatingLink={generatingLink}
      />
      <ConfirmLeaveModal
        visible={!!leaveModalVisible}
        onClose={closeLeaveModal}
        worldName={modalWorldName}
        onConfirmLeave={createRemoveFromWorldHandler(
          selectedWorld?.world_id,
          userId,
        )}
      />
    </>
  );
}
