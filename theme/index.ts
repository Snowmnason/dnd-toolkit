// 🔮 Central theme entry point — exports, registration & preload
import { logger } from '@/lib/utils/logger'
import { allThemes, ThemeFamilyName } from './themeRegistry'

// 🧱 Theme registry (re-export)
export { allThemes, ThemeFamilyName } from './themeRegistry'

// 🔁 Public exports
export * from './families/Classic'
export * from './families/Cyberpunk'
export * from './ThemeProvider'
export * from './tokens'
export * from './ultils/colorUtils'
export * from './ultils/sizing'
export * from './ultils/tokens'

// 🎯 Dynamic sizing hook (re-export from provider)
export { useScale } from '@/providers/ScaleProvider'

/**
 * ⚡ Preload all theme assets (fonts, async color maps, etc.)
 * Optional: call once during bootstrap.
 */
export async function preloadThemes() {
  try {
    for (const [name, theme] of Object.entries(allThemes)) {
      if (typeof (theme as any).preload === 'function') {
        await (theme as any).preload()
        logger.debug('other', `Preloaded assets for theme: ${name}`)
      }
    }
    logger.debug('other', 'All themes preloaded successfully')
  } catch (error) {
    logger.warn('other', 'Theme preload error (non-critical):', error)
  }
}

/**
 * 🌈 Helper: safely fetch a theme family
 * falls back to "classic" if key not found.
 */
export function getThemeFamily(name?: string) {
  return allThemes[name as ThemeFamilyName] ?? allThemes.classic
}
