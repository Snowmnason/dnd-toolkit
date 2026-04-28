/**
 * Parent Panel Resolver
 *
 * Maps nested main routes back to their parent panel entry point.
 * Used for determining active bottom-bar tab on nested feature routes.
 */

export type PanelKey = 'characters' | 'items' | 'world' | 'combat' | 'story';

/**
 * Resolve the parent panel key for a given route path.
 * Returns null for routes that don't belong to a panel.
 *
 * @example
 * resolveParentPanel('/main/characters-npcs/character-sheets') → 'characters'
 * resolveParentPanel('/main/items-treasure/inventory') → 'items'
 * resolveParentPanel('/main/main-landing') → null
 */
export function resolveParentPanel(routePath: string): PanelKey | null {
  if (!routePath || typeof routePath !== 'string') {
    return null;
  }

  const normalized = routePath.toLowerCase().trim();

  // Mobile panel entry routes
  if (normalized.startsWith('/main/characters')) return 'characters';
  if (normalized.startsWith('/main/items')) return 'items';
  if (normalized.startsWith('/main/world')) return 'world';
  if (normalized.startsWith('/main/combat')) return 'combat';
  if (normalized.startsWith('/main/story')) return 'story';

  // Desktop nested routes
  if (normalized.startsWith('/main/characters-npcs')) return 'characters';
  if (normalized.startsWith('/main/items-treasure')) return 'items';
  if (normalized.startsWith('/main/world-exploration')) return 'world';
  if (normalized.startsWith('/main/combat-events')) return 'combat';
  if (normalized.startsWith('/main/story-notes')) return 'story';

  return null;
}

/**
 * Get the mobile panel-entry route for a panel key.
 */
export function getPanelEntryRoute(panelKey: PanelKey): string {
  switch (panelKey) {
    case 'characters':
      return '/main/characters';
    case 'items':
      return '/main/items';
    case 'world':
      return '/main/world';
    case 'combat':
      return '/main/combat';
    case 'story':
      return '/main/story';
  }
}
