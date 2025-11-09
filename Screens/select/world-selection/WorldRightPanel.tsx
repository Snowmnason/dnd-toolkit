import { Button, Card, Heading } from '@/components/ui'
import { useAppParams } from '@/contexts/AppParamsContext'
import { usePlatform } from '@/contexts/PlatformContext'
import { WorldWithAccess } from '@/lib/database/worlds'
import { $, useScale, UseTheme } from '@/theme'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { View } from 'react-native'

interface WorldRightPanelProps {
  selectedWorld: WorldWithAccess | null
  mapImage: string | null
  noImageSelected: any
  onEditOrLeave: () => void
  onMobileBack?: () => void
}

export function WorldRightPanel({ selectedWorld, mapImage, noImageSelected, onEditOrLeave, onMobileBack }: WorldRightPanelProps) {
  const S = useScale()
  const { theme } = UseTheme()
  const router = useRouter()
  const { updateParams } = useAppParams()
  const { isDesktop } = usePlatform()
  // Optional flag to disable the large backdrop image if it's causing perf issues
  const DISABLE_BACKDROP = process.env.EXPO_PUBLIC_DISABLE_WORLD_MAP_IMAGE === '1'

  return (
    <View style={{ flex: 1, position: 'relative' }}>
      {/* Map Preview - fills entire container */}
      {!DISABLE_BACKDROP && (
        <Image
          source={mapImage ? { uri: mapImage } : noImageSelected}
          contentFit={isDesktop ? 'cover' : 'contain'}
          priority="low"
          cachePolicy="memory-disk"
          transition={120}
          recyclingKey="world-right-panel-bg"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
          }}
        />
      )}

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
              borderColor: $('borderSubtle' as any),
            }}
          >
            <Heading align="center" style={{ color: $('textPrimary', theme), marginBottom: 0 }}>
              {selectedWorld.name}
            </Heading>
          </Card>

          {/* Bottom action buttons */}
          <View
            style={{
              position: 'absolute',
              left: "1%",
              right: "1%",
              bottom: S.space.xl,
              flexDirection: 'row',
              justifyContent: 'space-between',
              backgroundColor: 'transparent',
            }}
          >
            <Button
              text={selectedWorld.user_role === 'owner' ? 'Edit' : 'Leave'}
              variant="secondary"
              onPress={onEditOrLeave}
              style={{ width: 160 }}
            />
            <Button
              text="Open"
              variant="primary"
              onPress={() => {
                if (!selectedWorld) return
                updateParams({
                  worldId: selectedWorld.world_id,
                  userRole: selectedWorld.user_role,
                })
                router.push({
                  pathname: '/main/main-landing',
                  params: {
                    worldId: selectedWorld.world_id,
                    userRole: selectedWorld.user_role,
                  },
                })
              }}
              style={{ width: 160 }}
            />
          </View>
        </>
      )}
    </View>
  )
}
