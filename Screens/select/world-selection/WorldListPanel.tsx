import { Body, Button } from '@/components/ui'
import { useAppParams } from '@/contexts/AppParamsContext'
import { usePlatform } from '@/contexts/PlatformContext'
import { WorldWithAccess } from '@/lib/database/worlds'
import { buildNavigationTarget } from '@/lib/navigation/uri-helpers'
import { useScale } from '@/theme'
import { useRouter } from 'expo-router'
import React from 'react'
import { ScrollView } from 'react-native'

interface WorldListPanelProps {
  worlds: WorldWithAccess[]
  selectedWorld: WorldWithAccess | null
  setSelectedWorld: React.Dispatch<React.SetStateAction<WorldWithAccess | null>>
  setMapImage: (url: string | null) => void
  onMobileWorldSelect?: (world: WorldWithAccess) => void
}

export function WorldListPanel({ worlds, selectedWorld, setSelectedWorld, setMapImage, onMobileWorldSelect }: WorldListPanelProps) {
  const S = useScale()
  const router = useRouter()
  const { updateParams } = useAppParams()

  // Centralized platform detection
  const { isDesktop } = usePlatform()

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
          <Body align="center" color="$textSecondary" style={{ marginTop: S.space.md, padding: S.space.lg }}>
            No worlds yet. Create your first world to get started!
          </Body>
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
                    // Update centralized params context
                    updateParams({
                      worldId: world.world_id,
                      userRole: world.user_role,
                    })

                    // Mobile: Use callback to switch panels instead of routing
                    if (onMobileWorldSelect) {
                      onMobileWorldSelect(world)
                    }
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
        <Button
          text="Create New World"
          variant="primary"
          onPress={() => {
            const target = buildNavigationTarget('/select/create-world', {}, [])
            router.push(target)
          }}
          style={{ borderRadius: S.radius.lg,
            position: 'absolute',
            left: S.space.md,
            right: S.space.md,
            bottom: S.space.xs,
           }}
        />

    </>
  )
}