import { defaultConfig } from '@tamagui/config/v4'
import { createTamagui } from 'tamagui'

export const config = createTamagui({
  ...defaultConfig,
  media: {
    ...defaultConfig.media,
  },
})

export type AppTamaguiConfig = typeof config

export default config

declare module 'tamagui' {
  // Extend with a marker field to satisfy TS (non-empty interface)
  interface TamaguiCustomConfig extends AppTamaguiConfig {
    _appBrand?: 'dnd-toolkit'
  }
}
