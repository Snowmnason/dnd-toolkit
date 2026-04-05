import { Body, Caption } from '@/components/ui'
import { panelConfigs } from '@/Screens/main-panels/PanelData'
import { $ } from '@/theme'
import { memo } from 'react'
import { Pressable, View } from 'react-native'

export interface ChromeBottomBarProps {
  activeTab: string
  onTabChange: (tabKey: string) => void
}

export const ChromeBottomBar = memo(function ChromeBottomBar({
  activeTab,
  onTabChange,
}: ChromeBottomBarProps) {

  return (
    <View
      style={{
        flexDirection: 'row',
        height: 80,
        backgroundColor: $('ChromeBackground'),
        borderTopWidth: 1,
        borderTopColor: $('ChromeBorder'),
      }}
    >
      {panelConfigs.map((panel) => {
        const isActive = activeTab === panel.key
        return (
          <Pressable
            key={panel.key}
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              paddingVertical: 5,
            }}
            onPress={() => onTabChange(panel.key)}
          >
            {/* Active highlight layer — accent with low opacity behind content */}
            {isActive && (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: $('accent'),
                  opacity: 0.13,
                }}
              />
            )}
            <Body fontSize={24} style={{ marginBottom: 2 }}>
              {panel.icon}
            </Body>
            <Caption
              color={isActive ? '$accent' : '$ChromeText'}
              variant={isActive ? 'bold' : 'regular'}
              numberOfLines={1}
            >
              {panel.title.split(' ')[0]}
            </Caption>
          </Pressable>
        )
      })}
    </View>
  )
})
