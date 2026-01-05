import { AppLoading, AppPage } from '@/components/ui'
import { AuthStateManager, logger } from '@/lib'
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

  // Cache opened tab screens
  const [tabCache, setTabCache] = useState<Record<string, React.ReactNode>>({})

  // 🔐 Auth check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticated = await AuthStateManager.isAuthenticated()
        if (!authenticated) {
          logger.debug('main-layout', 'User not authenticated')
          router.replace('/login/welcome')
          return
        }
      } catch (error) {
        logger.error('main-layout', 'Main layout auth check error:', error)
        router.replace('/login/welcome')
      } finally {
        setIsCheckingAuth(false)
      }
    }
    checkAuth()
  }, [router])

  // 🧭 Handle tab switching (cached)
  const handleTabChange = (tabKey: string) => {
    setActiveTab(tabKey)

    const worldId = typeof params.worldId === 'string' ? params.worldId : undefined
    const routeParams: any = { tab: tabKey, worldId }

    // Preload the screen if not already cached
    if (!tabCache[tabKey]) {
      const route = `/main/main-landing/${getTabRoute(tabKey)}`
      setTabCache((prev) => ({
        ...prev,
        [tabKey]: <Stack.Screen key={tabKey} name={route} />,
      }))
    }

    // Navigate for consistency (keeps URL updated)
    router.replace({
      pathname: `/main/main-landing`,
      params: routeParams,
    })
  }

  // Tab → Route helper
  const getTabRoute = (tab: string) => {
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
      {/* Cached tab screens */}
      {Object.entries(tabCache).map(([key, element]) => (
        <AppPage
          key={key}
          style={{
            display: key === activeTab ? 'flex' : 'none',
            flex: 1,
          }}
        >
          {element}
        </AppPage>
      ))}

      {/* Default stack for non-tab routes */}
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
