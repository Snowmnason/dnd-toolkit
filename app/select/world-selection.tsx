import { WorldListPanel } from "@/AppScreens/select/world-selection/WorldListPanel";
import { WorldRightPanel } from "@/AppScreens/select/world-selection/WorldRightPanel";
import { AppPage, AppSplit, Body, Button } from "@/components/ui";
import { useAppKernel } from "@/hooks/kernel";
import { usePanelNavigation } from "@/hooks/navigation";
import { useWorlds } from "@/hooks/storage";
import { useWorldModal } from "@/hooks/utils/use-world-modal";
import {
  useAppParamsStable,
  useUserId,
} from "@/providers";
import { useScale } from "@/theme";
import { useState } from "react";

// Fallback image
const noImageSelected = require("../../assets/images/required/Miku.png");

export default function LandingPage() {
  // Centralized params
  const kernel = useAppKernel();
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
  } = useWorlds(userId, setConnectedWorldIds, { enabled: kernel.phases.appReady });
  const [mapImage, setMapImage] = useState<string | null>(null);

  // Modal controls via hook
  const {
    openEditModal,
    openLeaveModal,
  } = useWorldModal({
    onWorldsChange: () => {
      setSelectedWorld(null);
      setMapImage(null);
      refetch();
    },
  });

  // Loading state
  if (isLoading) {
    return (
      <AppPage center gap="lg">
        <Body align="center">Loading your worlds...</Body>
      </AppPage>
    );
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
          ? () => openEditModal(selectedWorld.name, selectedWorld.world_id)
          : () => openLeaveModal(selectedWorld?.name || "", selectedWorld?.world_id)
      }
    />
  );

  return (
    <AppSplit
      left={LeftPanel}
      right={RightPanel}
      animateRightSlide={!isDesktop}
      rightVisible={showRightPanel}
      onMobileRightPanelClose={
        !isDesktop ? handleMobileBackToList : undefined
      }
    />
  );
}
