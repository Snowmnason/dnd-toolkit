import { useLocalSearchParams, useRouter } from 'expo-router'
import React from 'react'
import { Image } from 'react-native'
import Animated, { FadeInRight } from 'react-native-reanimated'

import { ConfirmLeaveModal, EditWorldModal } from '@/components/modals'
import { AppPage, Body, Button, Heading } from '@/components/ui'
import { useAppParams } from '@/contexts/AppParamsContext'
import { useWorldModal } from '@/hooks/use-world-modal'
import { $, useScale } from '@/theme'

export default function WorldDetail() {
  const S = useScale()
  const router = useRouter()
  const { params: contextParams, updateParams } = useAppParams()
  const urlParams = useLocalSearchParams<Record<string, string | string[]>>()

  const worldName = typeof urlParams.name === 'string' ? urlParams.name : ''
  const mapUrl = typeof urlParams.mapImage === 'string' ? urlParams.mapImage : undefined
  const userId = contextParams.userId
  const worldId = contextParams.worldId
  const userRole = contextParams.userRole

  const selectedMapImage = mapUrl ? { uri: mapUrl } : require('../../../assets/images/Miku.png')

  const handleNavigateBackToSelection = () => {
    router.replace({
      pathname: '/select/world-selection',
      params: userId ? { userId } : {},
    })
  }

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
    onWorldsChange: handleNavigateBackToSelection,
  })

  const buildRouteParams = () => {
    const routeParams: Record<string, string> = {}
    if (userId) routeParams.userId = userId
    if (worldId) routeParams.worldId = worldId
    if (userRole) routeParams.userRole = userRole
    return routeParams
  }

  const handleOpenWorld = () => {
    updateParams({ userId, worldId, userRole })
    router.replace({
      pathname: '/main/mobile',
      params: buildRouteParams(),
    })
  }

  return (
    <AppPage
      center
      style={{ flex: 1, padding: S.space.md }}   // ← replaces `padded`
    >
      {/* Modals */}
      <EditWorldModal
        visible={!!editModalVisible}
        onClose={closeEditModal}
        worldName={modalWorldName}
        originalWorldName={worldName}
        onWorldNameChange={setModalWorldName}
        onConfirmWorldName={() => handleConfirmWorldName(worldId, modalWorldName, userId)}
        onGenerateInviteLink={createGenerateInviteLinkHandler(worldId, worldName)}
        onDeleteWorld={createDeleteWorldHandler(worldId, userId)}
        generatingLink={generatingLink}
      />
      <ConfirmLeaveModal
        visible={!!leaveModalVisible}
        onClose={closeLeaveModal}
        worldName={modalWorldName}
        onConfirmLeave={createRemoveFromWorldHandler(worldId, userId)}
      />

      {/* Animated world content */}
      <Animated.View
        entering={FadeInRight.duration(450).springify().damping(18)}
        style={{
          width: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
        }}
      >
        <Heading
          align="center"
          style={{
            marginBottom: S.space.md,
            fontSize: 48,
            color: $('textPrimary'),
          }}
        >
          {worldName}
        </Heading>

        <Image
          source={selectedMapImage}
          resizeMode="contain"
          style={{
            width: '100%',
            height: '70%',
            borderRadius: S.radius.lg,
            marginBottom: S.space.lg,
          }}
        />

        {/* Button row: replace `row` with flexDirection */}
        <AppPage
          gap="md"
          style={{
            width: '65%',
            flexDirection: 'row',               // ← replaces `row`
            justifyContent: 'space-between',
            marginBottom: S.space.lg,
          }}
        >
          <Button
            text={userRole === 'owner' ? 'Edit' : 'Leave'}
            variant="outlined"
            onPress={
              userRole === 'owner'
                ? () => openEditModal(worldName)
                : () => openLeaveModal(worldName)
            }
            style={{ flex: 1 }}
          />
          <Button
            text="Open"
            variant="primary"
            onPress={handleOpenWorld}
            style={{ flex: 1 }}
          />
        </AppPage>

        <Body align="center" color="$textSecondary" style={{ opacity: 0.8 }}>
          Tap &quot;Open&quot; to enter your world.
        </Body>
      </Animated.View>
    </AppPage>
  )
}
