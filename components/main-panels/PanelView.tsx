import { AppPage, Button, Heading } from '@/components/ui'
import { useAppParams } from '@/contexts/AppParamsContext'
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
          flex: 1,
          justifyContent: 'space-between',
          alignItems: 'center',
          minWidth: 260,
          padding: S.space.lg,
        },
        style,
      ]}
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
