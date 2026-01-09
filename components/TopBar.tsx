import { logger } from '@/lib'
import { S, UseTheme } from '@/theme'
import { useRouter, useSegments } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
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

export default function TopBar({
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
  const titleRef = useRef<Text>(null)

  // A11y: Focus title on route change for screen readers
  useEffect(() => {
    if (a11yFocusTarget === 'title' && Platform.OS === 'web' && titleRef.current) {
      // On web, focus the text element to announce route change to screen readers
      try {
        (titleRef.current as any).focus?.()
      } catch {
        // Focus may not be available on all RN Web elements; silently fail
      }
    }
  }, [segments, a11yFocusTarget])

  const handleBackPress = () => {
    if (onBackPress) onBackPress()
    else router.back()
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
          ref={titleRef}
          accessibilityRole="header"
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
            const routeParams: any = {}
            if (worldId) routeParams.worldId = worldId
            if (userRole) routeParams.userRole = userRole

            try {
              const { AuthStateManager } = await import('@/lib/auth-state');
              const user = await AuthStateManager.getUserData();
              const raw = user?.username || 'user';
              const username = encodeURIComponent(raw);
              const qs = Object.keys(routeParams).length
                ? `?${new URLSearchParams(routeParams).toString()}`
                : '';
              router.push(`/settings/${username}${qs}`);
            } catch (err) {
              logger.warn('TopBar: failed to resolve username route, falling back', err);
              setShowErrorToast(true);
            }
          }}
        onReturnToWorldSelection={() => {
          setShowSettingsMenu(false)
          router.replace('/select/world-selection')
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
