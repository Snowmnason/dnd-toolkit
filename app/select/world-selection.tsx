import { ConfirmLeaveModal, EditWorldModal } from '@/components/modals'
import { AppLoadingView, AppView, Body, Button, Card, Heading } from '@/components/ui'
import { useAppParams } from '@/contexts/AppParamsContext'
import { useWorldModal } from '@/hooks/use-world-modal'
import { useWorlds } from '@/lib'
import { $, tone, useScale } from '@/theme'
import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import { Image, Platform, ScrollView, useWindowDimensions } from 'react-native'

// Fallback image
const noImageSelected = require('../../assets/images/Miku.png')

export default function LandingPage() {
  // Centralized params
  const { params, updateParams } = useAppParams()
  const S = useScale()
  const userId = params.userId

  const { width } = useWindowDimensions()
  const isDesktop =
    Platform.OS === 'web' ||
    Platform.OS === 'macos' ||
    Platform.OS === 'windows' ||
    width >= 900

  const { selectedWorld, setSelectedWorld, worlds, isLoading, error, retry, refetch } = useWorlds(userId)
  const [mapImage, setMapImage] = useState<string | null>(null)

  const router = useRouter()

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
    return <AppLoadingView loadMessage="Loading your worlds..." />
  }

  // Error state
  if (error) {
    return (
      <AppView variant="page" center gap="md">
        <Body align="center" color="$destructive">
          {error}
        </Body>
        <Button variant='outlined' text="Try Again" onPress={retry} />
      </AppView>
    )
  }

  // Build Left Panel content
  const LeftPanel = (
    <AppView
      style={{
        flex: 1,
        position: 'relative',
        minWidth: isDesktop ? 100 : undefined,
        maxWidth: isDesktop ? 400 : undefined,
        paddingTop: isDesktop ? S.space.sm : 0,
      }}
    >
      {/* World List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: S.space.xxl * 2, // make room for bottom button
          paddingHorizontal: S.space.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        {worlds.length === 0 ? (
          <AppView center style={{ padding: S.space.lg }}>
            <Body align="center" color="$textSecondary">
              No worlds yet. Create your first world to get started!
            </Body>
          </AppView>
        ) : (
          worlds.map((world) => {
            const isSelected = selectedWorld?.world_id === world.world_id
            const isOwner = world.user_role === 'owner'

            // Variant rules
            const variant = isSelected
              ? 'solid'
              : isOwner
              ? 'primary'
              : 'secondary'

            return (
              <Button
                key={world.world_id}
                text={world.name}
                variant={variant as any}
                onPress={() => {
                  setMapImage(world.map_image_url || null)
                  if (isDesktop) {
                    setSelectedWorld((prev) => {
                      const newSelection = prev?.world_id === world.world_id ? null : world
                      setMapImage(newSelection ? world.map_image_url || null : null)
                      return newSelection
                    })
                  } else {
                    // Update centralized params context for mobile route
                    updateParams({
                      userId,
                      worldId: world.world_id,
                      userRole: world.user_role,
                    })

                    // Construct a minimal, readable query
                    const routeParams: Record<string, string> = {}
                    if (world.name) routeParams.name = world.name
                    if (world.map_image_url) routeParams.mapImage = world.map_image_url

                    const qs = new URLSearchParams(routeParams).toString()
                    const route = `/select/world-detail/${encodeURIComponent(world.world_id)}?${qs}`
                    router.push(route as any)
                  }
                }}
                style={{
                  width: '100%',
                  marginBottom: S.space.sm,
                  borderWidth: 1.5,
                  borderColor: isSelected
                    ? tone($('primaryButtonBorder'), 'hover')
                    : isOwner
                    ? $('primaryButtonBorder')
                    : $('secondaryButtonBorder'),
                }}
              />
            )
          })
        )}
      </ScrollView>

      {/* Create New World button (bottom-aligned) */}
      <AppView
        style={{
          position: 'absolute',
          left: S.space.md,
          right: S.space.md,
          bottom: S.space.md,
        }}
      >
        <Button
          text="Create New World"
          variant="primary"
          onPress={() => {
            const routeParams: Record<string, string> = {}
            if (userId) routeParams.userId = userId
            router.push({ pathname: '/select/create-world', params: routeParams })
          }}
          style={{ borderRadius: S.radius.lg }}
        />
      </AppView>
    </AppView>
  )

  // Build Right Panel content (desktop only)
  const RightPanel = isDesktop ? (
    <AppView
      style={{
        flex: 2,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* Modals */}
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

      {/* Map Preview */}
      <Image
        source={mapImage ? { uri: mapImage } : noImageSelected}
        resizeMode="contain"
        style={{ width: '100%', height: '100%' }}
      />

      {/* Title overlay in a semi-transparent Card (does not block image) */}
      {selectedWorld && (
        <>
          <Card
            shadow
            bordered
            toneVariant="base"
            style={{
              position: 'absolute',
              top: S.space.lg,
              left: S.space.lg,
              right: S.space.lg,
              padding: S.space.sm,
              backgroundColor: 'rgba(0,0,0,0.3)', // translucent backing
              borderColor: tone($('border'), 'subtle'),
            }}
          >
            <Heading align="center" style={{ color: $('textPrimary'), marginBottom: 0 }}>
              {selectedWorld.name}
            </Heading>
          </Card>

          {/* Bottom action buttons */}
          <AppView
            style={{
              position: 'absolute',
              left: S.space.xl,
              right: S.space.xl,
              bottom: S.space.xl,
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}
          >
            <Button
              text={selectedWorld.user_role === 'owner' ? 'Edit' : 'Leave'}
              variant="outlined"
              onPress={
                selectedWorld.user_role === 'owner'
                  ? () => openEditModal(selectedWorld.name)
                  : () => openLeaveModal(selectedWorld.name)
              }
              style={{ minWidth: 140 }}
            />
            <Button
              text="Open"
              variant="outlined"
              onPress={() => {
                if (!selectedWorld) return
                updateParams({
                  userId,
                  worldId: selectedWorld.world_id,
                  userRole: selectedWorld.user_role,
                })
                router.push({
                  pathname: '/main/desktop',
                  params: {
                    userId: userId || '',
                    worldId: selectedWorld.world_id,
                    userRole: selectedWorld.user_role,
                  },
                })
              }}
              style={{ minWidth: 140 }}
            />
          </AppView>
        </>
      )}
    </AppView>
  ) : (
    // On mobile, we keep it simple: left panel logic navigates to world-detail
    <AppView />
  )

  // Desktop split layout; mobile uses only the left logic which navigates to detail
  if (isDesktop) {
    return <AppView variant="split" scroll left={LeftPanel} right={RightPanel} />
  }

  // Mobile: single column view reusing left content
  return (
    <AppView variant="page" style={{ flex: 1, paddingHorizontal: S.space.md, paddingTop: S.space.sm }}>
      {LeftPanel}
    </AppView>
  )
}
