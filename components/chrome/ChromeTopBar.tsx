import { ObjHeading } from '@/components/ui'
import { IconButton } from '@/components/ui/IconButton'
import { usePanelNavigation } from '@/hooks/navigation'
import { $, UseTheme } from '@/theme'
import { memo, useEffect, useRef } from 'react'
import {
    AccessibilityInfo,
    Platform,
    View,
    useWindowDimensions,
} from 'react-native'
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated'
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
  const panelNav = usePanelNavigation()

  // When right panel is open on mobile, the back arrow rotates ← → →
  // Start at 180° (showing ←), animate to 0° (showing →) when right panel opens
  // This ensures → is the "resting" state when panel is open — safe against failed animations
  // Use isMobile (window width check) not isDesktop, so simulated mobile on web works too
  const isClosePanelMode = panelNav.isActive && isMobile && panelNav.activePanel === 'right'
  const rotation = useSharedValue(isClosePanelMode ? 0 : 180)

  useEffect(() => {
    rotation.value = withTiming(isClosePanelMode ? 0 : 180, {
      duration: 250,
      easing: Easing.out(Easing.cubic),
    })
  }, [isClosePanelMode, rotation])

  const arrowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${rotation.value}deg` }],
  }), [])

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
      {/* Left slot — back arrow rotates ← → → when closing right panel */}
      <View style={{ width: 56, alignItems: 'center', justifyContent: 'center' }}>
        {(showBackButton || isClosePanelMode) && (
          <Animated.View style={arrowAnimatedStyle}>
            <IconButton
              variant="text"
              content="→"
              textColor={$('ChromeText', theme)}
              onPress={onBackPress}
              size="lg"
              //accessibilityLabel={isClosePanelMode ? 'Close panel' : 'Go back'}
            />
          </Animated.View>
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
