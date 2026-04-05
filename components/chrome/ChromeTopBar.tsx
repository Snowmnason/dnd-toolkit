import { ObjHeading } from '@/components/ui'
import { IconButton } from '@/components/ui/IconButton'
import { $, UseTheme } from '@/theme'
import { memo, useEffect, useRef } from 'react'
import {
    AccessibilityInfo,
    Platform,
    View,
    useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export interface ChromeTopBarProps {
  title: string
  showBackButton: boolean
  showHamburger: boolean
  onBackPress?: () => void
  onHamburgerPress: () => void
  a11yFocusTarget?: 'title' | 'firstInteractive' | 'none'
}

export const ChromeTopBar = memo(function ChromeTopBar({
  title,
  showBackButton,
  showHamburger,
  onBackPress,
  onHamburgerPress,
  a11yFocusTarget = 'title',
}: ChromeTopBarProps) {
  const { width } = useWindowDimensions()
  const isMobile = Platform.OS !== 'web' || width < 900
  const { theme } = UseTheme()
  const insets = useSafeAreaInsets()
  const lastAnnouncedTitle = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (a11yFocusTarget !== 'title') return
    if (lastAnnouncedTitle.current === title) return
    lastAnnouncedTitle.current = title
    AccessibilityInfo.announceForAccessibility(title)
  }, [a11yFocusTarget, title])

  return (
    <View
      accessibilityRole="header"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 8,
        paddingTop: isMobile ? insets.top + 8 : 8,
        backgroundColor: $('ChromeBackground'),
        borderBottomWidth: 1,
        borderBottomColor: $('ChromeBorder'),
      }}
    >
      {/* Left slot */}
      <View style={{ width: 56, alignItems: 'center', justifyContent: 'center' }}>
        {showBackButton && (
          <IconButton
            variant="text"
            content="←"
            textColor={$('ChromeText', theme)}
            onPress={onBackPress}
            size="lg"
          />
        )}
      </View>

      {/* Center slot */}
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          ...(Platform.OS === 'web' ? { pointerEvents: 'none' as const } : {}),
        }}
        pointerEvents={Platform.OS === 'web' ? undefined : 'none'}
      >
        <ObjHeading
          fontSize="$heading3"
          variant="bold"
          color="$ChromeText"
          align="center"
          numberOfLines={1}
          accessible
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          style={{ marginBottom: 0, flexShrink: 1 }}
        >
          {title}
        </ObjHeading>
      </View>

      {/* Right slot */}
      <View style={{ width: 56, alignItems: 'center', justifyContent: 'center' }}>
        {showHamburger && (
          <IconButton
            variant="text"
            content="☰"
            textColor={$('ChromeText', theme)}
            onPress={onHamburgerPress}
            size="lg"
          />
        )}
      </View>
    </View>
  )
})
