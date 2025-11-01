import { AppPage, Body, Button } from '@/components/ui'
import { useAppParams } from '@/contexts/AppParamsContext'
import { WorldWithAccess } from '@/lib/database/worlds'
import { useScale } from '@/theme'
import { useRouter } from 'expo-router'
import React from 'react'
import { Platform, ScrollView, useWindowDimensions } from 'react-native'

interface WorldListPanelProps {
  worlds: WorldWithAccess[]
  selectedWorld: WorldWithAccess | null
  setSelectedWorld: React.Dispatch<React.SetStateAction<WorldWithAccess | null>>
  setMapImage: (url: string | null) => void
}

export function WorldListPanel({ worlds, selectedWorld, setSelectedWorld, setMapImage }: WorldListPanelProps) {
  const S = useScale()
  const router = useRouter()
  const { params, updateParams } = useAppParams()
  const userId = params.userId

  const { width } = useWindowDimensions()
  const isMobile = Platform.OS === 'ios' || Platform.OS === 'android'
  const isDesktop = !isMobile && width >= 900

  return (
    <>
      {/* World List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: S.space.xxl * 2, // make room for bottom button
        }}
        showsVerticalScrollIndicator={false}
      >
        {worlds.length === 0 ? (
          <AppPage center style={{ padding: S.space.lg }}>
            <Body align="center" color="$textSecondary">
              No worlds yet. Create your first world to get started!
            </Body>
          </AppPage>
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
                    if (world.user_role) routeParams.userRole = world.user_role

                    const qs = new URLSearchParams(routeParams).toString()
                    const route = `/select/world-detail/${encodeURIComponent(world.world_id)}?${qs}`
                    router.push(route as any)
                  }
                }}
                style={{
                  width: '100%',
                  marginBottom: S.space.sm,
                }}
              />
            )
          })
        )}
      </ScrollView>

      {/* Create New World button (bottom-aligned) */}
      <AppPage
        style={{
          position: 'absolute',
          left: S.space.md,
          right: S.space.md,
          bottom: S.space.xs,
        }}
      >
        <Button
          text="Create New World"
          variant="primary"
          onPress={() => {
            router.push('/select/create-world')
          }}
          style={{ borderRadius: S.radius.lg }}
        />
      </AppPage>
    </>
  )
}