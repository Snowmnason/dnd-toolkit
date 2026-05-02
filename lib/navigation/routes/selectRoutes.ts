import type { RouteConfig } from '../navigationConfig'

// World selection flow
export const SELECT_ROUTES: RouteConfig[] = [
  {
    path: '/select/world-selection',
    semanticId: 'world-selection',
    title: 'Select World',
    analyticsName: 'select_world',
  },
  {
    path: '/select/create-world',
    title: 'Create World',
    analyticsName: 'select_create',
  },
]
