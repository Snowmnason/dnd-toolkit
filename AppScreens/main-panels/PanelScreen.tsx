import { AppPage } from '@/components/ui'
import type { AccessRole } from '@/hooks/storage'
import { useLocalSearchParams } from 'expo-router'
import { panelConfigs } from './PanelData'
import { PanelView } from './PanelView'

interface PanelScreenProps {
  /** The panel key from PanelData (e.g. 'characters', 'items'). */
  panelKey: string
}

/**
 * Shared container for a single mobile panel screen.
 * Resolves the panel config by key, reads worldId/userRole from URL params,
 * and renders PanelView inside a full-page layout.
 *
 * Each panel route simply renders <PanelScreen panelKey="characters" />.
 */
export function PanelScreen({ panelKey }: PanelScreenProps) {
  const params = useLocalSearchParams()
  const worldId = typeof params.worldId === 'string' ? params.worldId : undefined
  const userRole =
    typeof params.userRole === 'string' ? (params.userRole as AccessRole) : undefined

  const config = panelConfigs.find((p) => p.key === panelKey) ?? panelConfigs[0]

  return (
    <AppPage style={{ flex: 1 }}>
      <PanelView
        config={config}
        worldId={worldId}
        userRole={userRole}
        image={config.image ?? undefined}
      />
    </AppPage>
  )
}
