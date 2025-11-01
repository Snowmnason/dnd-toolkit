import { panelConfigs } from '@/Screens/main-panels/PanelData'
import { PanelView } from '@/Screens/main-panels/PanelView'
import { useLocalSearchParams } from 'expo-router'
import React from 'react'
import { View } from 'react-native'

export default function MainScreenDesktop() {
  const params = useLocalSearchParams()
  const worldId = typeof params.worldId === 'string' ? params.worldId : undefined
  const userRole = typeof params.userRole === 'string' ? params.userRole : undefined

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
