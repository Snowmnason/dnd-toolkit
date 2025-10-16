import type { AppTamaguiConfig } from '../tamagui.config'

declare module 'tamagui' {
  // Augment Tamagui to use our generated config types (must be non-empty)
  interface TamaguiCustomConfig extends AppTamaguiConfig {
    _appBrand?: 'dnd-toolkit'
  }
}
