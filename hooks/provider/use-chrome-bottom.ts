import { useNavigation } from '@/hooks/navigation'
import {
  getPanelEntryRoute,
  type PanelKey,
  resolveParentPanel,
} from '@/lib/navigation/routes/resolvers/parent-panel-resolver'
import { useUserRole, useWorldId } from '@/providers'
import { usePathname } from 'expo-router'

/**
 * useChromeBottom
 *
 * Owns all bottom-bar behavior and state:
 * - Active tab derived purely from the current route path (no query params, no local state)
 * - Tab change navigates to the canonical panel-entry route via replace()
 * - worldId/userRole carried through from context on navigation
 */
export function useChromeBottom() {
  const pathname = usePathname()
  const worldId = useWorldId()
  const userRole = useUserRole()
  const navigate = useNavigation()

  // Pure derivation — no state needed
  const activeTab = resolveParentPanel(pathname) ?? 'characters'

  const handleTabChange = (tabKey: string) => {
    const params: Record<string, string> = {}
    if (worldId) params.worldId = worldId
    if (userRole) params.userRole = userRole as string

    navigate.replace(getPanelEntryRoute(tabKey as PanelKey), params)
  }

  return {
    activeTab,
    onTabChange: handleTabChange,
    visible: true,
  }
}
