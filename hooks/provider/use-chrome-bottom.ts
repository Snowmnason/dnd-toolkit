import { useNavigation } from '@/hooks/navigation'
import { logger } from '@/hooks/utils'
import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'

/**
 * useChromeBottom
 *
 * Owns all bottom-bar behavior and state:
 * - When bottom bar is visible
 * - What tab is active
 * - What happens on tab press
 *
 * This hook consolidates the logic that was previously split between:
 *   - app/main/_layout.tsx (tab state management + URL sync)
 *   - ChromeLayer.tsx (visibility + rendering)
 *
 * ✅ Decoupled from context: No dependency on ChromeProvider context
 * ✅ URL-driven: Sources tab from URL params, stays in sync
 * ✅ Single responsibility: Only owns bottom-bar behavior
 *
 * Future enhancement: Will be replaced with route-derived activeTab when
 * panels become distinct mobile routes (Phase 2).
 */
export function useChromeBottom() {
  const params = useLocalSearchParams()
  const navigate = useNavigation()
  const [activeTab, setActiveTab] = useState('characters')

  // Sync activeTab from URL params
  useEffect(() => {
    const tabParam = typeof params.tab === 'string' ? params.tab : undefined
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam)
    }
  }, [params.tab, activeTab])

  // Handle tab pressing: update context + navigate with params
  const handleTabChange = (tabKey: string) => {
    setActiveTab(tabKey)

    const worldId = typeof params.worldId === 'string' ? params.worldId : undefined
    const userRole = typeof params.userRole === 'string' ? params.userRole : undefined

    logger.category('navigation').debug('[useChromeBottom] Tab changed', {
      tabKey,
      worldId,
      userRole,
    })

    // Build query string manually for reliability
    const query = new URLSearchParams()
    if (worldId) query.append('worldId', worldId)
    if (userRole) query.append('userRole', userRole)
    query.append('tab', tabKey)

    const target = `/main/main-landing?${query.toString()}`
    navigate.replace(target as any)
  }

  return {
    activeTab,
    onTabChange: handleTabChange,
    visible: true, // Bottom bar always visible on main layout (optional: could be made route-configurable later)
  }
}
