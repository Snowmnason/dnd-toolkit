import { ThemeFamily, ThemeMode, UseTheme } from '@/theme'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState } from 'react'

/**
 * 🎛️ useThemeSwitcher
 * Provides helper logic for switching and remembering theme + mode.
 */
export function useThemeSwitcher() {
  const { setTheme, mode, setMode, family } = UseTheme()
  const [activeTheme, setActiveTheme] = useState<ThemeFamily>('classic')

  // Load saved preferences when mounted
  useEffect(() => {
    const loadStoredTheme = async () => {
      try {
        const savedTheme = (await AsyncStorage.getItem('activeTheme')) as ThemeFamily | null
        const savedMode = (await AsyncStorage.getItem('themeMode')) as ThemeMode | null

        const themeToUse: ThemeFamily = savedTheme || 'classic'
        const modeToUse: ThemeMode = savedMode || 'light'

        setActiveTheme(themeToUse)
        setTheme(themeToUse, modeToUse)
      } catch (e) {
        console.warn('Failed to load theme settings:', e)
      }
    }

    loadStoredTheme()
  }, [setTheme])

  /** Change theme family (classic, cyberpunk, etc.) */
  const changeTheme = async (themeName: ThemeFamily) => {
    setActiveTheme(themeName)
    setTheme(themeName, mode)
    await AsyncStorage.setItem('activeTheme', themeName)
  }

  /** Toggle between light and dark mode */
  const toggleMode = async () => {
    const newMode: ThemeMode = mode === 'light' ? 'dark' : 'light'
    setMode(newMode)
    setTheme(activeTheme, newMode)
    await AsyncStorage.setItem('themeMode', newMode)
  }

  return {
    activeTheme: activeTheme ?? family,
    mode,
    changeTheme,
    toggleMode,
  }
}
