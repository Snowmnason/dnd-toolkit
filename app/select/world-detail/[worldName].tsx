import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useEffect } from 'react'
import { Image, View } from 'react-native'
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
  // Pull from URL if present (fallback to context)
  const urlUserRole = typeof urlParams.userRole === 'string' ? urlParams.userRole : undefined
  const urlWorldId = typeof urlParams.worldId === 'string' ? urlParams.worldId : undefined
  const urlUserId = typeof urlParams.userId === 'string' ? urlParams.userId : undefined

  const userId = contextParams.userId ?? urlUserId
  const worldId = contextParams.worldId ?? urlWorldId
  const userRole = contextParams.userRole ?? urlUserRole

  const selectedMapImage = mapUrl ? { uri: mapUrl } : require('../../../assets/images/Miku.png')

  const handleNavigateBackToSelection = () => {
    router.replace('/select/world-selection')
  }

  // Persist URL-provided params into context so downstream pages have them
  useEffect(() => {
    const needsUpdate =
      (!!urlUserId && contextParams.userId !== urlUserId) ||
      (!!urlWorldId && contextParams.worldId !== urlWorldId) ||
      (!!urlUserRole && contextParams.userRole !== urlUserRole)
    if (needsUpdate) {
      updateParams({
        userId: urlUserId ?? contextParams.userId,
        worldId: urlWorldId ?? contextParams.worldId,
        userRole: urlUserRole ?? contextParams.userRole,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlUserId, urlWorldId, urlUserRole])

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
    if (worldId) routeParams.worldId = worldId
    if (userRole) routeParams.userRole = userRole
    return routeParams
  }

  const handleOpenWorld = () => {
    updateParams({ worldId, userRole })
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

        {/* Button row: full-width, ends spaced, larger buttons */}
        <View
          style={{
            width: '100%',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: S.space.lg,
          }}
        >
          <Button
            text={userRole === 'owner' ? 'Edit' : 'Leave'}
            variant="outlined"
            size="lg"
            onPress={
              userRole === 'owner'
                ? () => openEditModal(worldName)
                : () => openLeaveModal(worldName)
            }
            style={{ width: '48%' }}
          />
          <Button
            text="Open"
            variant="primary"
            size="lg"
            onPress={handleOpenWorld}
            style={{ width: '48%' }}
          />
        </View>

        <Body align="center" color="$textSecondary" style={{ opacity: 0.8 }}>
          Tap &quot;Open&quot; to enter your world.
        </Body>
      </Animated.View>
    </AppPage>
  )
}
