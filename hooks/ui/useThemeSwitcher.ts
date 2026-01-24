import { ThemeFamily, ThemeMode, UseTheme } from '@/theme'

/**
 * 🎛️ useThemeSwitcher
 * Provides helper logic for switching and remembering theme + mode.
 * Theme persistence is now handled by ThemeProvider automatically.
 */
export function useThemeSwitcher() {
  const { setTheme, mode, setMode, family } = UseTheme()

  /** Change theme family (classic, cyberpunk, etc.) */
  const changeTheme = (themeName: ThemeFamily) => {
    setTheme(themeName, mode)
  }

  /** Toggle between light and dark mode */
  const toggleMode = () => {
    const newMode: ThemeMode = mode === 'light' ? 'dark' : 'light'
    setMode(newMode)
  }

  return {
    activeTheme: family,
    mode,
    changeTheme,
    toggleMode,
  }
}
