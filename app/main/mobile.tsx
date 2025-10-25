import { panelConfigs } from '@/components/main-panels/PanelData'
import { PanelView } from '@/components/main-panels/PanelView'
import { AppView } from '@/components/ui'
import { useLocalSearchParams } from 'expo-router'
import React from 'react'

export default function MainScreenMobile() {
  const params = useLocalSearchParams()
  const userId = typeof params.userId === 'string' ? params.userId : undefined
  const worldId = typeof params.worldId === 'string' ? params.worldId : undefined
  const userRole = typeof params.userRole === 'string' ? params.userRole : undefined
  const tab = typeof params.tab === 'string' ? params.tab : 'characters'

  // Determine which panel is active based on tab param
  const activePanel = panelConfigs.find((p) => p.key === tab) || panelConfigs[0]

  return (
    <AppView variant="page" style={{ flex: 1 }}>
      <PanelView
        config={activePanel}
        userId={userId}
        worldId={worldId}
        userRole={userRole}
        image={activePanel.image ?? undefined}
      />
    </AppView>
  )
}
