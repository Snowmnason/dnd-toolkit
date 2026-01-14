import { useAppParamsStable } from '@/contexts/AppParamsStableContext'
import { buildNavigationTarget } from '@/lib/navigation/uri-helpers'
import { logger } from '@/lib/utils/logger'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Platform, useWindowDimensions, View } from 'react-native'
import { BottomTabBar } from '../../Screens/main-panels/BottomTabBar'

export default function MainLayout() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { hasAccessToWorld, stableParams } = useAppParamsStable()
  const [activeTab, setActiveTab] = useState('characters')
  const { width } = useWindowDimensions()
  const isMobile = Platform.OS !== 'web' || width < 900

  logger.info('[MainLayout] Rendering with params', { 
    worldId: params.worldId, 
    userRole: params.userRole 
  })

  // Validate world access on mount and when worldId changes
  useEffect(() => {
    const urlWorldId = typeof params.worldId === 'string' ? params.worldId : undefined
    const cacheIsPopulated = stableParams.connectedWorldIds.length > 0

    // Skip validation if cache not loaded yet
    if (!cacheIsPopulated) return

    // If no worldId in URL, redirect
    if (!urlWorldId) {
      logger.warn('[MainLayout] No worldId in URL, redirecting to world selection')
      const target = buildNavigationTarget('/select/world-selection', {}, [])
      router.replace(target as any)
      return
    }

    // If worldId not in cache, redirect
    if (!hasAccessToWorld(urlWorldId)) {
      logger.warn('[MainLayout] Invalid world access, redirecting to world selection', { urlWorldId })
      const target = buildNavigationTarget('/select/world-selection', {}, [])
      router.replace(target as any)
      return
    }
  }, [params.worldId, stableParams.connectedWorldIds, hasAccessToWorld, router])

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
