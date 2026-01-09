import type { RouteConfig } from '../navigation-config'

// World selection flow
export const SELECT_ROUTES: RouteConfig[] = [
  {
    path: '/select/world-selection',
    title: 'Select World',
    showTopBar: true,
    showHamburger: true,
    analyticsName: 'select_world',
  },
  {
    path: '/select/create-world',
    title: 'Create World',
    showTopBar: true,
    back: '/select/world-selection',
    analyticsName: 'select_create',
  },
]
