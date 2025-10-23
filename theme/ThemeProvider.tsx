import { classicTheme, ClassicTheme } from '@/theme/families/Classic'
import { ThemeTokens } from '@/theme/tokens'
import React, { createContext, ReactNode, useContext, useMemo, useState } from 'react'

// add more families as you create them
export type ThemeFamily = 'classic' // | 'cyberpunk'
export type ThemeMode = 'light' | 'dark'

type ThemeMap = {
  classic: ClassicTheme
  // cyberpunk: CyberpunkTheme
}

const themeFamilies: ThemeMap = {
  classic: classicTheme,
}

interface ThemeContextValue {
  theme: ThemeTokens           // <<— important
  family: ThemeFamily
  mode: ThemeMode
  setFamily: (f: ThemeFamily) => void
  setMode: (m: ThemeMode) => void
  setTheme: (f: ThemeFamily, m: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [family, setFamily] = useState<ThemeFamily>('classic')
  const [mode, setMode] = useState<ThemeMode>('dark')

  // Resolve the active theme mode (must be ThemeTokens)
  const theme: ThemeTokens = useMemo(() => {
    const familyTheme = themeFamilies[family]
    return familyTheme?.[mode] ?? classicTheme.dark
  }, [family, mode])

  const setTheme = (f: ThemeFamily, m: ThemeMode) => {
    setFamily(f)
    setMode(m)
  }

  return (
    <ThemeContext.Provider value={{ theme, family, mode, setFamily, setMode, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function UseTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('UseTheme must be used within a ThemeProvider')
  return ctx
}
