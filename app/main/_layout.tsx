import { AppLoading } from '@/components/ui'
import { useAppBootstrap } from '@/hooks/use-app-bootstrap'
import { useAuthGuard } from '@/lib'
import { buildNavigationTarget } from '@/lib/navigation/uri-helpers'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Platform, useWindowDimensions, View } from 'react-native'
import { BottomTabBar } from '../../Screens/main-panels/BottomTabBar'

export default function MainLayout() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [activeTab, setActiveTab] = useState('characters')
  const { width } = useWindowDimensions()
  const isMobile = Platform.OS !== 'web' || width < 900

  // 🔐 Centralized auth guard
  const bootstrap = useAppBootstrap()
  const authState = useAuthGuard(bootstrap.isReady)
  useEffect(() => {
    if (authState !== 'loading') {
      setIsCheckingAuth(false)
    }
  }, [authState])

  // Update active tab from URL params
  useEffect(() => {
    const tabParam = typeof params.tab === 'string' ? params.tab : undefined
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam)
    }
  }, [params.tab, activeTab])

  // 🧭 Handle tab switching with centralized navigation helpers
  const handleTabChange = (tabKey: string) => {
    const worldId = typeof params.worldId === 'string' ? params.worldId : undefined

    // Build target using centralized helper - preserves worldId and userRole
    const target = buildNavigationTarget(
      '/main/main-landing',
      { tab: tabKey, worldId },
      ['worldId', 'userRole'],
      { tab: tabKey }
    )

    // Navigate for consistency (keeps URL updated)
    router.replace(target as any)
  }

  // Tab → Route helper (kept for reference; navigation now config-driven)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getTabRoute = (tab: string): string => {
    switch (tab) {
      case 'characters':
        return 'characters-npcs'
      case 'items':
        return 'items-treasure'
      case 'world':
        return 'world-exploration'
      case 'combat':
        return 'combat-events'
      case 'story':
        return 'story-notes'
      default:
        return 'characters-npcs'
    }
  }

  if (isCheckingAuth) {
    return <AppLoading />
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Stack for main routes and nested navigation */}
      <Stack screenOptions={{ headerShown: false }} />

      {/* Bottom bar only for mobile */}
      {isMobile && (
        <BottomTabBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      )}
    </View>
  )
}
