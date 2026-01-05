// 🗂️ Theme Registry
// Centralized theme registration without circular dependencies
import { classicTheme } from './families/Classic'
import { cyberpunkTheme } from './families/Cyberpunk'

/**
 * 🗂️ Registered themes
 */
export const allThemes = {
  classic: classicTheme,
  cyberpunk: cyberpunkTheme,
} as const

export type ThemeFamilyName = keyof typeof allThemes
