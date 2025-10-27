import { $, S, UseTheme } from '@/theme'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import SettingsMenu from './modals/SettingsModal'
import { IconButtonBar } from './ui/IconButtonBar'

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
}

export default function TopBar({
  title = 'D&D Toolkit',
  showBackButton = true,
  showHamburger = true,
  onBackPress,
  userId,
  worldId,
  userRole,
}: TopBarProps) {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const isMobile = Platform.OS !== 'web' || width < 900
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  const { theme } = UseTheme()
  const insets = useSafeAreaInsets()

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
            <IconButtonBar
              icon="←"
              onPress={handleBackPress}
              color={$('accent', theme)}
              iconColor={$('surface', theme)}
              size={42}
              fontsize={42}
            />
          )}
        </View>

        {/* Center: Title */}
        <Text
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
            <IconButtonBar
              icon="☰"
              onPress={handleHamburgerPress}
              color={$('accent', theme)}
              iconColor={$('surface', theme)}
              size={42}
            />
          )}
        </View>
      </View>

      {/* Custom Settings Menu */}
      <SettingsMenu
        visible={showSettingsMenu}
        onClose={() => setShowSettingsMenu(false)}
        onAccountSettings={() => {
          setShowSettingsMenu(false)
          const routeParams: any = {}
          if (userId) routeParams.userId = userId
          if (worldId) routeParams.worldId = worldId
          if (userRole) routeParams.userRole = userRole

          router.push({
            pathname: '/settings',
            params: routeParams,
          })
        }}
        onReturnToWorldSelection={() => {
          setShowSettingsMenu(false)
          const routeParams: any = {}
          if (userId) routeParams.userId = userId

          router.replace({
            pathname: '/select/world-selection',
            params: routeParams,
          })
        }}
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
