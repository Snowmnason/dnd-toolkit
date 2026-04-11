import type { RouteConfig } from '../navigationConfig'

// Web-only routes
export const WEB_ROUTES: RouteConfig[] = [
  {
    path: '/web/download',
    title: 'Download',
    showTopBar: false,
    analyticsName: 'web_download',
  },
]
