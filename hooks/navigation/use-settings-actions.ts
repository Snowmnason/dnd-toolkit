import { useNavigation } from '@/hooks/navigation/use-navigation'
import { useWorldId, useUserRole } from '@/providers/AppParamsVolatileProvider'
import { useModal } from '@/contexts/modal-context'
import { logger } from '@/hooks/utils'

/**
 * useSettingsActions
 *
 * Owns the two action callbacks needed by SettingsModal:
 *   - handleAccountSettings: navigates to /settings/<username>
 *   - handleReturnToWorldSelection: navigates back to world selection
 *
 * Called inside SettingsModal so the modal is self-contained. This keeps
 * _layout.tsx and ChromeLayer free of these domain concerns.
 */
export function useSettingsActions() {
  const navigate = useNavigation()
  const worldId = useWorldId()
  const userRole = useUserRole()
  const { closeModal } = useModal()

  const handleAccountSettings = async () => {
    closeModal()
    try {
      const { AuthStateManager } = await import('@/lib/auth/auth-state')
      const user = await AuthStateManager.getUserData()
      const username = user?.username || 'user'

      const params: Record<string, string> = {}
      if (worldId) params.worldId = worldId
      if (userRole) params.userRole = userRole
      navigate.to(`/settings/${encodeURIComponent(username)}`, params)
    } catch (err) {
      logger.category('navigation').warn('useSettingsActions: failed to resolve username, falling back', err)
    }
  }

  const handleReturnToWorldSelection = () => {
    closeModal()
    navigate.replace('/select/world-selection')
  }

  return { handleAccountSettings, handleReturnToWorldSelection }
}
