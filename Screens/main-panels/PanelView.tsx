import { AppPage, Button, Heading } from '@/components/ui'
import { useAppParams } from '@/contexts/AppParamsContext'
import { usePlatform } from '@/contexts/PlatformContext'
import { $, tone, useScale, UseTheme } from '@/theme'
import { useRouter } from 'expo-router'
import React from 'react'
import { View } from 'react-native'
import { PanelConfig } from './PanelData'

interface PanelViewProps {
  config: PanelConfig
  worldId?: string
  userRole?: string
  style?: any
  image?: string
}

export function PanelView({
  config,
  worldId,
  userRole,
  style,
  image,
}: PanelViewProps) {
  const { theme } = UseTheme()
  const router = useRouter()
  const S = useScale()
  const { updateParams } = useAppParams()
  // Centralized platform detection
  const { isDesktop } = usePlatform()

  const navigateToFeature = (featurePath: string) => {
    updateParams({ worldId, userRole })

    const routeParams: Record<string, string> = {}
    if (worldId) routeParams.worldId = worldId
    if (userRole) routeParams.userRole = userRole

    router.push({
      pathname: `/main/${featurePath}` as any,
      params: routeParams,
    })
  }

  const backgroundImage = image ? { uri: image } : undefined

  return (
    <AppPage
      backgroundImage={backgroundImage}
      style={[
        {
          minWidth: 260,
          backgroundColor: image ? 'rgba(0,0,0,0.3)' : $('background', theme),
        },
        style,
      ]}
      contentContainerStyle={{
        justifyContent: 'space-between',
        alignItems: 'center',
        borderRightWidth: isDesktop ? 2 : 0,
        borderRightColor: tone($('border', theme), 'subtle'),
      }}
    >
      {/* ─────────────── Panel Header ─────────────── */}
      <Heading
        align="center"
        style={{
          marginBottom: S.space.md,
          color: $('textPrimary', theme),
        }}
      >
        {config.title}
      </Heading>

      {/* ─────────────── Feature Buttons ─────────────── */}
      <View
        style={{
          width: '100%',
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          gap: S.space.sm,
        }}
      >
        {config.items.map((item, index) => (
          <Button
            key={index}
            text={item.name}
            variant="primary"
            onPress={() => navigateToFeature(item.route)}
            style={{
              width: '85%',
              marginVertical: S.space.xs,
              shadowColor: tone($('shadow', theme), 'alt', undefined, undefined, theme),
            }}
          />
        ))}
      </View>
    </AppPage>
  )
}
