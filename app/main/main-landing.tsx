import { panelConfigs } from '@/Screens/main-panels/PanelData'
import { PanelView } from '@/Screens/main-panels/PanelView'
import { AppPage } from '@/components/ui'
import { usePlatform } from '@/contexts/PlatformContext'
import { useLocalSearchParams } from 'expo-router'
import React from 'react'
import { View } from 'react-native'

export default function MainLanding() {
  const params = useLocalSearchParams()
  const worldId = typeof params.worldId === 'string' ? params.worldId : undefined
  const userRole = typeof params.userRole === 'string' ? params.userRole : undefined
  const tab = typeof params.tab === 'string' ? params.tab : 'characters'

  // Centralized platform detection
  const { isDesktop } = usePlatform()

  // Desktop Layout - Show all panels in a grid
  if (isDesktop) {
    return (
      <View
        style={{
          flexDirection: 'row',
          flex: 1,
        }}
      >
        {panelConfigs.map((panel) => (
          <PanelView
            key={panel.key}
            config={panel}
            worldId={worldId}
            userRole={userRole}
            image={panel.image ?? undefined}
          />
        ))}
      </View>
    )
  }

  // Mobile Layout - Show single active panel based on tab param
  const activePanel = panelConfigs.find((p) => p.key === tab) || panelConfigs[0]

  return (
    <AppPage style={{ flex: 1 }}>
      <PanelView
        config={activePanel}
        worldId={worldId}
        userRole={userRole}
        image={activePanel.image ?? undefined}
      />
    </AppPage>
  )
}
