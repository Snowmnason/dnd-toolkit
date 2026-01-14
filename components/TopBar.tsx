import { logger } from '@/lib'
import { buildNavigationTarget } from '@/lib/navigation/uri-helpers'
import { S, UseTheme } from '@/theme'
import { useRouter, useSegments } from 'expo-router'
import { memo, useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import SettingsMenu from './modals/SettingsModal'
import { AppToast } from './ui'
import { IconButton } from './ui/IconButton'

// 🎨 Fixed palette (matches BottomTabBar)
const TOPBAR_BG = '#1f262e'
const TOPBAR_BORDER = '#969696'
const TOPBAR_TEXT = '#F5E6D3'

interface TopBarProps {
  title?: string
  showBackButton?: boolean
  showHamburger?: boolean
  onBackPress?: () => void
  userId?: string
  worldId?: string
  userRole?: string
  a11yFocusTarget?: 'title' | 'firstInteractive' | 'none'
}

function TopBar({
  title = 'D&D Toolkit',
  showBackButton = true,
  showHamburger = true,
  onBackPress,
  userId,
  worldId,
  userRole,
  a11yFocusTarget = 'title',
}: TopBarProps) {
  const router = useRouter()
  const segments = useSegments()
  const { width } = useWindowDimensions()
  const isMobile = Platform.OS !== 'web' || width < 900
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  const [showErrorToast, setShowErrorToast] = useState(false)
  const { theme } = UseTheme()
  const insets = useSafeAreaInsets()
  const lastAnnouncedTitle = useRef<string | undefined>(undefined)

  // A11y: announce title changes for screen readers without relying on DOM focus
  useEffect(() => {
    if (a11yFocusTarget !== 'title') return

    if (lastAnnouncedTitle.current === title) return
    lastAnnouncedTitle.current = title

    // AccessibilityInfo.announceForAccessibility is void; no promise to catch
    AccessibilityInfo.announceForAccessibility(title)
  }, [segments, a11yFocusTarget, title])

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress()
      return
    }
    logger.warn('TopBar back press with no handler; ignoring')
    setShowErrorToast(true)
  }

  const handleHamburgerPress = () => {
    setShowSettingsMenu(true)
  }

  return (
    <>
      <View
        accessibilityRole="header"
        style={[
          styles.container,
          isMobile
            ? [styles.containerMobile, { paddingTop: insets.top + 8 }]
            : styles.containerDesktop,
        ]}
      >
        {/* Left: Back Button */}
        <View style={styles.sideSlot}>
          {showBackButton && (
            <IconButton
              variant="text"
              content="←"
              textColor={TOPBAR_TEXT}
              onPress={handleBackPress}
              size="lg"
            />
          )}
        </View>

        {/* Center: Title */}
        <Text
          accessibilityLiveRegion="polite"
          style={[
            styles.title,
            { fontFamily: theme.fontFamilyTitle, fontSize: S.font.heading3 },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>

        {/* Right: Hamburger Menu */}
        <View style={styles.sideSlot}>
          {showHamburger && (
            <IconButton
              variant="text"
              content="☰"
              textColor={TOPBAR_TEXT}
              onPress={handleHamburgerPress}
              size="lg"
            />
          )}
        </View>
      </View>

      {/* Custom Settings Menu */}
      <SettingsMenu
        visible={showSettingsMenu}
        onClose={() => setShowSettingsMenu(false)}
          onAccountSettings={async () => {
            setShowSettingsMenu(false)

            try {
              const { AuthStateManager } = await import('@/lib/auth/auth-state');
              const user = await AuthStateManager.getUserData();
              const username = user?.username || 'user';
              
              // Use centralized navigation helper for settings route
              const target = buildNavigationTarget(
                `/settings/${encodeURIComponent(username)}`,
                { worldId, userRole },
                ['worldId', 'userRole']
              );
              
              router.push(target as any);
            } catch (err) {
              logger.warn('TopBar: failed to resolve username route, falling back', err);
              setShowErrorToast(true);
            }
          }}
        onReturnToWorldSelection={() => {
          setShowSettingsMenu(false)
          // Use centralized navigation helper
          const target = buildNavigationTarget(
            '/select/world-selection',
            {},
            []
          );
          router.replace(target as any)
        }}
      />

      {/* Error feedback */}
      <AppToast
        visible={showErrorToast}
        message="Failed to navigate to settings. Please try again."
        type="error"
        onHide={() => setShowErrorToast(false)}
      />
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: TOPBAR_BG,
    borderBottomWidth: 1,
    borderBottomColor: TOPBAR_BORDER,
  },
  containerMobile: {
    // Safe area padding handled dynamically
  },
  containerDesktop: {
    paddingTop: 8,
  },
  sideSlot: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: TOPBAR_TEXT,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
})

export default memo(TopBar);
