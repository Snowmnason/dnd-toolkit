import { panelConfigs } from '@/components/main-panels/PanelData'
import { PanelView } from '@/components/main-panels/PanelView'
import { AppPage } from '@/components/ui'
import { useLocalSearchParams } from 'expo-router'
import React from 'react'

export default function MainScreenDesktop() {
  const params = useLocalSearchParams()
  const userId = typeof params.userId === 'string' ? params.userId : undefined
  const worldId = typeof params.worldId === 'string' ? params.worldId : undefined
  const userRole = typeof params.userRole === 'string' ? params.userRole : undefined

  return (
    <AppPage
      style={{
        flexDirection: 'row',
        flex: 1,
        justifyContent: 'space-evenly',
        alignItems: 'stretch',
      }}
    >
      {panelConfigs.map((panel) => (
        <PanelView
          key={panel.key}
          config={panel}
          userId={userId}
          worldId={worldId}
          userRole={userRole}
          image={panel.image ?? undefined}
        />
      ))}
    </AppPage>
  )
}
