import { Button, Card, Heading } from '@/components/ui'
import { useAppParams } from '@/contexts/AppParamsContext'
import { usePlatform } from '@/contexts/PlatformContext'
import { WorldWithAccess } from '@/lib/database/worlds'
import { $, tone, useScale, UseTheme } from '@/theme'
import { useRouter } from 'expo-router'
import React from 'react'
import { Image, View } from 'react-native'

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

  return (
    <View style={{ flex: 1, position: 'relative' }}>
      {/* Map Preview - fills entire container */}
      <Image
        source={mapImage ? { uri: mapImage } : noImageSelected}
        resizeMode={isDesktop ? "cover" : "contain"}
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
              borderColor: tone($('border', theme), 'subtle', undefined, undefined, theme),
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
              style={{ minWidth: 140, maxWidth: '20%' }}
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
              style={{ minWidth: 140, maxWidth: '20%' }}
            />
          </View>
        </>
      )}
    </View>
  )
}
