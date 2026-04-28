import {
  resolveParentPanel,
  type PanelKey,
} from '@/lib/navigation/routes/resolvers/parent-panel-resolver'
import { usePathname } from 'expo-router'

/**
 * useActivePanel
 *
 * Derives the currently active panel key from the current route path.
 * Returns null if the current route does not belong to any panel.
 *
 * Uses the parent-panel resolver so nested feature routes
 * (e.g. /main/characters-npcs/character-sheets) correctly resolve to their
 * parent panel ('characters').
 */
export function useActivePanel(): PanelKey | null {
  const pathname = usePathname()
  return resolveParentPanel(pathname)
}
