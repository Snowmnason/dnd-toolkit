import AsyncStorage from '@react-native-async-storage/async-storage'
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { allThemes, ThemeFamilyName } from './themeRegistry'
import { ThemeTokens } from './tokens'

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
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [family, setFamily] = useState<ThemeFamily>('classic')
  const [mode, setMode] = useState<ThemeMode>('dark')

  // Resolve active theme tokens from family + mode
  const theme: ThemeTokens = useMemo(() => {
    const selectedFamily = allThemes[family]
    return selectedFamily?.[mode] ?? allThemes.classic.dark
  }, [family, mode])

  /** Update both family + mode */
  const setTheme = (f: ThemeFamily, m: ThemeMode) => {
    if (!allThemes[f]) {
      console.warn(`[ThemeProvider] Unknown theme: "${f}", falling back to classic.`)
      setFamily('classic')
    } else {
      setFamily(f)
    }
    setMode(m)
  }

  /** Optional: persist preferences automatically */
  useEffect(() => {
    AsyncStorage.setItem('activeTheme', family)
    AsyncStorage.setItem('themeMode', mode)
  }, [family, mode])

  return (
    <ThemeContext.Provider value={{ theme, family, mode, setFamily, setMode, setTheme }}>
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
