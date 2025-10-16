import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useState } from 'react'
import { useColorScheme } from 'react-native'

const STORAGE_KEY = 'app-theme-preference'

export type ThemeName = 'light' | 'dark'

export function useThemeManager() {
  const system = useColorScheme() // 'light' | 'dark' | null
  const [theme, setThemeState] = useState<ThemeName>((system ?? 'light') as ThemeName)

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY)
        if (saved === 'light' || saved === 'dark') {
          setThemeState(saved)
        } else if (system === 'light' || system === 'dark') {
          setThemeState(system)
        }
      } catch {}
    })()
  }, [system])

  const setTheme = useCallback(async (name: ThemeName) => {
    setThemeState(name)
    try {
      await AsyncStorage.setItem(STORAGE_KEY, name)
    } catch {}
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }, [theme, setTheme])

  // Placeholder to later sync with user profile
  const changeUserTheme = useCallback(async (name: ThemeName) => {
    await setTheme(name)
    // TODO: integrate with Supabase user profile
  }, [setTheme])

  return { theme, setTheme, toggleTheme, changeUserTheme }
}
