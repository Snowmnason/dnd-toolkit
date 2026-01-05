import { ConfirmLeaveModal, EditWorldModal } from '@/components/modals'
import { AppLoading, AppPage, AppSplit, Body, Button } from '@/components/ui'
import { useAppParams } from '@/contexts/AppParamsContext'
import { usePanelNavigation } from '@/hooks/use-panel-navigation'
import { useWorldModal } from '@/hooks/use-world-modal'
import { useWorlds } from '@/lib'
import { WorldListPanel } from '@/Screens/select/world-selection/WorldListPanel'
import { WorldRightPanel } from '@/Screens/select/world-selection/WorldRightPanel'
import React, { useState } from 'react'

// Fallback image
const noImageSelected = require('../../assets/images/Miku.png')

export default function LandingPage() {
  // Centralized params
  const { params } = useAppParams()
  const userId = params.userId

  // Panel navigation hook - manages left/right panel switching
  const { showRightPanel, goToRightPanel, goToLeftPanel, isDesktop } = usePanelNavigation()

  const { selectedWorld, setSelectedWorld, worlds, isLoading, error, retry, refetch } = useWorlds(userId)
  const [mapImage, setMapImage] = useState<string | null>(null)

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
      setSelectedWorld(null)
      setMapImage(null)
      refetch()
    },
  })

  // Loading state (use your modern loader view)
  if (isLoading) {
    return <AppLoading loadMessage="Loading your worlds..." />
  }

  // Error state
  if (error) {
    return (
      <AppPage center gap="md">
        <Body align="center" color="$destructive">
          {error}
        </Body>
        <Button variant='outlined' text="Try Again" onPress={retry} />
      </AppPage>
    )
  }

  // Handler for mobile world selection - shows right panel instead of navigating
  const handleMobileWorldSelect = (world: typeof worlds[0]) => {
    setSelectedWorld(world)
    setMapImage(world.map_image_url || null)
    goToRightPanel()
  }

  // Handler to go back to left panel on mobile
  const handleMobileBackToList = () => {
    goToLeftPanel()
    setSelectedWorld(null)
    setMapImage(null)
  }

  // Left Panel Component - Always rendered to avoid hook order issues
  const LeftPanel = (
    <WorldListPanel
      worlds={worlds}
      selectedWorld={selectedWorld}
      setSelectedWorld={setSelectedWorld}
      setMapImage={setMapImage}
      onMobileWorldSelect={!isDesktop ? handleMobileWorldSelect : undefined}
    />
  )

  // Right Panel Component - Always rendered to avoid hook order issues
  const RightPanel = (
    <WorldRightPanel
      selectedWorld={selectedWorld}
      mapImage={mapImage}
      noImageSelected={noImageSelected}
      onEditOrLeave={
        selectedWorld?.user_role === 'owner'
          ? () => openEditModal(selectedWorld.name)
          : () => openLeaveModal(selectedWorld?.name || '')
      }
      onMobileBack={!isDesktop ? handleMobileBackToList : undefined}
    />
  )

  return (
    <>
      <AppSplit 
        left={LeftPanel}
        right={RightPanel}
        animateRightSlide={!isDesktop}
        rightVisible={showRightPanel}
      />

      {/* Modals rendered unconditionally to avoid hook order issues */}
      <EditWorldModal
        visible={!!editModalVisible}
        onClose={closeEditModal}
        worldName={modalWorldName}
        originalWorldName={selectedWorld?.name}
        onWorldNameChange={setModalWorldName}
        onConfirmWorldName={() => handleConfirmWorldName(selectedWorld?.world_id, modalWorldName, userId)}
        onGenerateInviteLink={createGenerateInviteLinkHandler(selectedWorld?.world_id, selectedWorld?.name)}
        onDeleteWorld={createDeleteWorldHandler(selectedWorld?.world_id, userId)}
        generatingLink={generatingLink}
      />
      <ConfirmLeaveModal
        visible={!!leaveModalVisible}
        onClose={closeLeaveModal}
        worldName={modalWorldName}
        onConfirmLeave={createRemoveFromWorldHandler(selectedWorld?.world_id, userId)}
      />
    </>
  )
}
