/**
 * Theme Provider - Manages theme state and persistence
 */

import { ThemeContext, ThemeContextType } from '@/contexts/ThemeContext';
import { logger } from '@/lib/utils/logger';
import { ThemeFamilyName, allThemes, getThemeFamily } from '@/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { ReactNode, useCallback, useEffect, useState } from 'react';

const THEME_STORAGE_KEY = '@dnd_toolkit_theme';

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * ThemeProvider - Provides theme context to the app
 * 
 * Features:
 * - Persists user's theme preference to AsyncStorage
 * - Automatically loads saved theme on mount
 * - Provides theme switching functionality
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const [themeName, setThemeName] = useState<ThemeFamilyName>('classic');
  const [isLoading, setIsLoading] = useState(true);

  // Load saved theme on mount
  useEffect(() => {
    loadSavedTheme();
  }, []);

  const loadSavedTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      
      if (savedTheme && isValidThemeName(savedTheme)) {
        setThemeName(savedTheme as ThemeFamilyName);
        logger.info('ui', `Loaded saved theme: ${savedTheme}`);
      } else {
        logger.info('ui', 'No saved theme, using default: classic');
      }
    } catch (error) {
      logger.error('ui', 'Failed to load saved theme:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveTheme = async (newTheme: ThemeFamilyName) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
      logger.success('ui', `Saved theme: ${newTheme}`);
    } catch (error) {
      logger.error('ui', 'Failed to save theme:', error);
    }
  };

  const handleSetTheme = useCallback((newTheme: ThemeFamilyName) => {
    setThemeName(newTheme);
    saveTheme(newTheme);
    logger.info('ui', `Theme changed to: ${newTheme}`);
  }, []);

  const theme = getThemeFamily(themeName);

  const contextValue: ThemeContextType = React.useMemo(() => ({
    theme,
    themeName,
    setTheme: handleSetTheme,
    isDark: (theme as any).isDark ?? true,
  }), [theme, themeName, handleSetTheme]);

  // Show nothing while loading theme (prevents flash of wrong theme)
  if (isLoading) {
    return null;
  }

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

// Helper to validate theme name
function isValidThemeName(name: string): name is ThemeFamilyName {
  return name in allThemes;
}

export default ThemeProvider;
