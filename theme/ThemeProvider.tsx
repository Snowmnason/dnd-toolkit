import AsyncStorage from '@react-native-async-storage/async-storage'
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { allThemes, ThemeFamilyName } from './themeRegistry'
import { ThemeTokens, TokenName } from './tokens'
import { tone } from './ultils/colorUtils'

export type ThemeFamily = ThemeFamilyName
export type ThemeMode = 'light' | 'dark'

interface ThemeContextValue {
  theme: ThemeTokens
  family: ThemeFamily
  mode: ThemeMode
  setFamily: (f: ThemeFamily) => void
  setMode: (m: ThemeMode) => void
  setTheme: (f: ThemeFamily, m: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

/**
 * 🌈 ThemeProvider
 * Wraps the entire app and manages the active theme family + mode.
 * Automatically loads and persists theme preferences from AsyncStorage.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [family, setFamilyState] = useState<ThemeFamily>('classic')
  const [mode, setModeState] = useState<ThemeMode>('dark')
  const [isLoading, setIsLoading] = useState(true)

  // Load saved theme preferences on mount
  useEffect(() => {
    const loadThemePreferences = async () => {
      try {
        const [savedFamily, savedMode] = await Promise.all([
          AsyncStorage.getItem('activeTheme'),
          AsyncStorage.getItem('themeMode'),
        ])

        if (savedFamily && allThemes[savedFamily as ThemeFamily]) {
          setFamilyState(savedFamily as ThemeFamily)
        }
        if (savedMode && (savedMode === 'light' || savedMode === 'dark')) {
          setModeState(savedMode as ThemeMode)
        }
      } catch (error) {
        console.warn('[ThemeProvider] Failed to load theme preferences:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadThemePreferences()
  }, [])

  // Resolve active theme tokens from family + mode
  const theme: ThemeTokens = useMemo(() => {
    const selectedFamily = allThemes[family]
    return selectedFamily?.[mode] ?? allThemes.classic.dark
  }, [family, mode])

  /** Update family and persist */
  const setFamily = useCallback((f: ThemeFamily) => {
    if (!allThemes[f]) {
      console.warn(`[ThemeProvider] Unknown theme: "${f}", falling back to classic.`)
      setFamilyState('classic')
      AsyncStorage.setItem('activeTheme', 'classic')
    } else {
      setFamilyState(f)
      AsyncStorage.setItem('activeTheme', f)
    }
  }, [])

  /** Update mode and persist */
  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m)
    AsyncStorage.setItem('themeMode', m)
  }, [])

  /** Update both family + mode and persist */
  const setTheme = useCallback((f: ThemeFamily, m: ThemeMode) => {
    if (!allThemes[f]) {
      console.warn(`[ThemeProvider] Unknown theme: "${f}", falling back to classic.`)
      setFamilyState('classic')
      AsyncStorage.setItem('activeTheme', 'classic')
    } else {
      setFamilyState(f)
      AsyncStorage.setItem('activeTheme', f)
    }
    setModeState(m)
    AsyncStorage.setItem('themeMode', m)
  }, [])

  // Memoize context value to prevent unnecessary re-renders of all consumers
  const contextValue = useMemo(
    () => ({ theme, family, mode, setFamily, setMode, setTheme }),
    [theme, family, mode, setFamily, setMode, setTheme]
  )

  // On web, sync ALL theme tokens to CSS variables for instant visual updates in RN Web
  // This allows components to reference `var(--token)` and update without remounts
  useEffect(() => {
    if (typeof document === 'undefined') return
    try {
      const root = document.documentElement
      const set = (name: string, value: string) => root.style.setProperty(name, value)

      // Sync every theme token to a CSS variable: --background, --surface, etc.
      Object.entries(theme).forEach(([key, value]) => {
        if (!value) return
        set(`--${key}` as `--${TokenName}`, value)
      })

      // Convenience aliases for older callers (keep for backward-compat)
      set('--bg', theme.background)
      set('--surfaceAlt', tone(theme.surface, 'alt', undefined, undefined, theme))
      set('--accentAlt', tone(theme.accent, 'alt', undefined, undefined, theme))
    } catch {
      // no-op on native or if document is not accessible
    }
  }, [theme])

  // Don't render children until theme is loaded to prevent flash of wrong theme
  if (isLoading) {
    return null
  }

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  )
}

/**
 * 🎨 Hook: useTheme
 * Access the current theme + controls anywhere in the app.
 */
export function UseTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('UseTheme must be used within a ThemeProvider')
  return ctx
}
